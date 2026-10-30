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
  FindAllAccountsPayableDto,
  FindAvailableSupplierCreditsDto,
  FindPayableSuppliersDto,
} from './dto/index';

const DAY_MS = 24 * 60 * 60 * 1000;

const LIST_INCLUDE = {
  supplier: { include: { thirdParty: { select: { id: true, name: true } } } },
  document: {
    select: {
      id: true,
      type: true,
      number: true,
      date: true,
      receiver: { select: { id: true, name: true } },
    },
  },
  // Solo el monto: alcanza para sumar creditApplied sin traer el objeto completo.
  creditApplications: { select: { amount: true } },
} satisfies Prisma.AccountsPayableInclude;

const DETAIL_INCLUDE = {
  supplier: { include: { thirdParty: { select: { id: true, name: true } } } },
  document: {
    select: {
      id: true,
      type: true,
      number: true,
      date: true,
      receiver: { select: { id: true, name: true } },
    },
  },
  payablePayments: { orderBy: { paymentDate: 'desc' } },
  creditApplications: {
    include: {
      supplierCredit: { select: { id: true, amount: true, balance: true } },
    },
    orderBy: { appliedAt: 'desc' },
  },
  egresoAllocations: {
    include: { egreso: { select: { id: true, number: true, date: true } } },
  },
} satisfies Prisma.AccountsPayableInclude;

