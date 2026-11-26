import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomerCreditUsableIn, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { matchContract } from '@/common/types';
import type {
  AccountsReceivableDetail,
  AccountsReceivableListResponse,
  ClientStatement,
  ReceivableClientsResponse,
} from '@/contracts';
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
} from '@/common/utils/payment-days.util';

const DAY_MS = 24 * 60 * 60 * 1000;

const matchListContract = matchContract<AccountsReceivableListResponse>();
const matchClientsContract = matchContract<ReceivableClientsResponse>();
const matchDetailContract = matchContract<AccountsReceivableDetail>();
const matchStatementContract = matchContract<ClientStatement>();

// Los abonos y saldos de un recibo anulado no cuentan como historial ni como uso.
const ACTIVE_ALLOCATION = { customerPayment: { voidedAt: null } };
const ACTIVE_APPLICATION = {
  OR: [{ customerPaymentId: null }, { customerPayment: { voidedAt: null } }],
};

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
  customerPaymentAllocations: {
    where: ACTIVE_ALLOCATION,
    select: { customerPayment: { select: { date: true } } },
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
  customerPaymentAllocations: {
    where: ACTIVE_ALLOCATION,
    include: {
      customerPayment: { select: { id: true, number: true, date: true } },
    },
  },
} satisfies Prisma.AccountsReceivableInclude;

type ListRow = Prisma.AccountsReceivableGetPayload<{
  include: typeof LIST_INCLUDE;
}>;
type DetailRow = Prisma.AccountsReceivableGetPayload<{
  include: typeof DETAIL_INCLUDE;
}>;

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
  const { customerPaymentAllocations, ...rest } = row;
  const lastPaymentDate = findLastPaymentDate([
    ...customerPaymentAllocations.map(
      (allocation) => allocation.customerPayment.date,
    ),
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

/** Historial de abonos de una CxC (recibos de caja) ordenado por fecha, mismo patrón que buildHistory de AccountsPayableService. */
function buildHistory(accountReceivable: DetailRow) {
  const fromCustomerPayments = accountReceivable.customerPaymentAllocations.map(
    (allocation) => ({
      source: 'customer_payment' as const,
      date: allocation.customerPayment.date,
      amount: allocation.amount,
      discountAmount: allocation.discountAmount,
      customerPayment: allocation.customerPayment,
    }),
  );

  return [...fromCustomerPayments].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
}

type BranchReceivable = Pick<ListRow, 'totalAmount' | 'paidAmount'> & {
  document: { customerBranchId: string | null };
};

/** Una fila por sucursal del cliente más "Sin sucursal" (branchId null) solo si hay CxC sin sucursal. */
type BranchCredit = {
  status: string;
  balance: Prisma.Decimal;
  customerBranchId: string | null;
};

function sumAvailable(credits: { status: string; balance: Prisma.Decimal }[]) {
  return credits
    .filter((credit) => credit.status === 'available')
    .reduce((sum, credit) => sum.plus(credit.balance), new Prisma.Decimal(0));
}

function buildBranchTotals(
  branches: { id: string; name: string }[],
  receivables: BranchReceivable[],
  branchCredits: BranchCredit[],
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
    availableBranchCredit: Prisma.Decimal;
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
      availableBranchCredit: sumAvailable(
        branchCredits.filter((credit) => credit.customerBranchId === branchId),
      ),
    };
  };

  const rows = branches.map((branch) => totalsFor(branch.id, branch.name));
  if (
    receivables.some((r) => r.document.customerBranchId === null) ||
    branchCredits.some((credit) => credit.customerBranchId === null)
  ) {
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
    // Filtra document.date (la fecha que muestra la UI), no createdAt
    const dateRange = buildDateColumnRange(dateFrom, dateTo);

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
            date: dateRange,
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

    return matchListContract({
      items: rawItems.map((row) => withDerivedFields(row, todayInBogota())),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totals: buildTotals(totals),
      },
    });
  }

  /** Una fila por cliente con sus CxC sumadas; el filtro de estado se aplica sobre el saldo sumado (HAVING). */
  async findClients(findReceivableClientsDto: FindReceivableClientsDto) {
    const {
      page = 1,
      limit = 20,
      search,
      clientId,
      status,
      sort = 'recent',
      dateFrom,
      dateTo,
    } = findReceivableClientsDto;
    buildDateColumnRange(dateFrom, dateTo);

    const filters = Prisma.sql`
      ${
        search
          ? Prisma.sql`AND (
            position(lower(${search}) in lower(tp.name)) > 0
            OR position(lower(${search}) in lower(tp.document_number)) > 0
          )`
          : Prisma.empty
      }
      ${clientId ? Prisma.sql`AND tp.id = ${clientId}::uuid` : Prisma.empty}
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
          SELECT s.client_id, payment.date AS paid_on
          FROM scoped s
          JOIN customer_payment_allocation allocation ON allocation.account_receivable_id = s.id
          JOIN customer_payment payment ON payment.id = allocation.customer_payment_id
          WHERE payment.voided_at IS NULL
            AND s.client_id IN (SELECT client_id FROM page)
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

    return matchClientsContract({
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
    });
  }

  async findOne(id: string) {
    const accountReceivable = await this.prisma.accountsReceivable.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });

    if (!accountReceivable) {
      throw new NotFoundException('Cuenta por cobrar no encontrada');
    }

    // customerPaymentAllocations ya quedan resumidos en `history`
    // — no se devuelven crudos para no duplicar la misma info.
    const { customerPaymentAllocations, ...rest } = accountReceivable;

    return matchDetailContract({
      ...rest,
      balance: accountReceivable.totalAmount.minus(
        accountReceivable.paidAmount,
      ),
      history: buildHistory(accountReceivable),
    });
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
          customerBranch: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
          voidedBy: { select: { id: true, name: true } },
          applications: {
            where: ACTIVE_APPLICATION,
            include: {
              saleDocument: {
                select: { id: true, type: true, number: true, date: true },
              },
              customerPayment: {
                select: { id: true, number: true, date: true },
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

    const administracionCredits = rawCredits.filter(
      (credit) => credit.usableIn === CustomerCreditUsableIn.administracion,
    );
    const branchTotals = buildBranchTotals(
      branches,
      allReceivables,
      administracionCredits,
    );

    // Los de facturación son del cliente; los de administración son de su sucursal y se recortan con el filtro.
    const credits = rawCredits.filter(
      (credit) =>
        credit.usableIn === CustomerCreditUsableIn.facturacion ||
        !customerBranchId ||
        credit.customerBranchId === customerBranchId,
    );
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
    const availableCredit = sumAvailable(
      credits.filter(
        (credit) => credit.usableIn === CustomerCreditUsableIn.facturacion,
      ),
    );
    const availableBranchCredit = sumAvailable(
      credits.filter(
        (credit) => credit.usableIn === CustomerCreditUsableIn.administracion,
      ),
    );

    return matchStatementContract({
      client: { id: client.thirdParty.id, name: client.thirdParty.name },
      totals: {
        totalDebt,
        totalPaid,
        totalBalance: totalDebt.minus(totalPaid),
        availableCredit,
        availableBranchCredit,
      },
      branchTotals,
      receivables,
      credits,
    });
  }
}
