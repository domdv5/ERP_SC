import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { FindAllAccountsReceivableDto } from './dto/index';

const LIST_INCLUDE = {
  client: { include: { thirdParty: { select: { id: true, name: true } } } },
  seller: { select: { id: true, name: true } },
  document: { select: { id: true, type: true, number: true, date: true } },
} satisfies Prisma.AccountsReceivableInclude;

const DETAIL_INCLUDE = {
  client: { include: { thirdParty: { select: { id: true, name: true } } } },
  seller: { select: { id: true, name: true } },
  document: { select: { id: true, type: true, number: true, date: true } },
  receivablePayments: { orderBy: { paymentDate: 'desc' } },
  reciboCajaAllocations: {
    include: {
      reciboCaja: { select: { id: true, number: true, date: true } },
    },
  },
} satisfies Prisma.AccountsReceivableInclude;

type ListRow = Prisma.AccountsReceivableGetPayload<{
  include: typeof LIST_INCLUDE;
}>;
type DetailRow = Prisma.AccountsReceivableGetPayload<{
  include: typeof DETAIL_INCLUDE;
}>;

/** Agrega el saldo derivado (totalAmount - paidAmount) sobre una fila, mismo patrón que AccountsPayableService. */
function withDerivedFields<
  T extends Pick<ListRow, 'totalAmount' | 'paidAmount'>,
>(row: T) {
  return {
    ...row,
    balance: row.totalAmount.minus(row.paidAmount),
  };
}

/** Combina receivablePayments (histórico, pre-Recibo de Caja) y reciboCajaAllocations en un único historial ordenado por fecha, mismo patrón que buildHistory de AccountsPayableService. */
function buildHistory(accountReceivable: DetailRow) {
  const fromRecibosCaja = accountReceivable.reciboCajaAllocations.map(
    (allocation) => ({
      source: 'recibo_caja' as const,
      date: allocation.reciboCaja.date,
      amount: allocation.amount,
      reciboCaja: allocation.reciboCaja,
    }),
  );

  const fromHistoricPayments = accountReceivable.receivablePayments.map(
    (payment) => ({
      source: 'pago_historico' as const,
      date: payment.paymentDate,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      reference: payment.reference,
    }),
  );

  return [...fromRecibosCaja, ...fromHistoricPayments].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
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

    const [rawItems, total] = await this.prisma.$transaction([
      this.prisma.accountsReceivable.findMany({
        where,
        include: LIST_INCLUDE,
        skip,
        take: limit,
        orderBy: { dueDate: { sort: 'asc', nulls: 'last' } },
      }),
      this.prisma.accountsReceivable.count({ where }),
    ]);

    return {
      items: rawItems.map(withDerivedFields),
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

    // receivablePayments/reciboCajaAllocations ya quedan resumidos en `history`
    // — no se devuelven crudos para no duplicar la misma info.
    const { receivablePayments, reciboCajaAllocations, ...rest } =
      accountReceivable;

    return {
      ...rest,
      balance: accountReceivable.totalAmount.minus(
        accountReceivable.paidAmount,
      ),
      history: buildHistory(accountReceivable),
    };
  }
}