type ListRow = Prisma.AccountsPayableGetPayload<{
  include: typeof LIST_INCLUDE;
}>;
type DetailRow = Prisma.AccountsPayableGetPayload<{
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

// Filtra sobre document.date (lo que muestra la columna "Fecha compra"), no sobre createdAt —
// antes filtraba createdAt mientras la UI mostraba document.date, y podían no coincidir en una
// compra con fecha atrasada o confirmada otro día. document.date es @db.Date (medianoche UTC),
// así que la comparación es directa en UTC, sin el huso Bogotá que sí hace falta para createdAt.
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

/** Reparte los campos derivados (abonado, aplicado en nota crédito, saldo) sobre una fila con sus creditApplications ya cargadas. */
function withDerivedFields<
  T extends Pick<ListRow, 'totalAmount' | 'paidAmount' | 'creditApplications'>,
>(row: T) {
  const { creditApplications, ...rest } = row;
  const creditApplied = creditApplications.reduce(
    (sum, application) => sum.plus(application.amount),
    new Prisma.Decimal(0),
  );

  return {
    ...rest,
    creditApplied,
    balance: row.totalAmount.minus(row.paidAmount),
  };
}

type SupplierGroupRow = {
  supplier_id: string;
  supplier_name: string;
  payable_count: number;
  total_amount: Prisma.Decimal;
  paid_amount: Prisma.Decimal;
  last_purchase_date: Date;
  last_payment_date: Date | null;
  last_movement_at: Date;
  oldest_pending_date: Date | null;
};

type SupplierGroupTotalsRow = {
  supplier_count: number;
  total_amount: Prisma.Decimal;
  paid_amount: Prisma.Decimal;
};

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
      dateFrom,
      dateTo,
    } = findAllAccountsPayableDto;
    if (dateFrom) assertValidCalendarDate('dateFrom', dateFrom);
    if (dateTo) assertValidCalendarDate('dateTo', dateTo);
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new BadRequestException('dateFrom no puede ser posterior a dateTo');
    }

    const skip = (page - 1) * limit;

    const where: Prisma.AccountsPayableWhereInput = {
      ...(status && { status }),
      ...(supplierId && { supplierId }),
      ...(search && {
        supplier: {
          thirdParty: { name: { contains: search, mode: 'insensitive' } },
        },
      }),
      ...((dateFrom || dateTo) && {
        document: { date: dateRangeFilter(dateFrom, dateTo) },
      }),
    };

    const [rawItems, total, totals] = await this.prisma.$transaction([
      this.prisma.accountsPayable.findMany({
        where,
        include: LIST_INCLUDE,
        skip,
        take: limit,
        // updatedAt cambia con cada abono: arriba queda la cuenta con el movimiento más reciente
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.accountsPayable.count({ where }),
      this.prisma.accountsPayable.aggregate({
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

  /** Una fila por proveedor con sus CxP sumadas; el filtro de estado se aplica sobre el saldo sumado (HAVING). */
  async findSuppliers(findPayableSuppliersDto: FindPayableSuppliersDto) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      sort = 'recent',
      dateFrom,
      dateTo,
    } = findPayableSuppliersDto;
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
        ? Prisma.sql`oldest_pending_date ASC NULLS LAST, supplier_name ASC, supplier_id ASC`
        : Prisma.sql`last_movement_at DESC, supplier_name ASC, supplier_id ASC`;

    const groupedSuppliers = Prisma.sql`
      scoped AS (
        SELECT ap.id, ap.supplier_id, tp.name AS supplier_name, ap.total_amount,
               ap.paid_amount, ap.updated_at, d.date AS purchase_date
        FROM accounts_payable ap
        JOIN document d ON d.id = ap.document_id
        JOIN third_parties tp ON tp.id = ap.supplier_id
        WHERE TRUE ${filters}
      ),
      grouped AS (
        SELECT s.supplier_id, s.supplier_name,
               COUNT(*)::int AS payable_count,
               SUM(s.total_amount) AS total_amount,
               SUM(s.paid_amount) AS paid_amount,
               MAX(s.purchase_date) AS last_purchase_date,
               MAX(s.updated_at) AS last_movement_at,
               MIN(s.purchase_date) FILTER (WHERE s.total_amount - s.paid_amount > 0)
                 AS oldest_pending_date
        FROM scoped s
        GROUP BY s.supplier_id, s.supplier_name
        ${having}
      )`;

    // Pagos = históricos, egresos y aplicaciones de saldo a favor sin egreso (las con egreso ya cuentan vía el egreso).
    const [rows, [totals]] = await this.prisma.$transaction([
      this.prisma.$queryRaw<SupplierGroupRow[]>`
        WITH ${groupedSuppliers},
        page AS (
          SELECT * FROM grouped
          ORDER BY ${orderBy}
          LIMIT ${limit} OFFSET ${(page - 1) * limit}
        ),
        payment_dates AS (
          SELECT s.supplier_id, pp.payment_date AS paid_on
          FROM scoped s
          JOIN payable_payments pp ON pp.account_payable_id = s.id
          WHERE s.supplier_id IN (SELECT supplier_id FROM page)
          UNION ALL
          SELECT s.supplier_id, e.date AS paid_on
          FROM scoped s
          JOIN egreso_allocation ea ON ea.account_payable_id = s.id
          JOIN egreso e ON e.id = ea.egreso_id
          WHERE s.supplier_id IN (SELECT supplier_id FROM page)
          UNION ALL
          SELECT s.supplier_id,
                 (sca.applied_at AT TIME ZONE 'America/Bogota')::date AS paid_on
          FROM scoped s
          JOIN supplier_credit_application sca ON sca.account_payable_id = s.id
          WHERE sca.egreso_id IS NULL
            AND s.supplier_id IN (SELECT supplier_id FROM page)
        )
        SELECT p.*,
               (SELECT MAX(pd.paid_on) FROM payment_dates pd
                WHERE pd.supplier_id = p.supplier_id) AS last_payment_date
        FROM page p
        ORDER BY ${orderBy}`,
      this.prisma.$queryRaw<SupplierGroupTotalsRow[]>`
        WITH ${groupedSuppliers}
        SELECT COUNT(*)::int AS supplier_count,
               COALESCE(SUM(total_amount), 0) AS total_amount,
               COALESCE(SUM(paid_amount), 0) AS paid_amount
        FROM grouped`,
    ]);

    const total = totals.supplier_count;
    const totalAmount = new Prisma.Decimal(totals.total_amount);
    const paidAmount = new Prisma.Decimal(totals.paid_amount);

    const today = todayInBogota();

    return {
      items: rows.map((row) => {
        const rowTotal = new Prisma.Decimal(row.total_amount);
        const rowPaid = new Prisma.Decimal(row.paid_amount);
        return {
          supplier: { id: row.supplier_id, name: row.supplier_name },
          payableCount: row.payable_count,
          totalAmount: rowTotal,
          paidAmount: rowPaid,
          balance: rowTotal.minus(rowPaid),
          lastPurchaseDate: row.last_purchase_date,
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
    const accountPayable = await this.prisma.accountsPayable.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });

    if (!accountPayable) {
      throw new NotFoundException('Cuenta por pagar no encontrada');
    }

    // payablePayments/egresoAllocations/creditApplications ya quedan resumidos
    // en `history` — no se devuelven crudos para no duplicar la misma info.
    const { payablePayments, egresoAllocations, creditApplications, ...rest } =
      accountPayable;
    const creditApplied = creditApplications.reduce(
      (sum, application) => sum.plus(application.amount),
      new Prisma.Decimal(0),
    );

    return {
      ...rest,
      creditApplied,
      balance: accountPayable.totalAmount.minus(accountPayable.paidAmount),
      history: buildHistory(accountPayable),
    };
  }

  /** Estado de cuenta completo del proveedor: todas sus CxP y saldos a favor, con totales. */
  async getSupplierStatement(supplierId: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      include: { thirdParty: { select: { id: true, name: true } } },
    });

    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    const [rawPayables, rawCredits] = await Promise.all([
      this.prisma.accountsPayable.findMany({
        where: { supplierId },
        include: LIST_INCLUDE,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.supplierCredit.findMany({
        where: { supplierId },
        include: {
          sourceDocument: {
            select: { id: true, type: true, number: true, date: true },
          },
          applications: {
            include: {
              egreso: { select: { id: true, number: true, date: true } },
            },
            orderBy: { appliedAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const payables = rawPayables.map(withDerivedFields);

    const totalDebt = payables.reduce(
      (sum, payable) => sum.plus(payable.totalAmount),
      new Prisma.Decimal(0),
    );
    const totalPaid = payables.reduce(
      (sum, payable) => sum.plus(payable.paidAmount),
      new Prisma.Decimal(0),
    );
    const availableCredit = rawCredits
      .filter((credit) => credit.status === 'available')
      .reduce((sum, credit) => sum.plus(credit.balance), new Prisma.Decimal(0));

    return {
      supplier: {
        id: supplier.thirdParty.id,
        name: supplier.thirdParty.name,
      },
      totals: {
        totalDebt,
        totalPaid,
        totalBalance: totalDebt.minus(totalPaid),
        availableCredit,
      },
      payables,
      credits: rawCredits,
    };
  }

  /** Créditos de proveedor con saldo disponible para aplicar contra un pago. */
  async findAvailableSupplierCredits(
    findAvailableSupplierCreditsDto: FindAvailableSupplierCreditsDto,
  ) {
    const { supplierId } = findAvailableSupplierCreditsDto;

    return this.prisma.supplierCredit.findMany({
      where: { supplierId, status: 'available', balance: { gt: 0 } },
      orderBy: { createdAt: 'asc' },
    });
  }
}

/** Historial unificado de abonos de una CxP: egresos, pagos históricos y aplicaciones de saldo a favor sin egreso (las que ya tienen egreso se excluyen para no duplicar). */
function buildHistory(accountPayable: DetailRow) {
  const fromEgresos = accountPayable.egresoAllocations.map((allocation) => ({
    source: 'egreso' as const,
    date: allocation.egreso.date,
    amount: allocation.amount,
    creditAmount: allocation.creditAmount,
    egreso: allocation.egreso,
  }));

  const fromHistoricPayments = accountPayable.payablePayments.map(
    (payment) => ({
      source: 'pago_historico' as const,
      date: payment.paymentDate,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      bankDestination: payment.bankDestination,
      reference: payment.reference,
    }),
  );

  const fromHistoricCredits = accountPayable.creditApplications
    .filter((application) => application.egresoId === null)
    .map((application) => ({
      source: 'nota_credito_historica' as const,
      date: application.appliedAt,
      amount: application.amount,
      supplierCredit: application.supplierCredit,
    }));

  return [...fromEgresos, ...fromHistoricPayments, ...fromHistoricCredits].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
}
