import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  AccountsReceivableStatus,
  CustomerCreditUsableIn,
  CustomerPaymentDiscountReason,
  CustomerPaymentVoidReason,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SequenceService } from '@/common/sequence/sequence.service';
import { matchContract } from '@/common/types';
import type { JwtPayload } from '@/common/types';
import type {
  CustomerPayment,
  CustomerPaymentListResponse,
  CustomerPaymentOpenItems,
} from '@/contracts';
import { toCents } from '@/common/utils/money.util';
import { CreateCustomerPaymentDto } from './dto/create-customer-payment.dto';
import { VoidCustomerPaymentDto } from './dto/void-customer-payment.dto';
import { FindAllCustomerPaymentsDto } from './dto/find-all-customer-payments.dto';
import { NO_BRANCH_FILTER } from './dto/find-open-items.dto';

const matchListContract = matchContract<CustomerPaymentListResponse>();
const matchDetailContract = matchContract<CustomerPayment>();
const matchOpenItemsContract = matchContract<CustomerPaymentOpenItems>();

export const CUSTOMER_PAYMENT_DETAIL_INCLUDE = {
  client: { include: { thirdParty: { select: { id: true, name: true } } } },
  customerBranch: { select: { id: true, name: true } },
  user: { select: { id: true, name: true } },
  voidedBy: { select: { id: true, name: true } },
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
  creditApplications: {
    select: {
      id: true,
      amount: true,
      customerCreditId: true,
      accountReceivableId: true,
      accountReceivable: {
        select: {
          id: true,
          document: { select: { id: true, type: true, number: true } },
        },
      },
      customerCredit: {
        select: {
          id: true,
          kind: true,
          amount: true,
          date: true,
          sourceDocument: {
            select: { id: true, type: true, number: true, date: true },
          },
        },
      },
    },
  },
} satisfies Prisma.CustomerPaymentInclude;

type ExistingCustomerPaymentForIdempotency = {
  clientId: string;
  customerBranchId: string | null;
  total: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  discountReason: CustomerPaymentDiscountReason | null;
  allocations: { accountReceivableId: string; amount: Prisma.Decimal }[];
  creditApplications: { customerCreditId: string; amount: Prisma.Decimal }[];
};

/** Suma los montos por id en centavos: una línea repetida en el body se valida como una sola. */
function sumCentsById<T>(
  lines: T[],
  idOf: (line: T) => string,
  amountOf: (line: T) => number,
): Map<string, number> {
  const centsById = new Map<string, number>();
  for (const line of lines) {
    const id = idOf(line);
    centsById.set(id, (centsById.get(id) ?? 0) + toCents(amountOf(line)));
  }
  return centsById;
}

function sameCents(
  requested: Map<string, number>,
  existing: Map<string, number>,
): boolean {
  if (requested.size !== existing.size) return false;
  for (const [id, cents] of requested) {
    if (existing.get(id) !== cents) return false;
  }
  return true;
}

// Motivos que pueden saldar toda la deuda sin que entre dinero.
const FULL_COVER_DISCOUNT_REASONS: CustomerPaymentDiscountReason[] = [
  CustomerPaymentDiscountReason.castigo_cartera,
  CustomerPaymentDiscountReason.mercancia_extraviada,
];

/** Reparte el descuento entre las líneas proporcional a su abono; los centavos sobrantes van a los residuos más grandes para que la suma sea exacta. */
function splitDiscountCents(
  discountCents: number,
  amountCentsById: Map<string, number>,
): Map<string, number> {
  const totalCents = [...amountCentsById.values()].reduce(
    (sum, cents) => sum + cents,
    0,
  );
  const shares = [...amountCentsById].map(([id, cents]) => {
    const exact = (discountCents * cents) / totalCents;
    return { id, cents: Math.floor(exact), remainder: exact % 1 };
  });
  let leftover =
    discountCents - shares.reduce((sum, share) => sum + share.cents, 0);
  for (const share of [...shares].sort(
    (first, second) => second.remainder - first.remainder,
  )) {
    if (leftover === 0) break;
    share.cents += 1;
    leftover -= 1;
  }
  return new Map(shares.map((share) => [share.id, share.cents]));
}

