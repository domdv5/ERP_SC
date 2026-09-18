import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, AccountsPayableStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SequenceService } from '@/common/sequence/sequence.service';
import type { JwtPayload } from '@/common/types';
import { CreateEgresoDto } from './dto/create-egreso.dto';
import { FindAllEgresosDto } from './dto/find-all-egresos.dto';

export const EGRESO_DETAIL_INCLUDE = {
  supplier: { include: { thirdParty: { select: { id: true, name: true } } } },
  user: { select: { id: true, name: true } },
  payments: true,
  allocations: {
    include: {
      accountPayable: {
        include: {
          document: {
            select: { id: true, type: true, number: true, date: true },
          },
        },
      },
    },
  },
  creditApplications: {
    include: {
      supplierCredit: {
        include: {
          sourceDocument: {
            select: { id: true, type: true, number: true, date: true },
          },
        },
      },
    },
  },
} satisfies Prisma.EgresoInclude;

/** Convierte a centavos enteros para comparar montos sin errores de coma flotante. */
function toCents(amount: number | Prisma.Decimal) {
  return Math.round(Number(amount) * 100);
}

type ExistingEgresoForIdempotency = {
  supplierId: string;
  cashTotal: Prisma.Decimal;
  creditTotal: Prisma.Decimal;
  allocations: { accountPayableId: string; amount: Prisma.Decimal }[];
};

/**
 * Compara el body de un reintento contra el egreso que ya quedó guardado bajo la
 * misma idempotencyKey. La comparación de `payables` es exacta (par CxP+monto,
 * agrupado igual que en createInTransaction); `credits`/`payments` solo comparan
 * el total, porque su reparto interno (qué crédito cubrió qué CxP) es una
 * decisión del service, no algo que el cliente repita igual en cada request.
 */
function requestMatchesExisting(
  dto: CreateEgresoDto,
  existing: ExistingEgresoForIdempotency,
): boolean {
  if (existing.supplierId !== dto.supplierId) {
    return false;
  }

  const requestedCentsByPayableId = new Map<string, number>();
  for (const line of dto.payables) {
    const previous = requestedCentsByPayableId.get(line.accountPayableId) ?? 0;
    requestedCentsByPayableId.set(
      line.accountPayableId,
      previous + toCents(line.amount),
    );
  }

  const existingCentsByPayableId = new Map(
    existing.allocations.map((a) => [a.accountPayableId, toCents(a.amount)]),
  );

  if (requestedCentsByPayableId.size !== existingCentsByPayableId.size) {
    return false;
  }
  for (const [payableId, cents] of requestedCentsByPayableId) {
    if (existingCentsByPayableId.get(payableId) !== cents) {
      return false;
    }
  }

  const creditsTotalCents = (dto.credits ?? []).reduce(
    (sum, line) => sum + toCents(line.amount),
    0,
  );
  const paymentsTotalCents = (dto.payments ?? []).reduce(
    (sum, line) => sum + toCents(line.amount),
    0,
  );

  return (
    creditsTotalCents === toCents(existing.creditTotal) &&
    paymentsTotalCents === toCents(existing.cashTotal)
  );
}

