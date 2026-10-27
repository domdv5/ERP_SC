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
  document: {
    select: {
      id: true,
      type: true,
      number: true,
      date: true,
      customerBranchId: true,
      customerBranch: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.AccountsReceivableInclude;

const DETAIL_INCLUDE = {
  client: { include: { thirdParty: { select: { id: true, name: true } } } },
  seller: { select: { id: true, name: true } },
  document: {
    select: {
      id: true,
      type: true,
      number: true,
      date: true,
      customerBranch: { select: { id: true, name: true } },
    },
  },
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

// Filtra sobre document.date (lo que muestra la columna "Fecha venta"), no sobre createdAt —
// antes filtraba createdAt mientras la UI mostraba document.date, y podían no coincidir en una
// venta confirmada otro día. document.date es @db.Date (medianoche UTC), así que la comparación
// es directa en UTC, sin el huso Bogotá que sí hace falta para createdAt.
function dateRangeFilter(dateFrom?: string, dateTo?: string) {
  return {
    ...(dateFrom && { gte: new Date(`${dateFrom}T00:00:00.000Z`) }),
    ...(dateTo && {
      lt: new Date(
        new Date(`${dateTo}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000,
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

type BranchReceivable = Pick<ListRow, 'totalAmount' | 'paidAmount'> & {
  document: { customerBranchId: string | null };
};

/** Una fila por sucursal del cliente más "Sin sucursal" (branchId null) solo si hay CxC sin sucursal. */
function buildBranchTotals(
  branches: { id: string; name: string }[],
  receivables: BranchReceivable[],
) {
  const totalsFor = (
    branchId: string | null,
    name: string,
  ): {
    branchId: string | null;
    name: string;
    totalDebt: Prisma.Decimal;
    totalPaid: Prisma.Decimal;
    totalBalance: Prisma.Decimal;
  } => {
    const rows = receivables.filter(
      (receivable) => receivable.document.customerBranchId === branchId,
    );
    const totalDebt = rows.reduce(
      (sum, receivable) => sum.plus(receivable.totalAmount),
      new Prisma.Decimal(0),
    );
    const totalPaid = rows.reduce(
      (sum, receivable) => sum.plus(receivable.paidAmount),
      new Prisma.Decimal(0),
    );
    return {
      branchId,
      name,
      totalDebt,
      totalPaid,
      totalBalance: totalDebt.minus(totalPaid),
    };
  };

  const rows = branches.map((branch) => totalsFor(branch.id, branch.name));
  if (receivables.some((r) => r.document.customerBranchId === null)) {
    rows.push(totalsFor(null, 'Sin sucursal'));
  }
  return rows;
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
      customerBranchId,
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
      ...((dateFrom || dateTo || customerBranchId) && {
        document: {
          ...((dateFrom || dateTo) && {
            date: dateRangeFilter(dateFrom, dateTo),
          }),
          ...(customerBranchId && { customerBranchId }),
        },
      }),
    };

    const [rawItems, total, totals] = await this.prisma.$transaction([
      this.prisma.accountsReceivable.findMany({
        where,
        include: LIST_INCLUDE,
        skip,
        take: limit,
        // updatedAt cambia con cada abono: arriba queda la cuenta con el movimiento más reciente
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
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

  /** Estado de cuenta completo del cliente: sus CxC (todas o de una sucursal) y saldos a favor, con totales; branchTotals siempre cubre todas las CxC. */
  async getClientStatement(clientId: string, customerBranchId?: string) {
    const client = await this.prisma.customer.findUnique({
      where: { id: clientId },
      include: { thirdParty: { select: { id: true, name: true } } },
    });

    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const [allReceivables, rawCredits, branches] = await Promise.all([
      this.prisma.accountsReceivable.findMany({
        where: { clientId },
        include: LIST_INCLUDE,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.customerCredit.findMany({
        where: { customerId: clientId },
        include: {
          sourceDocument: {
            select: { id: true, type: true, number: true, date: true },
          },
          applications: {
            include: {
              saleDocument: {
                select: { id: true, type: true, number: true, date: true },
              },
            },
            orderBy: { appliedAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customerBranch.findMany({
        where: { customerId: clientId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const branchTotals = buildBranchTotals(branches, allReceivables);

    // Los saldos a favor son del cliente (no de una sucursal), así que el filtro solo recorta las CxC.
    const receivables = allReceivables
      .filter(
        (receivable) =>
          !customerBranchId ||
          receivable.document.customerBranchId === customerBranchId,
      )
      .map(withDerivedFields);

    const totalDebt = receivables.reduce(
      (sum, receivable) => sum.plus(receivable.totalAmount),
      new Prisma.Decimal(0),
    );
    const totalPaid = receivables.reduce(
      (sum, receivable) => sum.plus(receivable.paidAmount),
      new Prisma.Decimal(0),
    );
    const availableCredit = rawCredits
      .filter((credit) => credit.status === 'available')
      .reduce((sum, credit) => sum.plus(credit.balance), new Prisma.Decimal(0));

    return {
      client: { id: client.thirdParty.id, name: client.thirdParty.name },
      totals: {
        totalDebt,
        totalPaid,
        totalBalance: totalDebt.minus(totalPaid),
        availableCredit,
      },
      branchTotals,
      receivables,
      credits: rawCredits,
    };
  }
}
