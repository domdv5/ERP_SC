import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  AccountsPayableStatus,
  SupplierPaymentVoidReason,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SequenceService } from '@/common/sequence/sequence.service';
import { matchContract } from '@/common/types';
import type { JwtPayload } from '@/common/types';
import type {
  SupplierPayment,
  SupplierPaymentListResponse,
  SupplierPaymentOpenItems,
} from '@/contracts';
import { toCents } from '@/common/utils/money.util';
import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';
import { FindAllSupplierPaymentsDto } from './dto/find-all-supplier-payments.dto';
import { VoidSupplierPaymentDto } from './dto/void-supplier-payment.dto';

const matchListContract = matchContract<SupplierPaymentListResponse>();
const matchDetailContract = matchContract<SupplierPayment>();
const matchOpenItemsContract = matchContract<SupplierPaymentOpenItems>();

export const SUPPLIER_PAYMENT_DETAIL_INCLUDE = {
  supplier: { include: { thirdParty: { select: { id: true, name: true } } } },
  user: { select: { id: true, name: true } },
  voidedBy: { select: { id: true, name: true } },
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
      accountPayable: {
        select: {
          id: true,
          document: {
            select: { id: true, type: true, number: true, date: true },
          },
        },
      },
      supplierCredit: {
        include: {
          sourceDocument: {
            select: { id: true, type: true, number: true, date: true },
          },
        },
      },
    },
  },
} satisfies Prisma.SupplierPaymentInclude;

type ExistingSupplierPaymentForIdempotency = {
  supplierId: string;
  cashTotal: Prisma.Decimal;
  creditTotal: Prisma.Decimal;
  allocations: { accountPayableId: string; amount: Prisma.Decimal }[];
};

