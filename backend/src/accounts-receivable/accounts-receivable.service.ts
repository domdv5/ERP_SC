import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  FindAllAccountsReceivableDto,
  RegisterReceivablePaymentDto,
} from './dto/index';

const DETAIL_INCLUDE = {
  client: { include: { thirdParty: { select: { id: true, name: true } } } },
  seller: { select: { id: true, name: true } },
  document: { select: { id: true, type: true, number: true, date: true } },
  receivablePayments: { orderBy: { paymentDate: 'desc' } },
} satisfies Prisma.AccountsReceivableInclude;

/** Convierte a centavos enteros para comparar montos sin errores de punto flotante. */
function toCents(amount: number | Prisma.Decimal) {
  return Math.round(Number(amount) * 100);
}

@Injectable()
export class AccountsReceivableService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(findAllAccountsReceivableDto: FindAllAccountsReceivableDto) {
    const {
      page = 1,
      limit = 20,
      status,
      clientId,
      search,
    } = findAllAccountsReceivableDto;
    const skip = (page - 1) * limit;

    const where: Prisma.AccountsReceivableWhereInput = {
      ...(status && { status }),
      ...(clientId && { clientId }),
      ...(search && {
        client: {
          thirdParty: { name: { contains: search, mode: 'insensitive' } },
        },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.accountsReceivable.findMany({
        where,
        include: {
          client: {
            include: { thirdParty: { select: { id: true, name: true } } },
          },
          seller: { select: { id: true, name: true } },
          document: {
            select: { id: true, type: true, number: true, date: true },
          },
        },
        skip,
        take: limit,
        orderBy: { dueDate: { sort: 'asc', nulls: 'last' } },
      }),
      this.prisma.accountsReceivable.count({ where }),
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
    const accountReceivable = await this.prisma.accountsReceivable.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });

    if (!accountReceivable) {
      throw new NotFoundException('Cuenta por cobrar no encontrada');
    }

    return accountReceivable;
  }

  async registerPayment(
    id: string,
    registerReceivablePaymentDto: RegisterReceivablePaymentDto,
  ) {
    const { amount, paymentDate, paymentMethod, reference } =
      registerReceivablePaymentDto;

    return this.prisma.$transaction(
      async (tx) => {
        // Bloquea la fila hasta que la transacción termine, serializando pagos
        // concurrentes sobre la misma cuenta y evitando que dos pagos simultáneos
        // se validen ambos contra el mismo saldo pendiente (overpayment por race condition).
        await tx.$queryRaw`SELECT id FROM "accounts_receivable" WHERE id = ${id} FOR UPDATE`;

        const accountReceivable = await tx.accountsReceivable.findUnique({
          where: { id },
          include: { receivablePayments: true },
        });

        if (!accountReceivable) {
          throw new NotFoundException('Cuenta por cobrar no encontrada');
        }

        const paidSoFarCents = accountReceivable.receivablePayments.reduce(
          (sum, payment) => sum + toCents(payment.amount),
          0,
        );
        const amountCents = toCents(amount);
        const totalCents = toCents(accountReceivable.totalAmount);

        if (paidSoFarCents + amountCents > totalCents) {
          const availableCents = totalCents - paidSoFarCents;
          throw new BadRequestException(
            `El pago excede el saldo pendiente. Saldo disponible: ${(availableCents / 100).toFixed(2)}`,
          );
        }

        await tx.receivablePayment.create({
          data: {
            accountReceivableId: id,
            amount,
            paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
            paymentMethod,
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

        return tx.accountsReceivable.update({
          where: { id },
          data: { status },
          include: DETAIL_INCLUDE,
        });
      },
      { timeout: 30000 },
    );
  }
}
