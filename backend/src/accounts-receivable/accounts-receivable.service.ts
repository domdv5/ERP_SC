import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

// El regex del DTO solo valida la forma (YYYY-MM-DD), no que la fecha exista. Un overflow de mes
// (13-01) da Invalid Date, pero un overflow de día (02-30) NO — Date lo corre al día siguiente en
// silencio (2026-02-30 -> 2026-03-02). Se detecta comparando la fecha reformateada contra el input.
function assertValidCalendarDate(label: string, value: string) {
  const date = new Date(`${value}T00:00:00.000-05:00`);
  const roundTrip = date.toLocaleDateString('sv-SE', {
    timeZone: 'America/Bogota',
  });
  if (Number.isNaN(date.getTime()) || roundTrip !== value) {
    throw new BadRequestException(`${label} no es una fecha válida`);
  }
}

// Bogotá es UTC-5 fijo (sin horario de verano) — mismo huso que usa EgresosService para "hoy".
// createdAt es timestamptz; el límite superior es el inicio del día siguiente en Bogotá, exclusivo.
function dateRangeFilter(dateFrom?: string, dateTo?: string) {
  return {
    ...(dateFrom && { gte: new Date(`${dateFrom}T00:00:00.000-05:00`) }),
    ...(dateTo && {
      lt: new Date(
        new Date(`${dateTo}T00:00:00.000-05:00`).getTime() +
          24 * 60 * 60 * 1000,
      ),
    }),
  };
}

/** Totales sobre el conjunto filtrado completo (no solo la página actual), mismo criterio de saldo que withDerivedFields. */
function buildTotals(totals: {
  _sum: {
    totalAmount: Prisma.Decimal | null;
    paidAmount: Prisma.Decimal | null;
  };
}) {
  const totalAmount = totals._sum.totalAmount ?? new Prisma.Decimal(0);
  const paidAmount = totals._sum.paidAmount ?? new Prisma.Decimal(0);
  return {
    totalAmount,
    paidAmount,
    balance: totalAmount.minus(paidAmount),
  };
}

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
      dateFrom,
      dateTo,
    } = findAllAccountsReceivableDto;
    if (dateFrom) assertValidCalendarDate('dateFrom', dateFrom);
    if (dateTo) assertValidCalendarDate('dateTo', dateTo);
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new BadRequestException('dateFrom no puede ser posterior a dateTo');
    }

    const skip = (page - 1) * limit;

    const where: Prisma.AccountsReceivableWhereInput = {
      ...(status && { status }),
      ...(clientId && { clientId }),
      ...(search && {
        client: {
          thirdParty: { name: { contains: search, mode: 'insensitive' } },
        },
      }),
      ...((dateFrom || dateTo) && {
        createdAt: dateRangeFilter(dateFrom, dateTo),
      }),
    };

    const [rawItems, total, totals] = await this.prisma.$transaction([
      this.prisma.accountsReceivable.findMany({
        where,
        include: LIST_INCLUDE,
        skip,
        take: limit,
        orderBy: { dueDate: { sort: 'asc', nulls: 'last' } },
      }),
      this.prisma.accountsReceivable.count({ where }),
      this.prisma.accountsReceivable.aggregate({
        where,
        _sum: { totalAmount: true, paidAmount: true },
      }),
    ]);

    return {
      items: rawItems.map(withDerivedFields),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totals: buildTotals(totals),
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