/** Compara el reintento contra el recibo ya guardado con la misma idempotencyKey: receivables exacto, payments solo por total (el reparto interno lo decide el service). Mismo patrón que isSameSupplierPaymentRequest de SupplierPaymentsService. */
function isSameCustomerPaymentRequest(
  dto: CreateCustomerPaymentDto,
  existing: ExistingCustomerPaymentForIdempotency,
): boolean {
  if (existing.clientId !== dto.clientId) {
    return false;
  }
  if (existing.customerBranchId !== (dto.customerBranchId ?? null)) {
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
    existing.allocations.map((allocation) => [
      allocation.accountReceivableId,
      toCents(allocation.amount),
    ]),
  );

  if (
    toCents(existing.discountAmount) !== toCents(dto.discount?.amount ?? 0) ||
    existing.discountReason !== (dto.discount?.reason ?? null)
  ) {
    return false;
  }

  const requestedCredits = sumCentsById(
    dto.credits ?? [],
    (line) => line.customerCreditId,
    (line) => line.amount,
  );
  // Un saldo repartido en varias CxC se guarda en varias filas: se suman por saldo
  const existingCredits = sumCentsById(
    existing.creditApplications,
    (application) => application.customerCreditId,
    (application) => Number(application.amount),
  );
  if (!sameCents(requestedCredits, existingCredits)) {
    return false;
  }

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
export class CustomerPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequenceService: SequenceService,
  ) {}

  /** Cobra una o varias CxC de un cliente: cuadre exacto (Σ abonos = Σ formas de pago + descuento, sin saldo a favor — regla de negocio explícita), idempotente por idempotencyKey. */
  async create(dto: CreateCustomerPaymentDto, user: JwtPayload) {
    // Corto circuito rápido antes de la transacción pesada: la mayoría de los
    // reintentos (doble clic) llegan bien después de que el primero ya terminó.
    const alreadyCreated = await this.prisma.customerPayment.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: CUSTOMER_PAYMENT_DETAIL_INCLUDE,
    });
    if (alreadyCreated) {
      if (!isSameCustomerPaymentRequest(dto, alreadyCreated)) {
        throw new ConflictException(
          'Esta clave de idempotencia ya se usó para un recibo de caja distinto',
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
        const existing = await this.prisma.customerPayment.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
          include: CUSTOMER_PAYMENT_DETAIL_INCLUDE,
        });
        if (existing) {
          if (!isSameCustomerPaymentRequest(dto, existing)) {
            throw new ConflictException(
              'Esta clave de idempotencia ya se usó para un recibo de caja distinto',
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
    dto: CreateCustomerPaymentDto,
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

    // Orden de bloqueo global: customer_credit -> accounts_receivable -> sequence (el mismo que usa la venta al aplicar saldos).
    const creditCentsById = sumCentsById(
      dto.credits ?? [],
      (line) => line.customerCreditId,
      (line) => line.amount,
    );
    const customerCreditIds = [...creditCentsById.keys()].sort();
    if (customerCreditIds.length > 0) {
      await tx.$queryRaw`SELECT id FROM "customer_credit" WHERE id = ANY(${customerCreditIds}::uuid[]) ORDER BY id FOR UPDATE`;
    }

    const accountReceivableIds = [
      ...new Set(dto.receivables.map((line) => line.accountReceivableId)),
    ].sort();
    await tx.$queryRaw`SELECT id FROM "accounts_receivable" WHERE id = ANY(${accountReceivableIds}::uuid[]) ORDER BY id FOR UPDATE`;

    // Re-chequeo tras el lock: un recibo concurrente con la misma idempotencyKey pudo
    // haber comprometido mientras esperábamos el FOR UPDATE — sin esto, el segundo
    // request choca contra "ya está totalmente pagada" en vez de recibir el mismo recibo.
    const concurrentlyCreated = await tx.customerPayment.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: CUSTOMER_PAYMENT_DETAIL_INCLUDE,
    });
    if (concurrentlyCreated) {
      if (!isSameCustomerPaymentRequest(dto, concurrentlyCreated)) {
        throw new ConflictException(
          'Esta clave de idempotencia ya se usó para un recibo de caja distinto',
        );
      }
      return concurrentlyCreated;
    }

    const receivables = await tx.accountsReceivable.findMany({
      where: { id: { in: accountReceivableIds } },
      include: {
        document: { select: { number: true, customerBranchId: true } },
      },
      // El id desempata CxC creadas en el mismo instante: el reparto del saldo no cambia entre ejecuciones
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    if (receivables.length !== accountReceivableIds.length) {
      throw new BadRequestException(
        'Alguna cuenta por cobrar citada no existe',
      );
    }

    await this.assertValidBranch(
      tx,
      client.id,
      dto.customerBranchId,
      receivables,
    );

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

    const credits = await this.findUsableCredits(
      tx,
      client.id,
      dto.customerBranchId ?? null,
      creditCentsById,
    );
    const creditsTotalCents = [...creditCentsById.values()].reduce(
      (sum, cents) => sum + cents,
      0,
    );

    const discountCents = dto.discount ? toCents(dto.discount.amount) : 0;
    let debtBeforeReceiptCents = 0;

    const receivableById = new Map(
      receivables.map((receivable) => [receivable.id, receivable]),
    );
    for (const [receivableId, requestedCents] of requestedCentsByReceivableId) {
      const receivable = receivableById.get(receivableId)!;
      const balanceCents =
        toCents(receivable.totalAmount) - toCents(receivable.paidAmount);
      debtBeforeReceiptCents += balanceCents;
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
      // El descuento solo se da sobre el total: no existe descuento en abonos parciales.
      if (discountCents > 0 && requestedCents !== balanceCents) {
        throw new BadRequestException(
          'El descuento solo aplica si se pagan las facturas completas',
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
    if (
      receivablesTotalCents !==
      paymentsTotalCents + creditsTotalCents + discountCents
    ) {
      const parts = ['las formas de pago'];
      if (creditsTotalCents > 0) parts.push('los saldos a favor');
      if (discountCents > 0) parts.push('el descuento');
      const last = parts.pop()!;
      const expected =
        parts.length > 0 ? `${parts.join(', ')} más ${last}` : last;
      throw new BadRequestException(
        `El recibo de caja no cuadra: la suma de los abonos debe ser igual a ${expected}`,
      );
    }

    if (
      dto.discount &&
      discountCents >= receivablesTotalCents &&
      !FULL_COVER_DISCOUNT_REASONS.includes(dto.discount.reason)
    ) {
      throw new BadRequestException(
        'Solo Castigo de Cartera o Mercancía Extraviada pueden cubrir el total de la deuda',
      );
    }

    const discountCentsByReceivableId =
      discountCents > 0
        ? splitDiscountCents(discountCents, requestedCentsByReceivableId)
        : new Map<string, number>();

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

    const customerPayment = await tx.customerPayment.create({
      data: {
        number,
        date: new Date(dateStr),
        clientId: client.id,
        customerBranchId: dto.customerBranchId ?? null,
        userId: user.sub,
        total: paymentsTotalCents / 100,
        discountAmount: discountCents / 100,
        discountReason: discountCents > 0 ? dto.discount!.reason : null,
        debtBeforeReceipt: debtBeforeReceiptCents / 100,
        notes: dto.notes,
        idempotencyKey: dto.idempotencyKey,
      },
    });

    if (paymentLines.length > 0) {
      await tx.customerPaymentMethod.createMany({
        data: paymentLines.map((payment) => ({
          customerPaymentId: customerPayment.id,
          method: payment.method,
          // toCents()/100, no el monto crudo del cliente: así la suma de payments
          // siempre cuadra exacto con `total` (que ya se calculó en centavos redondeados).
          amount: toCents(payment.amount) / 100,
          reference: payment.reference,
          bank: payment.bank,
        })),
      });
    }

    // Reparto igual que egresos: cada CxC (más antigua primero) consume saldos (más antiguo primero) sobre lo que queda tras su descuento.
    const creditQueue = [...credits]
      .sort(
        (first, second) =>
          first.createdAt.getTime() - second.createdAt.getTime() ||
          first.id.localeCompare(second.id),
      )
      .map((credit) => ({
        id: credit.id,
        remainingCents: creditCentsById.get(credit.id)!,
      }));

    for (const receivable of receivables) {
      const amountCents = requestedCentsByReceivableId.get(receivable.id);
      if (amountCents === undefined) continue;

      const discountShareCents =
        discountCentsByReceivableId.get(receivable.id) ?? 0;
      let neededCents = amountCents - discountShareCents;
      let creditUsedCents = 0;

      for (const chunk of creditQueue) {
        if (neededCents <= 0) break;
        if (chunk.remainingCents <= 0) continue;

        const takeCents = Math.min(neededCents, chunk.remainingCents);
        await tx.customerCreditApplication.create({
          data: {
            customerCreditId: chunk.id,
            customerPaymentId: customerPayment.id,
            accountReceivableId: receivable.id,
            amount: takeCents / 100,
          },
        });

        chunk.remainingCents -= takeCents;
        neededCents -= takeCents;
        creditUsedCents += takeCents;
      }

      await tx.customerPaymentAllocation.create({
        data: {
          customerPaymentId: customerPayment.id,
          accountReceivableId: receivable.id,
          amount: amountCents / 100,
          discountAmount: discountShareCents / 100,
          creditAmount: creditUsedCents / 100,
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

    // El cuadre (pagos + saldos + descuento = abonos) garantiza que todo el saldo pedido se consumió.
    if (creditQueue.some((chunk) => chunk.remainingCents > 0)) {
      throw new BadRequestException(
        'El saldo a favor supera lo que queda por cubrir de las cuentas',
      );
    }

    for (const credit of credits) {
      const usedCents = creditCentsById.get(credit.id)!;
      const newBalanceCents = toCents(credit.balance) - usedCents;
      await tx.customerCredit.update({
        where: { id: credit.id },
        data: {
          balance: newBalanceCents / 100,
          status: newBalanceCents <= 0 ? 'used' : 'available',
        },
      });
    }

    return tx.customerPayment.findUniqueOrThrow({
      where: { id: customerPayment.id },
      include: CUSTOMER_PAYMENT_DETAIL_INCLUDE,
    });
  }

  async void(id: string, dto: VoidCustomerPaymentDto, user: JwtPayload) {
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
    dto: VoidCustomerPaymentDto,
    user: JwtPayload,
  ) {
    const customerPayment = await tx.customerPayment.findUnique({
      where: { id },
      include: { allocations: true, creditApplications: true },
    });
    if (!customerPayment) {
      throw new NotFoundException('Recibo de caja no encontrado');
    }

    // Mismo orden de bloqueo que create(): customer_credit -> accounts_receivable.
    const customerCreditIds = [
      ...new Set(
        customerPayment.creditApplications.map(
          (application) => application.customerCreditId,
        ),
      ),
    ].sort();
    await tx.$queryRaw`SELECT id FROM "customer_credit" WHERE id = ANY(${customerCreditIds}::uuid[]) ORDER BY id FOR UPDATE`;

    const accountReceivableIds = [
      ...new Set(
        customerPayment.allocations.map(
          (allocation) => allocation.accountReceivableId,
        ),
      ),
    ].sort();
    await tx.$queryRaw`SELECT id FROM "accounts_receivable" WHERE id = ANY(${accountReceivableIds}::uuid[]) ORDER BY id FOR UPDATE`;

    // Reclamo atómico: si dos anulaciones corren a la vez, la segunda ve count 0.
    const claimed = await tx.customerPayment.updateMany({
      where: { id, voidedAt: null },
      data: {
        voidedAt: new Date(),
        voidedById: user.sub,
        voidReason: dto.reason,
        voidReasonOther:
          dto.reason === CustomerPaymentVoidReason.otro
            ? dto.reasonOther
            : null,
      },
    });
    if (claimed.count === 0) {
      throw new ConflictException('El recibo de caja ya está anulado');
    }

    const receivables = await tx.accountsReceivable.findMany({
      where: { id: { in: accountReceivableIds } },
    });
    const receivableById = new Map(
      receivables.map((receivable) => [receivable.id, receivable]),
    );

    // allocation.amount ya incluye pago + descuento + saldo a favor de esa CxC
    for (const allocation of customerPayment.allocations) {
      const receivable = receivableById.get(allocation.accountReceivableId)!;
      const paidCents =
        toCents(receivable.paidAmount) - toCents(allocation.amount);
      if (paidCents < 0) {
        throw new ConflictException(
          'No se puede anular: el abono supera lo pagado en una cuenta por cobrar',
        );
      }
      const status =
        paidCents === 0
          ? AccountsReceivableStatus.pending
          : paidCents >= toCents(receivable.totalAmount)
            ? AccountsReceivableStatus.paid
            : AccountsReceivableStatus.partial;

      await tx.accountsReceivable.update({
        where: { id: receivable.id },
        data: { paidAmount: paidCents / 100, status },
      });
    }

    const returnedCentsByCreditId = new Map<string, number>();
    for (const application of customerPayment.creditApplications) {
      returnedCentsByCreditId.set(
        application.customerCreditId,
        (returnedCentsByCreditId.get(application.customerCreditId) ?? 0) +
          toCents(application.amount),
      );
    }

    const credits = await tx.customerCredit.findMany({
      where: { id: { in: customerCreditIds } },
    });
    for (const credit of credits) {
      await tx.customerCredit.update({
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

    return tx.customerPayment.findUniqueOrThrow({
      where: { id },
      include: CUSTOMER_PAYMENT_DETAIL_INCLUDE,
    });
  }

  /** Valida los saldos a favor de administración citados (ya bloqueados): del cliente, de la misma sucursal del recibo, disponibles y usados por todo su saldo. */
  private async findUsableCredits(
    tx: Prisma.TransactionClient,
    clientId: string,
    customerBranchId: string | null,
    requestedCentsById: Map<string, number>,
  ) {
    if (requestedCentsById.size === 0) return [];

    const credits = await tx.customerCredit.findMany({
      where: { id: { in: [...requestedCentsById.keys()] } },
    });
    if (credits.length !== requestedCentsById.size) {
      throw new BadRequestException('Algún saldo a favor citado no existe');
    }

    for (const credit of credits) {
      if (credit.customerId !== clientId) {
        throw new BadRequestException(
          'El saldo a favor no pertenece a este cliente',
        );
      }
      if (credit.usableIn !== CustomerCreditUsableIn.administracion) {
        throw new BadRequestException(
          'Este saldo a favor es de facturación: solo se usa en una venta',
        );
      }
      if (credit.status !== 'available') {
        throw new BadRequestException('El saldo a favor ya no está disponible');
      }
      // Cada sucursal maneja sus propias cuentas: sin sucursal solo paga CxC sin sucursal.
      if (credit.customerBranchId !== customerBranchId) {
        throw new BadRequestException(
          'El saldo a favor pertenece a otra sucursal: solo se aplica a facturas de su sucursal',
        );
      }
      // Regla del dueño (2026-11-20): el saldo a favor no se divide, se usa todo lo disponible o nada
      if (requestedCentsById.get(credit.id)! !== toCents(credit.balance)) {
        throw new BadRequestException(
          `El saldo a favor se usa completo o no se usa. Saldo disponible: ${Number(credit.balance).toFixed(2)}`,
        );
      }
    }

    return credits;
  }

  /** La sucursal del recibo debe ser del cliente y coincidir con la de cada CxC citada (ambas null = sin sucursal). */
  private async assertValidBranch(
    tx: Prisma.TransactionClient,
    clientId: string,
    customerBranchId: string | undefined,
    receivables: {
      clientId: string;
      document: { number: string | null; customerBranchId: string | null };
    }[],
  ) {
    const branchId = customerBranchId ?? null;

    if (branchId) {
      const branch = await tx.customerBranch.findFirst({
        where: { id: branchId, customerId: clientId },
        select: { id: true },
      });
      if (!branch) {
        throw new BadRequestException('La sucursal no pertenece al cliente');
      }
    }

    for (const receivable of receivables) {
      if (receivable.clientId !== clientId) continue;
      if (receivable.document.customerBranchId !== branchId) {
        const label = receivable.document.number
          ? `La factura ${receivable.document.number}`
          : 'Una cuenta por cobrar citada';
        throw new BadRequestException(
          branchId
            ? `${label} no pertenece a la sucursal seleccionada`
            : `${label} pertenece a una sucursal: seleccione la sucursal del recibo`,
        );
      }
    }
  }

  async findAll(dto: FindAllCustomerPaymentsDto) {
    const {
      page = 1,
      limit = 20,
      clientId,
      customerBranchId,
      dateFrom,
      dateTo,
      number,
    } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerPaymentWhereInput = {
      ...(clientId && { clientId }),
      ...(customerBranchId && { customerBranchId }),
      ...(number && { number: { contains: number } }),
      ...((dateFrom || dateTo) && {
        date: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.customerPayment.findMany({
        where,
        select: {
          id: true,
          number: true,
          date: true,
          total: true,
          discountAmount: true,
          createdAt: true,
          voidedAt: true,
          customerBranch: { select: { id: true, name: true } },
          client: {
            include: { thirdParty: { select: { id: true, name: true } } },
          },
          creditApplications: { select: { amount: true } },
        },
        skip,
        take: limit,
        // El consecutivo ya viene con ceros a la izquierda: ordenar por el
        // string da el mismo orden que ordenar por el número real.
        orderBy: { number: 'desc' },
      }),
      this.prisma.customerPayment.count({ where }),
    ]);

    return matchListContract({
      items: items.map(({ creditApplications, ...customerPayment }) => ({
        ...customerPayment,
        cashTotal: customerPayment.total,
        creditTotal: creditApplications.reduce(
          (sum, application) => sum.plus(application.amount),
          new Prisma.Decimal(0),
        ),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  async findOne(id: string) {
    const customerPayment = await this.prisma.customerPayment.findUnique({
      where: { id },
      include: CUSTOMER_PAYMENT_DETAIL_INCLUDE,
    });

    if (!customerPayment) {
      throw new NotFoundException('Recibo de caja no encontrado');
    }

    return matchDetailContract(customerPayment);
  }

  /** CxC abiertas y saldos a favor de administración disponibles de un cliente (credits y devoluciones), para armar el formulario de recibo de caja. */
  async findOpenItems(clientId: string, customerBranchId?: string) {
    const receivables = await this.prisma.accountsReceivable.findMany({
      where: {
        clientId,
        status: { not: AccountsReceivableStatus.paid },
        ...(customerBranchId && {
          document: {
            customerBranchId:
              customerBranchId === NO_BRANCH_FILTER ? null : customerBranchId,
          },
        }),
      },
      include: {
        document: {
          select: {
            id: true,
            type: true,
            number: true,
            date: true,
            customerBranch: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const credits = await this.prisma.customerCredit.findMany({
      where: {
        customerId: clientId,
        usableIn: CustomerCreditUsableIn.administracion,
        status: 'available',
        ...(customerBranchId && {
          customerBranchId:
            customerBranchId === NO_BRANCH_FILTER ? null : customerBranchId,
        }),
      },
      select: {
        id: true,
        amount: true,
        balance: true,
        date: true,
        createdAt: true,
        kind: true,
        usableIn: true,
        customerBranchId: true,
        sourceDocument: {
          select: { id: true, type: true, number: true, date: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return matchOpenItemsContract({
      receivables: receivables.map((receivable) => ({
        ...receivable,
        balance: receivable.totalAmount.minus(receivable.paidAmount),
      })),
      // Las devoluciones no tienen `date` propia: se muestra la fecha de la DVV.
      credits: credits.map(({ createdAt, ...credit }) => ({
        ...credit,
        date: credit.date ?? credit.sourceDocument?.date ?? createdAt,
      })),
    });
  }
}
