import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  buildDateColumnRange,
  todayInBogota,
} from '@/common/utils/date-range.util';
import {
  FindAllAccountsReceivableDto,
  FindReceivableClientsDto,
} from './dto/index';
import {
  calculatePaymentDays,
  findLastPaymentDate,
} from './helpers/payment-days.helper';

const DAY_MS = 24 * 60 * 60 * 1000;

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
  receivablePayments: { select: { paymentDate: true } },
  reciboCajaAllocations: { select: { reciboCaja: { select: { date: true } } } },
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
function withDerivedFields(row: ListRow, today: Date) {
  const { receivablePayments, reciboCajaAllocations, ...rest } = row;
  const lastPaymentDate = findLastPaymentDate([
    ...receivablePayments.map((payment) => payment.paymentDate),
    ...reciboCajaAllocations.map((allocation) => allocation.reciboCaja.date),
  ]);
  const { days, isOpen } = calculatePaymentDays(
    row.document.date,
    lastPaymentDate,
    row.status,
    today,
  );

  return {
    ...rest,
    balance: row.totalAmount.minus(row.paidAmount),
    lastPaymentDate,
    paymentDays: days,
    isPaymentOpen: isOpen,
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

type ClientGroupRow = {
  client_id: string;
  client_name: string;
  receivable_count: number;
  total_amount: Prisma.Decimal;
  paid_amount: Prisma.Decimal;
  last_sale_date: Date;
  last_payment_date: Date | null;
  last_movement_at: Date;
  oldest_pending_date: Date | null;
};

type ClientGroupTotalsRow = {
  client_count: number;
  total_amount: Prisma.Decimal;
  paid_amount: Prisma.Decimal;
};

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
      items: rawItems.map((row) => withDerivedFields(row, todayInBogota())),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totals: buildTotals(totals),
      },
    };
  }

  /** Una fila por cliente con sus CxC sumadas; el filtro de estado se aplica sobre el saldo sumado (HAVING). */
  async findClients(findReceivableClientsDto: FindReceivableClientsDto) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      sort = 'recent',
      dateFrom,
      dateTo,
    } = findReceivableClientsDto;
    buildDateColumnRange(dateFrom, dateTo);

    const filters = Prisma.sql`
      ${search ? Prisma.sql`AND position(lower(${search}) in lower(tp.name)) > 0` : Prisma.empty}
      ${dateFrom ? Prisma.sql`AND d.date >= ${dateFrom}::date` : Prisma.empty}
      ${dateTo ? Prisma.sql`AND d.date <= ${dateTo}::date` : Prisma.empty}`;
    const having =
      status === 'with_balance'
        ? Prisma.sql`HAVING SUM(s.total_amount) - SUM(s.paid_amount) > 0`
        : status === 'settled'
          ? Prisma.sql`HAVING SUM(s.total_amount) - SUM(s.paid_amount) = 0`
          : Prisma.empty;

    const orderBy =
      sort === 'oldest_debt'
        ? Prisma.sql`oldest_pending_date ASC NULLS LAST, client_name ASC, client_id ASC`
        : Prisma.sql`last_movement_at DESC, client_name ASC, client_id ASC`;

    const groupedClients = Prisma.sql`
      scoped AS (
        SELECT ar.id, ar.client_id, tp.name AS client_name, ar.total_amount,
               ar.paid_amount, ar.updated_at, d.date AS sale_date
        FROM accounts_receivable ar
        JOIN document d ON d.id = ar.document_id
        JOIN third_parties tp ON tp.id = ar.client_id
        WHERE TRUE ${filters}
      ),
      grouped AS (
        SELECT s.client_id, s.client_name,
               COUNT(*)::int AS receivable_count,
               SUM(s.total_amount) AS total_amount,
               SUM(s.paid_amount) AS paid_amount,
               MAX(s.sale_date) AS last_sale_date,
               MAX(s.updated_at) AS last_movement_at,
               MIN(s.sale_date) FILTER (WHERE s.total_amount - s.paid_amount > 0)
                 AS oldest_pending_date
        FROM scoped s
        GROUP BY s.client_id, s.client_name
        ${having}
      )`;

    const [rows, [totals]] = await this.prisma.$transaction([
      this.prisma.$queryRaw<ClientGroupRow[]>`
        WITH ${groupedClients},
        page AS (
          SELECT * FROM grouped
          ORDER BY ${orderBy}
          LIMIT ${limit} OFFSET ${(page - 1) * limit}
        ),
        payment_dates AS (
          SELECT s.client_id, rp.payment_date AS paid_on
          FROM scoped s
          JOIN receivable_payments rp ON rp.account_receivable_id = s.id
          WHERE s.client_id IN (SELECT client_id FROM page)
          UNION ALL
          SELECT s.client_id, rc.date AS paid_on
          FROM scoped s
          JOIN recibo_caja_allocation rca ON rca.account_receivable_id = s.id
          JOIN recibo_caja rc ON rc.id = rca.recibo_caja_id
          WHERE s.client_id IN (SELECT client_id FROM page)
        )
        SELECT p.*,
               (SELECT MAX(pd.paid_on) FROM payment_dates pd
                WHERE pd.client_id = p.client_id) AS last_payment_date
        FROM page p
        ORDER BY ${orderBy}`,
      this.prisma.$queryRaw<ClientGroupTotalsRow[]>`
        WITH ${groupedClients}
        SELECT COUNT(*)::int AS client_count,
               COALESCE(SUM(total_amount), 0) AS total_amount,
               COALESCE(SUM(paid_amount), 0) AS paid_amount
        FROM grouped`,
    ]);

    const total = totals.client_count;
    const totalAmount = new Prisma.Decimal(totals.total_amount);
    const paidAmount = new Prisma.Decimal(totals.paid_amount);

    const today = todayInBogota();

    return {
      items: rows.map((row) => {
        const rowTotal = new Prisma.Decimal(row.total_amount);
        const rowPaid = new Prisma.Decimal(row.paid_amount);
        return {
          client: { id: row.client_id, name: row.client_name },
          receivableCount: row.receivable_count,
          totalAmount: rowTotal,
          paidAmount: rowPaid,
          balance: rowTotal.minus(rowPaid),
          lastSaleDate: row.last_sale_date,
          lastPaymentDate: row.last_payment_date,
          lastMovementAt: row.last_movement_at,
          oldestPendingDays: row.oldest_pending_date
            ? Math.round(
                (today.getTime() - row.oldest_pending_date.getTime()) / DAY_MS,
              )
            : null,
        };
      }),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totals: {
          totalAmount,
          paidAmount,
          balance: totalAmount.minus(paidAmount),
        },
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
      .map((receivable) => withDerivedFields(receivable, todayInBogota()));

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