@Injectable()
export class EgresosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequenceService: SequenceService,
  ) {}

  /**
   * Crea un egreso: paga una o varias CxP de un proveedor en un solo movimiento,
   * con una o varias formas de pago y, si hay, saldos a favor. Reglas de negocio
   * (ver plans/egresos-y-rework-cuentas-por-pagar.md):
   *
   * 1. El tercero debe ser proveedor.
   * 2. Al menos una CxP (garantizado por @ArrayMinSize(1) en el DTO).
   * 3. Todas las CxP deben ser de ese proveedor y no estar `paid`.
   * 4. Cada abono > 0 y <= saldo pendiente de su CxP.
   * 5. Los saldos a favor deben ser del proveedor, cada monto <= su saldo disponible.
   * 6. Cuadre exacto: Σ abonos === Σ saldos a favor usados + Σ formas de pago.
   * 7. El saldo a favor se reparte solo entre las CxP elegidas, empezando por la más
   *    antigua (createdAt asc); lo que sobra de cada CxP se cubre con dinero.
   * 8. Recalcula paidAmount/status de cada CxP y balance/status de cada saldo a favor.
   * 9. Idempotencia por idempotencyKey: un reintento devuelve el egreso ya creado.
   * 10. Montos en pesos enteros, validados en centavos (mismo criterio que
   *     accounts-payable.service.ts::registerPayment, que este endpoint reemplaza).
   */
  async create(dto: CreateEgresoDto, user: JwtPayload) {
    // Corto circuito rápido antes de la transacción pesada: la mayoría de los
    // reintentos (doble clic) llegan bien después de que el primero ya terminó.
    const alreadyCreated = await this.prisma.egreso.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: EGRESO_DETAIL_INCLUDE,
    });
    if (alreadyCreated) {
      if (!requestMatchesExisting(dto, alreadyCreated)) {
        throw new ConflictException(
          'Esta clave de idempotencia ya se usó para un egreso distinto',
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
        const existing = await this.prisma.egreso.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
          include: EGRESO_DETAIL_INCLUDE,
        });
        if (existing) {
          if (!requestMatchesExisting(dto, existing)) {
            throw new ConflictException(
              'Esta clave de idempotencia ya se usó para un egreso distinto',
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
    dto: CreateEgresoDto,
    user: JwtPayload,
  ) {
    const supplier = await tx.supplier.findUnique({
      where: { id: dto.supplierId },
      include: { thirdParty: { select: { isSupplier: true } } },
    });

    if (!supplier || !supplier.thirdParty.isSupplier) {
      throw new BadRequestException('El egreso requiere un proveedor válido');
    }

    // Orden de bloqueo fijo (accounts_payable -> supplier_credit -> sequence) para
    // que dos egresos concurrentes nunca se traben en cruz esperándose entre sí.
    const payableIds = [
      ...new Set(dto.payables.map((p) => p.accountPayableId)),
    ].sort();
    await tx.$queryRaw`SELECT id FROM "accounts_payable" WHERE id = ANY(${payableIds}::uuid[]) ORDER BY id FOR UPDATE`;

    const payables = await tx.accountsPayable.findMany({
      where: { id: { in: payableIds } },
      orderBy: { createdAt: 'asc' },
    });

    if (payables.length !== payableIds.length) {
      throw new BadRequestException('Alguna cuenta por pagar citada no existe');
    }

    for (const payable of payables) {
      if (payable.supplierId !== supplier.id) {
        throw new BadRequestException(
          'Todas las cuentas por pagar deben ser del mismo proveedor del egreso',
        );
      }
      if (payable.status === AccountsPayableStatus.paid) {
        throw new BadRequestException(
          'Alguna cuenta por pagar citada ya está totalmente pagada',
        );
      }
    }

    // Agrupa por CxP: si el mismo id aparece dos veces en el body, sumar antes de
    // validar evita que dos abonos parciales colados se cuelen por separado del
    // límite real (mismo motivo que requestedCentsByCreditId en registerPayment).
    const requestedCentsByPayableId = new Map<string, number>();
    for (const line of dto.payables) {
      const previous =
        requestedCentsByPayableId.get(line.accountPayableId) ?? 0;
      requestedCentsByPayableId.set(
        line.accountPayableId,
        previous + toCents(line.amount),
      );
    }

    const payableById = new Map(payables.map((p) => [p.id, p]));
    for (const [payableId, requestedCents] of requestedCentsByPayableId) {
      const payable = payableById.get(payableId)!;
      const balanceCents =
        toCents(payable.totalAmount) - toCents(payable.paidAmount);
      if (requestedCents <= 0) {
        throw new BadRequestException(
          'El abono a cada cuenta por pagar debe ser mayor a cero',
        );
      }
      if (requestedCents > balanceCents) {
        throw new BadRequestException(
          `El abono excede el saldo pendiente de una cuenta por pagar. Saldo disponible: ${(balanceCents / 100).toFixed(2)}`,
        );
      }
    }

    const creditLines = dto.credits ?? [];
    const requestedCentsByCreditId = new Map<string, number>();
    for (const line of creditLines) {
      const previous = requestedCentsByCreditId.get(line.supplierCreditId) ?? 0;
      requestedCentsByCreditId.set(
        line.supplierCreditId,
        previous + toCents(line.amount),
      );
    }

    let credits: {
      id: string;
      balance: Prisma.Decimal;
      supplierId: string;
      status: string;
    }[] = [];
    if (requestedCentsByCreditId.size > 0) {
      const creditIds = [...requestedCentsByCreditId.keys()].sort();
      await tx.$queryRaw`SELECT id FROM "supplier_credit" WHERE id = ANY(${creditIds}::uuid[]) ORDER BY id FOR UPDATE`;

      // orderBy explícito para que el reparto FIFO de más abajo (creditQueue)
      // consuma primero el saldo a favor más antiguo, como dice su comentario —
      // sin esto, findMany no garantiza ningún orden en particular.
      credits = await tx.supplierCredit.findMany({
        where: { id: { in: creditIds } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });

      if (credits.length !== creditIds.length) {
        throw new BadRequestException('Alguna nota crédito citada no existe');
      }

      for (const credit of credits) {
        if (credit.supplierId !== supplier.id) {
          throw new BadRequestException(
            'La nota crédito citada no pertenece al proveedor de este egreso',
          );
        }
        if (credit.status !== 'available') {
          throw new BadRequestException(
            'La nota crédito citada ya fue utilizada',
          );
        }
        const requestedCents = requestedCentsByCreditId.get(credit.id)!;
        if (requestedCents > toCents(credit.balance)) {
          throw new BadRequestException(
            `El monto aplicado de la nota crédito excede su saldo disponible: ${Number(credit.balance).toFixed(2)}`,
          );
        }
      }
    }

    const payablesTotalCents = [...requestedCentsByPayableId.values()].reduce(
      (sum, cents) => sum + cents,
      0,
    );
    const creditsTotalCents = [...requestedCentsByCreditId.values()].reduce(
      (sum, cents) => sum + cents,
      0,
    );

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

    // Cuadre con tolerancia de redondeo (hasta 1 peso): algunas CxP legadas (de
    // antes de este módulo) tienen saldo con centavos, pero el abono se teclea en
    // pesos enteros (ThousandsInput del frontend) — el usuario no puede escribir
    // los centavos exactos para cerrar ese remanente. Mismo criterio de "hasta ~1
    // peso de diferencia" que ya usan CmEffectStrategy/DvcEffectStrategy al
    // redondear totalAmount/amount a pesos enteros. Las CxP creadas desde este
    // módulo en adelante nacen sin centavos (Math.round en confirm()), así que
    // esto solo puede pasar contra saldo legado.
    const settledCents = creditsTotalCents + paymentsTotalCents;
    if (Math.abs(payablesTotalCents - settledCents) > 100) {
      throw new BadRequestException(
        'El egreso no cuadra: la suma de los abonos debe ser igual a los saldos a favor más las formas de pago',
      );
    }

    // Fecha: por defecto hoy en huso Colombia (America/Bogota), nunca futura. Con
    // toISOString() (UTC) un egreso de las 7pm caía en el día siguiente — mismo
    // motivo documentado para Egreso.date en schema.prisma. Se compara como fecha
    // simple (YYYY-MM-DD), sin horas, contra ese mismo huso.
    const todayStr = new Date().toLocaleDateString('sv-SE', {
      timeZone: 'America/Bogota',
    });
    const dateStr = dto.date ?? todayStr;
    if (dateStr > todayStr) {
      throw new BadRequestException('La fecha del egreso no puede ser futura');
    }

    // Número tomado como último bloqueo, después de accounts_payable y supplier_credit.
    const number = await this.sequenceService.next(tx, 'EGRESO');

    // total = lo efectivamente cubierto (crédito + dinero), no la suma cruda de
    // abonos: así coincide exacto con cashTotal+creditTotal por construcción y
    // nunca choca con el CHECK "egreso_totals_chk" (total = cash_total +
    // credit_total), incluso cuando la tolerancia de arriba absorbió hasta 1 peso
    // de diferencia contra payablesTotalCents. El abono real a cada CxP no cambia:
    // EgresoAllocation.amount/AccountsPayable.paidAmount siguen usando el monto
    // exacto que se tecleó para esa CxP (más abajo), no este total.
    const egreso = await tx.egreso.create({
      data: {
        number,
        date: new Date(dateStr),
        supplierId: supplier.id,
        userId: user.sub,
        total: settledCents / 100,
        cashTotal: paymentsTotalCents / 100,
        creditTotal: creditsTotalCents / 100,
        notes: dto.notes,
        idempotencyKey: dto.idempotencyKey,
      },
    });

    if (paymentLines.length > 0) {
      await tx.egresoPayment.createMany({
        data: paymentLines.map((payment) => ({
          egresoId: egreso.id,
          method: payment.method,
          amount: payment.amount,
          reference: payment.reference,
          bank: payment.bank,
        })),
      });
    }

    // Reparto del saldo a favor entre las CxP elegidas, empezando por la más
    // antigua (payables ya viene ordenado por createdAt asc). Dentro de cada CxP,
    // consume los créditos citados en el orden en que llegaron hasta agotar lo que
    // necesita esa CxP o el crédito, lo que pase primero — el remanente de un
    // crédito pasa a la siguiente CxP de la cola.
    const creditQueue = credits.map((credit) => ({
      id: credit.id,
      remainingCents: requestedCentsByCreditId.get(credit.id)!,
    }));

    for (const payable of payables) {
      const amountCents = requestedCentsByPayableId.get(payable.id);
      if (amountCents === undefined) continue;

      let neededCents = amountCents;
      let creditUsedCents = 0;

      for (const chunk of creditQueue) {
        if (neededCents <= 0) break;
        if (chunk.remainingCents <= 0) continue;

        const takeCents = Math.min(neededCents, chunk.remainingCents);
        await tx.supplierCreditApplication.create({
          data: {
            supplierCreditId: chunk.id,
            accountPayableId: payable.id,
            egresoId: egreso.id,
            amount: takeCents / 100,
          },
        });

        chunk.remainingCents -= takeCents;
        neededCents -= takeCents;
        creditUsedCents += takeCents;
      }

      await tx.egresoAllocation.create({
        data: {
          egresoId: egreso.id,
          accountPayableId: payable.id,
          amount: amountCents / 100,
          creditAmount: creditUsedCents / 100,
        },
      });

      const newPaidCents = toCents(payable.paidAmount) + amountCents;
      const totalCents = toCents(payable.totalAmount);
      const status =
        newPaidCents >= totalCents
          ? AccountsPayableStatus.paid
          : AccountsPayableStatus.partial;

      await tx.accountsPayable.update({
        where: { id: payable.id },
        data: { paidAmount: newPaidCents / 100, status },
      });
    }

    for (const chunk of creditQueue) {
      const original = credits.find((c) => c.id === chunk.id)!;
      const newBalanceCents =
        toCents(original.balance) - requestedCentsByCreditId.get(chunk.id)!;

      await tx.supplierCredit.update({
        where: { id: chunk.id },
        data: {
          balance: newBalanceCents / 100,
          status: newBalanceCents <= 0 ? 'used' : 'available',
        },
      });
    }

    return tx.egreso.findUniqueOrThrow({
      where: { id: egreso.id },
      include: EGRESO_DETAIL_INCLUDE,
    });
  }

  async findAll(dto: FindAllEgresosDto) {
    const { page = 1, limit = 20, supplierId, dateFrom, dateTo, number } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.EgresoWhereInput = {
      ...(supplierId && { supplierId }),
      ...(number && { number: { contains: number } }),
      ...((dateFrom || dateTo) && {
        date: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.egreso.findMany({
        where,
        select: {
          id: true,
          number: true,
          date: true,
          total: true,
          cashTotal: true,
          creditTotal: true,
          createdAt: true,
          supplier: {
            include: { thirdParty: { select: { id: true, name: true } } },
          },
        },
        skip,
        take: limit,
        // El consecutivo ya viene con ceros a la izquierda: ordenar por el
        // string da el mismo orden que ordenar por el número real.
        orderBy: { number: 'desc' },
      }),
      this.prisma.egreso.count({ where }),
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
    const egreso = await this.prisma.egreso.findUnique({
      where: { id },
      include: EGRESO_DETAIL_INCLUDE,
    });

    if (!egreso) {
      throw new NotFoundException('Egreso no encontrado');
    }

    return egreso;
  }

  /** CxP abiertas y saldos a favor disponibles de un proveedor, para armar el formulario de egreso. */
  async findOpenItems(supplierId: string) {
    const [payables, credits] = await Promise.all([
      this.prisma.accountsPayable.findMany({
        where: { supplierId, status: { not: AccountsPayableStatus.paid } },
        include: {
          document: {
            select: { id: true, type: true, number: true, date: true },
          },
        },
        // Mismo orden que usa create() para el reparto FIFO del saldo a favor:
        // el frontend muestra el orden real en que se van a cubrir.
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.supplierCredit.findMany({
        where: { supplierId, status: 'available', balance: { gt: 0 } },
        include: {
          sourceDocument: {
            select: { id: true, type: true, number: true, date: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      payables: payables.map((payable) => ({
        ...payable,
        balance: payable.totalAmount.minus(payable.paidAmount),
      })),
      credits,
    };
  }
}
