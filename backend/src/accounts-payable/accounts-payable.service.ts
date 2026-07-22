import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  FindAllAccountsPayableDto,
  RegisterPayablePaymentDto,
} from './dto/index';

const DETAIL_INCLUDE = {
  supplier: { include: { thirdParty: { select: { id: true, name: true } } } },
  document: { select: { id: true, type: true, number: true, date: true } },
  payablePayments: { orderBy: { paymentDate: 'desc' } },
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
    const { amount, paymentDate, paymentMethod, bankDestination, reference } =
      registerPayablePaymentDto;

    return this.prisma.$transaction(
      async (tx) => {
        // Bloquea la fila hasta que la transacción termine, serializando pagos
        // concurrentes sobre la misma cuenta y evitando que dos pagos simultáneos
        // se validen ambos contra el mismo saldo pendiente (overpayment por race condition).
        await tx.$queryRaw`SELECT id FROM "accounts_payable" WHERE id = ${id} FOR UPDATE`;

        const accountPayable = await tx.accountsPayable.findUnique({
          where: { id },
          include: { payablePayments: true },
        });

        if (!accountPayable) {
          throw new NotFoundException('Cuenta por pagar no encontrada');
        }

        const paidSoFarCents = accountPayable.payablePayments.reduce(
          (sum, payment) => sum + toCents(payment.amount),
          0,
        );
        const amountCents = toCents(amount);
        const totalCents = toCents(accountPayable.totalAmount);

        if (paidSoFarCents + amountCents > totalCents) {
          const availableCents = totalCents - paidSoFarCents;
          throw new BadRequestException(
            `El pago excede el saldo pendiente. Saldo disponible: ${(availableCents / 100).toFixed(2)}`,
          );
        }

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

        // Recalcula el status a partir del total pagado tras este pago.
        const newPaidCents = paidSoFarCents + amountCents;
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
}
