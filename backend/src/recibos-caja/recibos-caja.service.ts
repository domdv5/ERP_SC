import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, AccountsReceivableStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SequenceService } from '@/common/sequence/sequence.service';
import type { JwtPayload } from '@/common/types';
import { CreateReciboCajaDto } from './dto/create-recibo-caja.dto';
import { FindAllRecibosCajaDto } from './dto/find-all-recibos-caja.dto';

export const RECIBO_CAJA_DETAIL_INCLUDE = {
  client: { include: { thirdParty: { select: { id: true, name: true } } } },
  user: { select: { id: true, name: true } },
  payments: true,
  allocations: {
    include: {
      accountReceivable: {
        include: {
          document: {
            select: { id: true, type: true, number: true, date: true },
          },
        },
      },
    },
  },
} satisfies Prisma.ReciboCajaInclude;

/** Convierte a centavos enteros para comparar montos sin errores de coma flotante. */
function toCents(amount: number | Prisma.Decimal) {
  return Math.round(Number(amount) * 100);
}

type ExistingReciboCajaForIdempotency = {
  clientId: string;
  total: Prisma.Decimal;
  allocations: { accountReceivableId: string; amount: Prisma.Decimal }[];
};

/** Compara el reintento contra el recibo ya guardado con la misma idempotencyKey: receivables exacto, payments solo por total (el reparto interno lo decide el service). Mismo patrón que requestMatchesExisting de EgresosService. */
function requestMatchesExisting(
  dto: CreateReciboCajaDto,
  existing: ExistingReciboCajaForIdempotency,
): boolean {
  if (existing.clientId !== dto.clientId) {
    return false;
  }

  const requestedCentsByReceivableId = new Map<string, number>();
  for (const line of dto.receivables) {
    const previous =
      requestedCentsByReceivableId.get(line.accountReceivableId) ?? 0;
    requestedCentsByReceivableId.set(
      line.accountReceivableId,
      previous + toCents(line.amount),
    );
  }

  const existingCentsByReceivableId = new Map(
    existing.allocations.map((a) => [a.accountReceivableId, toCents(a.amount)]),
  );

  if (requestedCentsByReceivableId.size !== existingCentsByReceivableId.size) {
    return false;
  }
  for (const [receivableId, cents] of requestedCentsByReceivableId) {
    if (existingCentsByReceivableId.get(receivableId) !== cents) {
      return false;
    }
  }

  const paymentsTotalCents = (dto.payments ?? []).reduce(
    (sum, line) => sum + toCents(line.amount),
    0,
  );

  return paymentsTotalCents === toCents(existing.total);
}