/** Compara el reintento contra el egreso ya guardado con la misma idempotencyKey: payables exacto, credits/payments solo por total (el reparto interno lo decide el service). */
function isSameSupplierPaymentRequest(
  dto: CreateSupplierPaymentDto,
  existing: ExistingSupplierPaymentForIdempotency,
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
export class SupplierPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequenceService: SequenceService,
  ) {}

  /** Paga una o varias CxP de un proveedor: cuadre exacto (Σ abonos = Σ saldos a favor + Σ formas de pago), saldo a favor repartido FIFO por antigüedad, idempotente por idempotencyKey. */
  async create(dto: CreateSupplierPaymentDto, user: JwtPayload) {
    // Corto circuito rápido antes de la transacción pesada: la mayoría de los
    // reintentos (doble clic) llegan bien después de que el primero ya terminó.
    const alreadyCreated = await this.prisma.supplierPayment.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: SUPPLIER_PAYMENT_DETAIL_INCLUDE,
    });
    if (alreadyCreated) {
      if (!isSameSupplierPaymentRequest(dto, alreadyCreated)) {
        throw new ConflictException(
          'Esta clave de idempotencia ya se usó para un egreso distinto',
        );
      }
      return matchDetailContract(alreadyCreated);
    }

    try {
      return matchDetailContract(
        await this.prisma.$transaction(
          (tx) => this.createInTransaction(tx, dto, user),
          { timeout: 30000 },
        ),
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
        const existing = await this.prisma.supplierPayment.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
          include: SUPPLIER_PAYMENT_DETAIL_INCLUDE,
        });
        if (existing) {
          if (!isSameSupplierPaymentRequest(dto, existing)) {
            throw new ConflictException(
              'Esta clave de idempotencia ya se usó para un egreso distinto',
            );
          }
          return matchDetailContract(existing);
        }
      }
      throw error;
    }
  }

  private async createInTransaction(
    tx: Prisma.TransactionClient,
    dto: CreateSupplierPaymentDto,
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

    // Agrupa por CxP: si el mismo id se repite en el body, suma antes de validar contra el límite.
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

      // orderBy explícito: findMany no garantiza orden, y el reparto FIFO de abajo necesita el más antiguo primero.
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
        // Regla del dueño (2026-11-20): el saldo a favor no se divide, se usa todo lo disponible o nada
        if (
          requestedCentsByCreditId.get(credit.id)! !== toCents(credit.balance)
        ) {
          throw new BadRequestException(
            `El saldo a favor se usa completo o no se usa. Saldo disponible: ${Number(credit.balance).toFixed(2)}`,
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

    // Cuadre exacto en centavos: toCents() ya redondea cada monto individual antes de sumar, así que cualquier descuadre es un error real, no ruido de coma flotante.
    const settledCents = creditsTotalCents + paymentsTotalCents;
    if (payablesTotalCents !== settledCents) {
      throw new BadRequestException(
        'El egreso no cuadra: la suma de los abonos debe ser igual a los saldos a favor más las formas de pago',
      );
    }

    // Hoy en huso Bogotá, no UTC: con toISOString() un egreso nocturno caía en el día siguiente.
    const todayStr = new Date().toLocaleDateString('sv-SE', {
      timeZone: 'America/Bogota',
    });
    const dateStr = dto.date ?? todayStr;
    if (dateStr > todayStr) {
      throw new BadRequestException('La fecha del egreso no puede ser futura');
    }

    // Número tomado como último bloqueo, después de accounts_payable y supplier_credit.
    const number = await this.sequenceService.next(tx, 'EGRESO');

    // total = settledCents (no la suma cruda) para que siempre cuadre con el CHECK total=cash_total+credit_total.
    const supplierPayment = await tx.supplierPayment.create({
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
      await tx.supplierPaymentMethod.createMany({
        data: paymentLines.map((payment) => ({
          supplierPaymentId: supplierPayment.id,
          method: payment.method,
          amount: payment.amount,
          reference: payment.reference,
          bank: payment.bank,
        })),
      });
    }

    // Reparto FIFO: cada CxP (de la más antigua a la más nueva) consume créditos hasta agotar lo que necesita o el crédito.
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
            supplierPaymentId: supplierPayment.id,
            amount: takeCents / 100,
          },
        });

        chunk.remainingCents -= takeCents;
        neededCents -= takeCents;
        creditUsedCents += takeCents;
      }

      await tx.supplierPaymentAllocation.create({
        data: {
          supplierPaymentId: supplierPayment.id,
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

    return tx.supplierPayment.findUniqueOrThrow({
      where: { id: supplierPayment.id },
      include: SUPPLIER_PAYMENT_DETAIL_INCLUDE,
    });
  }

  /** Revierte exactamente lo que hizo create(): resta cada abono a su CxP y devuelve cada saldo a favor usado; las filas hijas se conservan como historial. */
  async void(id: string, dto: VoidSupplierPaymentDto, user: JwtPayload) {
    return matchDetailContract(
      await this.prisma.$transaction(
        (tx) => this.voidInTransaction(tx, id, dto, user),
        { timeout: 30000 },
      ),
    );
  }

  private async voidInTransaction(
    tx: Prisma.TransactionClient,
    id: string,
    dto: VoidSupplierPaymentDto,
    user: JwtPayload,
  ) {
    const supplierPayment = await tx.supplierPayment.findUnique({
      where: { id },
      include: { allocations: true, creditApplications: true },
    });
    if (!supplierPayment) {
      throw new NotFoundException('Egreso no encontrado');
    }

    // Mismo orden de bloqueo que create(): accounts_payable -> supplier_credit.
    const payableIds = [
      ...new Set(supplierPayment.allocations.map((a) => a.accountPayableId)),
    ].sort();
    await tx.$queryRaw`SELECT id FROM "accounts_payable" WHERE id = ANY(${payableIds}::uuid[]) ORDER BY id FOR UPDATE`;

    const creditIds = [
      ...new Set(
        supplierPayment.creditApplications.map((a) => a.supplierCreditId),
      ),
    ].sort();
    await tx.$queryRaw`SELECT id FROM "supplier_credit" WHERE id = ANY(${creditIds}::uuid[]) ORDER BY id FOR UPDATE`;

    // Reclamo atómico: si dos anulaciones corren a la vez, la segunda ve count 0.
    const claimed = await tx.supplierPayment.updateMany({
      where: { id, voidedAt: null },
      data: {
        voidedAt: new Date(),
        voidedById: user.sub,
        voidReason: dto.reason,
        voidReasonOther:
          dto.reason === SupplierPaymentVoidReason.otro
            ? dto.reasonOther
            : null,
      },
    });
    if (claimed.count === 0) {
      throw new ConflictException('El egreso ya está anulado');
    }

    const payables = await tx.accountsPayable.findMany({
      where: { id: { in: payableIds } },
    });
    const payableById = new Map(payables.map((p) => [p.id, p]));

    for (const allocation of supplierPayment.allocations) {
      const payable = payableById.get(allocation.accountPayableId)!;
      const paidCents =
        toCents(payable.paidAmount) - toCents(allocation.amount);
      if (paidCents < 0) {
        throw new ConflictException(
          'No se puede anular: el abono supera lo pagado en una cuenta por pagar',
        );
      }
      const status =
        paidCents === 0
          ? AccountsPayableStatus.pending
          : paidCents >= toCents(payable.totalAmount)
            ? AccountsPayableStatus.paid
            : AccountsPayableStatus.partial;

      await tx.accountsPayable.update({
        where: { id: payable.id },
        data: { paidAmount: paidCents / 100, status },
      });
    }

    const returnedCentsByCreditId = new Map<string, number>();
    for (const application of supplierPayment.creditApplications) {
      returnedCentsByCreditId.set(
        application.supplierCreditId,
        (returnedCentsByCreditId.get(application.supplierCreditId) ?? 0) +
          toCents(application.amount),
      );
    }

    const credits = await tx.supplierCredit.findMany({
      where: { id: { in: creditIds } },
    });
    for (const credit of credits) {
      await tx.supplierCredit.update({
        where: { id: credit.id },
        data: {
          balance:
            (toCents(credit.balance) +
              returnedCentsByCreditId.get(credit.id)!) /
            100,
          status: 'available',
        },
      });
    }

    return tx.supplierPayment.findUniqueOrThrow({
      where: { id },
      include: SUPPLIER_PAYMENT_DETAIL_INCLUDE,
    });
  }

  async findAll(dto: FindAllSupplierPaymentsDto) {
    const { page = 1, limit = 20, supplierId, dateFrom, dateTo, number } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.SupplierPaymentWhereInput = {
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
      this.prisma.supplierPayment.findMany({
        where,
        select: {
          id: true,
          number: true,
          date: true,
          total: true,
          cashTotal: true,
          creditTotal: true,
          createdAt: true,
          voidedAt: true,
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
      this.prisma.supplierPayment.count({ where }),
    ]);

    return matchListContract({
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  async findOne(id: string) {
    const supplierPayment = await this.prisma.supplierPayment.findUnique({
      where: { id },
      include: SUPPLIER_PAYMENT_DETAIL_INCLUDE,
    });

    if (!supplierPayment) {
      throw new NotFoundException('Egreso no encontrado');
    }

    return matchDetailContract(supplierPayment);
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

    return matchOpenItemsContract({
      payables: payables.map((payable) => ({
        ...payable,
        balance: payable.totalAmount.minus(payable.paidAmount),
      })),
      credits,
    });
  }
}
