import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  FindAllAccountsPayableDto,
  FindAvailableCreditsDto,
  RegisterPayablePaymentDto,
} from './dto/index';

const DETAIL_INCLUDE = {
  supplier: { include: { thirdParty: { select: { id: true, name: true } } } },
  document: { select: { id: true, type: true, number: true, date: true } },
  payablePayments: { orderBy: { paymentDate: 'desc' } },
  creditApplications: {
    include: { supplierCredit: true },
    orderBy: { appliedAt: 'desc' },
  },
} satisfies Prisma.AccountsPayableInclude;

/** Convierte a centavos enteros para comparar montos sin errores de punto flotante. */
function toCents(amount: number | Prisma.Decimal) {
  return Math.round(Number(amount) * 100);
}

@Injectable()
export class AccountsPayableService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(findAllAccountsPayableDto: FindAllAccountsPayableDto) {
    const {
      page = 1,
      limit = 20,
      status,
      supplierId,
      search,
    } = findAllAccountsPayableDto;
    const skip = (page - 1) * limit;

    const where: Prisma.AccountsPayableWhereInput = {
      ...(status && { status }),
      ...(supplierId && { supplierId }),
      ...(search && {
        supplier: {
          thirdParty: { name: { contains: search, mode: 'insensitive' } },
        },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.accountsPayable.findMany({
        where,
        include: {
          supplier: {
            include: { thirdParty: { select: { id: true, name: true } } },
          },
          document: {
            select: { id: true, type: true, number: true, date: true },
          },
        },
        skip,
        take: limit,
        orderBy: { dueDate: { sort: 'asc', nulls: 'last' } },
      }),
      this.prisma.accountsPayable.count({ where }),
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
    const accountPayable = await this.prisma.accountsPayable.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });

    if (!accountPayable) {
      throw new NotFoundException('Cuenta por pagar no encontrada');
    }

    return accountPayable;
  }

  async registerPayment(
    id: string,
    registerPayablePaymentDto: RegisterPayablePaymentDto,
  ) {
    const {
      amount,
      paymentDate,
      paymentMethod,
      bankDestination,
      reference,
      creditApplications = [],
    } = registerPayablePaymentDto;

    return this.prisma.$transaction(
      async (tx) => {
        // Bloquea la fila hasta que la transacción termine, serializando pagos
        // concurrentes sobre la misma cuenta y evitando que dos pagos simultáneos
        // se validen ambos contra el mismo saldo pendiente (overpayment por race condition).
        await tx.$queryRaw`SELECT id FROM "accounts_payable" WHERE id = ${id} FOR UPDATE`;

        const accountPayable = await tx.accountsPayable.findUnique({
          where: { id },
          include: { payablePayments: true, creditApplications: true },
        });

        if (!accountPayable) {
          throw new NotFoundException('Cuenta por pagar no encontrada');
        }

        const amountCents = toCents(amount);

        // Agrupa por crédito para validar el saldo contra el total solicitado en
        // esta transacción — si el mismo crédito aparece dos veces en el payload,
        // validar cada línea por separado dejaría pasar una sobre-aplicación que
        // solo se nota al sumar ambas.
        const requestedCentsByCreditId = new Map<string, number>();
        for (const application of creditApplications) {
          const previous =
            requestedCentsByCreditId.get(application.supplierCreditId) ?? 0;
          requestedCentsByCreditId.set(
            application.supplierCreditId,
            previous + toCents(application.amount),
          );
        }
        const applicationsCents = [...requestedCentsByCreditId.values()].reduce(
          (sum, cents) => sum + cents,
          0,
        );
        const settledCents = amountCents + applicationsCents;

        if (settledCents <= 0) {
          throw new BadRequestException(
            'El pago debe incluir efectivo o al menos una aplicación de nota crédito mayor a cero',
          );
        }

        let credits: {
          id: string;
          balance: Prisma.Decimal;
          supplierId: string;
        }[] = [];

        if (requestedCentsByCreditId.size > 0) {
          const creditIds = [...requestedCentsByCreditId.keys()];

          // Bloquea la AP (arriba) primero y luego los créditos ordenados por id,
          // siempre en el mismo orden relativo, para no deadlockear con otra
          // transacción que aplique los mismos créditos en paralelo.
          await tx.$queryRaw`SELECT id FROM "supplier_credit" WHERE id = ANY(${creditIds}::uuid[]) ORDER BY id FOR UPDATE`;

          credits = await tx.supplierCredit.findMany({
            where: { id: { in: creditIds } },
          });

          if (credits.length !== creditIds.length) {
            throw new BadRequestException(
              'Alguna nota crédito citada no existe',
            );
          }

          for (const credit of credits) {
            if (credit.supplierId !== accountPayable.supplierId) {
              throw new BadRequestException(
                'La nota crédito no pertenece al proveedor de esta cuenta por pagar',
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

        // paidSoFar ahora suma dos fuentes: efectivo real (payablePayments) y
        // saldo neteado sin caja (creditApplications) — ver Plan 020, Opción B.
        const paidSoFarCents =
          accountPayable.payablePayments.reduce(
            (sum, payment) => sum + toCents(payment.amount),
            0,
          ) +
          accountPayable.creditApplications.reduce(
            (sum, application) => sum + toCents(application.amount),
            0,
          );
        const totalCents = toCents(accountPayable.totalAmount);

        if (paidSoFarCents + settledCents > totalCents) {
          const availableCents = totalCents - paidSoFarCents;
          throw new BadRequestException(
            `El pago excede el saldo pendiente. Saldo disponible: ${(availableCents / 100).toFixed(2)}`,
          );
        }

        if (amountCents > 0) {
          await tx.payablePayment.create({
            data: {
              accountPayableId: id,
              amount,
              paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
              paymentMethod,
              bankDestination,
              reference,
            },
          });
        }

        for (const application of creditApplications) {
          await tx.supplierCreditApplication.create({
            data: {
              supplierCreditId: application.supplierCreditId,
              accountPayableId: id,
              amount: application.amount,
            },
          });
        }

        for (const credit of credits) {
          const requestedCents = requestedCentsByCreditId.get(credit.id)!;
          const newBalanceCents = toCents(credit.balance) - requestedCents;

          await tx.supplierCredit.update({
            where: { id: credit.id },
            data: {
              balance: newBalanceCents / 100,
              status: newBalanceCents <= 0 ? 'used' : 'available',
            },
          });
        }

        // Recalcula el status a partir del total saldado (efectivo + crédito) tras este movimiento.
        const newPaidCents = paidSoFarCents + settledCents;
        const status =
          newPaidCents >= totalCents
            ? 'paid'
            : newPaidCents > 0
              ? 'partial'
              : 'pending';

        return tx.accountsPayable.update({
          where: { id },
          data: { status },
          include: DETAIL_INCLUDE,
        });
      },
      { timeout: 30000 },
    );
  }

  /** Créditos de proveedor con saldo disponible para aplicar contra un pago. */
  async findAvailableCredits(findAvailableCreditsDto: FindAvailableCreditsDto) {
    const { supplierId } = findAvailableCreditsDto;

    return this.prisma.supplierCredit.findMany({
      where: { supplierId, status: 'available', balance: { gt: 0 } },
      orderBy: { createdAt: 'asc' },
    });
  }
}