@Injectable()
export class RecibosCajaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequenceService: SequenceService,
  ) {}

  /** Cobra una o varias CxC de un cliente: cuadre exacto (Σ abonos = Σ formas de pago, sin saldo a favor — regla de negocio explícita), idempotente por idempotencyKey. */
  async create(dto: CreateReciboCajaDto, user: JwtPayload) {
    // Corto circuito rápido antes de la transacción pesada: la mayoría de los
    // reintentos (doble clic) llegan bien después de que el primero ya terminó.
    const alreadyCreated = await this.prisma.reciboCaja.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: RECIBO_CAJA_DETAIL_INCLUDE,
    });
    if (alreadyCreated) {
      if (!requestMatchesExisting(dto, alreadyCreated)) {
        throw new ConflictException(
          'Esta clave de idempotencia ya se usó para un recibo de caja distinto',
        );
      }
      return alreadyCreated;
    }

    try {
      return await this.prisma.$transaction(
        (tx) => this.createInTransaction(tx, dto, user),
        { timeout: 30000 },
      );
    } catch (error) {
      // Carrera real entre dos requests con la misma clave: el @unique de la
      // columna revienta con P2002 en vez del chequeo de arriba, que ya pasó.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        (error.meta?.target as string[] | undefined)?.includes(
          'idempotency_key',
        )
      ) {
        const existing = await this.prisma.reciboCaja.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
          include: RECIBO_CAJA_DETAIL_INCLUDE,
        });
        if (existing) {
          if (!requestMatchesExisting(dto, existing)) {
            throw new ConflictException(
              'Esta clave de idempotencia ya se usó para un recibo de caja distinto',
            );
          }
          return existing;
        }
      }
      throw error;
    }
  }

  private async createInTransaction(
    tx: Prisma.TransactionClient,
    dto: CreateReciboCajaDto,
    user: JwtPayload,
  ) {
    const client = await tx.customer.findUnique({
      where: { id: dto.clientId },
      include: { thirdParty: { select: { isCustomer: true } } },
    });

    if (!client || !client.thirdParty.isCustomer) {
      throw new BadRequestException(
        'El recibo de caja requiere un cliente válido',
      );
    }

    // Orden de bloqueo fijo (accounts_receivable -> sequence), mismo criterio que
    // EgresosService para que dos recibos concurrentes nunca se traben en cruz.
    const receivableIds = [
      ...new Set(dto.receivables.map((r) => r.accountReceivableId)),
    ].sort();
    await tx.$queryRaw`SELECT id FROM "accounts_receivable" WHERE id = ANY(${receivableIds}::uuid[]) ORDER BY id FOR UPDATE`;

    // Re-chequeo tras el lock: un recibo concurrente con la misma idempotencyKey pudo
    // haber comprometido mientras esperábamos el FOR UPDATE — sin esto, el segundo
    // request choca contra "ya está totalmente pagada" en vez de recibir el mismo recibo.
    const concurrentlyCreated = await tx.reciboCaja.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: RECIBO_CAJA_DETAIL_INCLUDE,
    });
    if (concurrentlyCreated) {
      if (!requestMatchesExisting(dto, concurrentlyCreated)) {
        throw new ConflictException(
          'Esta clave de idempotencia ya se usó para un recibo de caja distinto',
        );
      }
      return concurrentlyCreated;
    }

    const receivables = await tx.accountsReceivable.findMany({
      where: { id: { in: receivableIds } },
      orderBy: { createdAt: 'asc' },
    });

    if (receivables.length !== receivableIds.length) {
      throw new BadRequestException(
        'Alguna cuenta por cobrar citada no existe',
      );
    }

    for (const receivable of receivables) {
      if (receivable.clientId !== client.id) {
        throw new BadRequestException(
          'Todas las cuentas por cobrar deben ser del mismo cliente del recibo de caja',
        );
      }
      if (receivable.status === AccountsReceivableStatus.paid) {
        throw new BadRequestException(
          'Alguna cuenta por cobrar citada ya está totalmente pagada',
        );
      }
    }

    // Agrupa por CxC: si el mismo id se repite en el body, suma antes de validar contra el límite.
    const requestedCentsByReceivableId = new Map<string, number>();
    for (const line of dto.receivables) {
      const previous =
        requestedCentsByReceivableId.get(line.accountReceivableId) ?? 0;
      requestedCentsByReceivableId.set(
        line.accountReceivableId,
        previous + toCents(line.amount),
      );
    }

    const receivableById = new Map(receivables.map((r) => [r.id, r]));
    for (const [receivableId, requestedCents] of requestedCentsByReceivableId) {
      const receivable = receivableById.get(receivableId)!;
      const balanceCents =
        toCents(receivable.totalAmount) - toCents(receivable.paidAmount);
      if (requestedCents <= 0) {
        throw new BadRequestException(
          'El abono a cada cuenta por cobrar debe ser mayor a cero',
        );
      }
      if (requestedCents > balanceCents) {
        throw new BadRequestException(
          `El abono excede el saldo pendiente de una cuenta por cobrar. Saldo disponible: ${(balanceCents / 100).toFixed(2)}`,
        );
      }
    }

    const receivablesTotalCents = [
      ...requestedCentsByReceivableId.values(),
    ].reduce((sum, cents) => sum + cents, 0);

    const paymentLines = dto.payments ?? [];
    for (const payment of paymentLines) {
      if (toCents(payment.amount) <= 0) {
        throw new BadRequestException(
          'Cada forma de pago debe tener un monto mayor a cero',
        );
      }
    }
    const paymentsTotalCents = paymentLines.reduce(
      (sum, payment) => sum + toCents(payment.amount),
      0,
    );

    // Cuadre exacto en centavos, sin saldo a favor de por medio (regla de negocio explícita) —
    // toCents() ya redondea cada monto individual antes de sumar, no hay ruido de coma flotante que tolerar.
    if (receivablesTotalCents !== paymentsTotalCents) {
      throw new BadRequestException(
        'El recibo de caja no cuadra: la suma de los abonos debe ser igual a las formas de pago',
      );
    }

    // Hoy en huso Bogotá, no UTC: con toISOString() un recibo nocturno caía en el día siguiente.
    const todayStr = new Date().toLocaleDateString('sv-SE', {
      timeZone: 'America/Bogota',
    });
    const dateStr = dto.date ?? todayStr;
    if (dateStr > todayStr) {
      throw new BadRequestException(
        'La fecha del recibo de caja no puede ser futura',
      );
    }

    // Número tomado como último bloqueo, después de accounts_receivable.
    const number = await this.sequenceService.next(tx, 'RECIBO_CAJA');

    const reciboCaja = await tx.reciboCaja.create({
      data: {
        number,
        date: new Date(dateStr),
        clientId: client.id,
        userId: user.sub,
        total: paymentsTotalCents / 100,
        notes: dto.notes,
        idempotencyKey: dto.idempotencyKey,
      },
    });

    if (paymentLines.length > 0) {
      await tx.reciboCajaPayment.createMany({
        data: paymentLines.map((payment) => ({
          reciboCajaId: reciboCaja.id,
          method: payment.method,
          // toCents()/100, no el monto crudo del cliente: así la suma de payments
          // siempre cuadra exacto con `total` (que ya se calculó en centavos redondeados).
          amount: toCents(payment.amount) / 100,
          reference: payment.reference,
          bank: payment.bank,
        })),
      });
    }

    for (const receivable of receivables) {
      const amountCents = requestedCentsByReceivableId.get(receivable.id);
      if (amountCents === undefined) continue;

      await tx.reciboCajaAllocation.create({
        data: {
          reciboCajaId: reciboCaja.id,
          accountReceivableId: receivable.id,
          amount: amountCents / 100,
        },
      });

      const newPaidCents = toCents(receivable.paidAmount) + amountCents;
      const totalCents = toCents(receivable.totalAmount);
      const status =
        newPaidCents >= totalCents
          ? AccountsReceivableStatus.paid
          : AccountsReceivableStatus.partial;

      await tx.accountsReceivable.update({
        where: { id: receivable.id },
        data: { paidAmount: newPaidCents / 100, status },
      });
    }

    return tx.reciboCaja.findUniqueOrThrow({
      where: { id: reciboCaja.id },
      include: RECIBO_CAJA_DETAIL_INCLUDE,
    });
  }

  async findAll(dto: FindAllRecibosCajaDto) {
    const { page = 1, limit = 20, clientId, dateFrom, dateTo, number } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.ReciboCajaWhereInput = {
      ...(clientId && { clientId }),
      ...(number && { number: { contains: number } }),
      ...((dateFrom || dateTo) && {
        date: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.reciboCaja.findMany({
        where,
        select: {
          id: true,
          number: true,
          date: true,
          total: true,
          createdAt: true,
          client: {
            include: { thirdParty: { select: { id: true, name: true } } },
          },
        },
        skip,
        take: limit,
        // El consecutivo ya viene con ceros a la izquierda: ordenar por el
        // string da el mismo orden que ordenar por el número real.
        orderBy: { number: 'desc' },
      }),
      this.prisma.reciboCaja.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const reciboCaja = await this.prisma.reciboCaja.findUnique({
      where: { id },
      include: RECIBO_CAJA_DETAIL_INCLUDE,
    });

    if (!reciboCaja) {
      throw new NotFoundException('Recibo de caja no encontrado');
    }

    return reciboCaja;
  }

  /** CxC abiertas de un cliente, para armar el formulario de recibo de caja. Sin saldos a favor: este flujo no los usa (regla de negocio explícita). */
  async findOpenItems(clientId: string) {
    const receivables = await this.prisma.accountsReceivable.findMany({
      where: { clientId, status: { not: AccountsReceivableStatus.paid } },
      include: {
        document: {
          select: { id: true, type: true, number: true, date: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      receivables: receivables.map((receivable) => ({
        ...receivable,
        balance: receivable.totalAmount.minus(receivable.paidAmount),
      })),
    };
  }
}
