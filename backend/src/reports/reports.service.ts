import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface WarehouseStockRow {
  warehouseId: string;
  name: string;
  units: number;
  costValue: number;
  productCount: number;
}

export interface RotationRow {
  productId: string;
  code: string;
  description: string;
  unitsSold: number;
  salesAmount: number;
  stock: number;
}

export interface AccountTotals {
  total: number;
  paid: number;
  balance: number;
  openCount: number;
}

export interface ThirdPartyBalanceRow {
  thirdPartyId: string;
  name: string;
  balance: number;
}

export interface SellerSalesRow {
  sellerId: string;
  name: string;
  grossSales: number;
  returns: number;
  netSales: number;
  documentCount: number;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getInventory() {
    const warehouses = await this.prisma.$queryRaw<WarehouseStockRow[]>`
      SELECT w.id AS "warehouseId", w.name,
        COALESCE(SUM(i.quantity), 0)::int AS units,
        ROUND(COALESCE(SUM(i.quantity * p.avg_cost), 0), 2)::float8 AS "costValue",
        COUNT(i.product_id) FILTER (WHERE i.quantity > 0)::int AS "productCount"
      FROM warehouse w
      LEFT JOIN inventory i ON i.warehouse_id = w.id
      LEFT JOIN product p ON p.id = i.product_id
      WHERE w.active
      GROUP BY w.id, w.name
      ORDER BY w.name
    `;

    // Un producto en dos bodegas cuenta una vez en el total general.
    const [{ productCount }] = await this.prisma.$queryRaw<
      { productCount: number }[]
    >`
      SELECT COUNT(DISTINCT i.product_id)::int AS "productCount"
      FROM inventory i JOIN warehouse w ON w.id = i.warehouse_id
      WHERE w.active AND i.quantity > 0
    `;

    return {
      warehouses,
      totals: {
        units: warehouses.reduce((sum, row) => sum + row.units, 0),
        costValue: roundMoney(
          warehouses.reduce((sum, row) => sum + row.costValue, 0),
        ),
        productCount,
      },
    };
  }

  async getRotation(
    range: DateRange,
    warehouseId: string | null,
    limit: number,
  ) {
    // Ventas netas por producto: POS+COT confirmadas menos DVV; POSO es espejo de facturación oficial y contaría doble.
    const soldAndStock = Prisma.sql`
      WITH sold AS (
        SELECT di.product_id,
          SUM(CASE WHEN d.type = 'DVV' THEN -di.quantity ELSE di.quantity END)::int AS units,
          ROUND(SUM(CASE WHEN d.type = 'DVV' THEN -di.subtotal ELSE di.subtotal END), 2)::float8 AS amount
        FROM document d
        JOIN document_item di ON di.document_id = d.id
        WHERE d.status = 'confirmed' AND d.type IN ('POS', 'COT', 'DVV')
          AND d.date BETWEEN ${range.from}::date AND ${range.to}::date
          AND (${warehouseId}::uuid IS NULL OR d.warehouse_id = ${warehouseId}::uuid)
        GROUP BY di.product_id
      ),
      stock AS (
        SELECT product_id, SUM(quantity)::int AS quantity
        FROM inventory
        WHERE ${warehouseId}::uuid IS NULL OR warehouse_id = ${warehouseId}::uuid
        GROUP BY product_id
      ),
      top_ids AS (
        SELECT s.product_id,
          ROW_NUMBER() OVER (ORDER BY s.units DESC, s.amount DESC, p.code) AS rank
        FROM sold s
        JOIN product p ON p.id = s.product_id
        WHERE s.units > 0
        ORDER BY rank
        LIMIT ${limit}
      )`;

    const top = this.prisma.$queryRaw<RotationRow[]>`
      ${soldAndStock}
      SELECT p.id AS "productId", p.code, p.description,
        s.units AS "unitsSold", s.amount AS "salesAmount",
        COALESCE(st.quantity, 0) AS stock
      FROM top_ids t
      JOIN sold s ON s.product_id = t.product_id
      JOIN product p ON p.id = t.product_id
      LEFT JOIN stock st ON st.product_id = t.product_id
      ORDER BY t.rank
    `;

    // Menor rotación: productos con stock (incluidos los que no vendieron nada) que no estén ya en mayor rotación.
    const bottom = this.prisma.$queryRaw<RotationRow[]>`
      ${soldAndStock}
      SELECT p.id AS "productId", p.code, p.description,
        COALESCE(s.units, 0) AS "unitsSold", COALESCE(s.amount, 0) AS "salesAmount",
        st.quantity AS stock
      FROM stock st
      JOIN product p ON p.id = st.product_id
      LEFT JOIN sold s ON s.product_id = st.product_id
      WHERE st.quantity > 0 AND p.deleted_at IS NULL
        AND st.product_id NOT IN (SELECT product_id FROM top_ids)
      ORDER BY COALESCE(s.units, 0) ASC, st.quantity DESC, p.code
      LIMIT ${limit}
    `;

    const [topRows, bottomRows] = await Promise.all([top, bottom]);
    return { top: topRows, bottom: bottomRows };
  }

  async getAccounts(limit: number) {
    const [payable, receivable, topSuppliers, topCustomers] = await Promise.all(
      [
        this.prisma.$queryRaw<AccountTotals[]>`
          SELECT ROUND(COALESCE(SUM(total_amount), 0), 2)::float8 AS total,
            ROUND(COALESCE(SUM(paid_amount), 0), 2)::float8 AS paid,
            ROUND(COALESCE(SUM(total_amount - paid_amount), 0), 2)::float8 AS balance,
            COUNT(*)::int AS "openCount"
          FROM accounts_payable WHERE status <> 'paid'
        `,
        this.prisma.$queryRaw<AccountTotals[]>`
          SELECT ROUND(COALESCE(SUM(total_amount), 0), 2)::float8 AS total,
            ROUND(COALESCE(SUM(paid_amount), 0), 2)::float8 AS paid,
            ROUND(COALESCE(SUM(total_amount - paid_amount), 0), 2)::float8 AS balance,
            COUNT(*)::int AS "openCount"
          FROM accounts_receivable WHERE status <> 'paid'
        `,
        this.prisma.$queryRaw<ThirdPartyBalanceRow[]>`
          SELECT t.id AS "thirdPartyId", t.name,
            ROUND(SUM(ap.total_amount - ap.paid_amount), 2)::float8 AS balance
          FROM accounts_payable ap JOIN third_parties t ON t.id = ap.supplier_id
          WHERE ap.status <> 'paid'
          GROUP BY t.id, t.name
          ORDER BY balance DESC, t.name
          LIMIT ${limit}
        `,
        this.prisma.$queryRaw<ThirdPartyBalanceRow[]>`
          SELECT t.id AS "thirdPartyId", t.name,
            ROUND(SUM(ar.total_amount - ar.paid_amount), 2)::float8 AS balance
          FROM accounts_receivable ar JOIN third_parties t ON t.id = ar.client_id
          WHERE ar.status <> 'paid'
          GROUP BY t.id, t.name
          ORDER BY balance DESC, t.name
          LIMIT ${limit}
        `,
      ],
    );

    return {
      payable: payable[0],
      receivable: receivable[0],
      topSuppliers,
      topCustomers,
    };
  }

  async getSalesBySeller(range: DateRange) {
    const [rows, trendRows] = await Promise.all([
      // La DVV no enlaza la venta original: se descuenta a la vendedora que tenga la propia DVV.
      this.prisma.$queryRaw<
        (Omit<SellerSalesRow, 'sellerId' | 'name'> & {
          sellerId: string | null;
          name: string | null;
        })[]
      >`
        SELECT d.seller_id AS "sellerId", t.name,
          ROUND(COALESCE(SUM(d.total) FILTER (WHERE d.type IN ('POS', 'COT')), 0), 2)::float8 AS "grossSales",
          ROUND(COALESCE(SUM(d.total) FILTER (WHERE d.type = 'DVV'), 0), 2)::float8 AS returns,
          COUNT(*) FILTER (WHERE d.type IN ('POS', 'COT'))::int AS "documentCount"
        FROM document d
        LEFT JOIN third_parties t ON t.id = d.seller_id
        WHERE d.status = 'confirmed' AND d.type IN ('POS', 'COT', 'DVV')
          AND d.date BETWEEN ${range.from}::date AND ${range.to}::date
        GROUP BY d.seller_id, t.name
      `,
      this.prisma.$queryRaw<{ date: Date; netSales: number }[]>`
        SELECT d.date,
          ROUND(SUM(CASE WHEN d.type = 'DVV' THEN -d.total ELSE d.total END), 2)::float8 AS "netSales"
        FROM document d
        WHERE d.status = 'confirmed' AND d.type IN ('POS', 'COT', 'DVV')
          AND d.date BETWEEN ${range.from}::date AND ${range.to}::date
        GROUP BY d.date
        ORDER BY d.date
      `,
    ]);

    let unassignedSales = 0;
    let unassignedReturns = 0;
    const sellers: SellerSalesRow[] = [];
    for (const row of rows) {
      // GROUP BY seller_id deja una sola fila con vendedora nula.
      if (row.sellerId === null) {
        unassignedSales = row.grossSales;
        unassignedReturns = row.returns;
        continue;
      }
      sellers.push({
        sellerId: row.sellerId,
        name: row.name ?? '',
        grossSales: row.grossSales,
        returns: row.returns,
        netSales: roundMoney(row.grossSales - row.returns),
        documentCount: row.documentCount,
      });
    }
    sellers.sort((a, b) => b.netSales - a.netSales);

    return {
      sellers,
      unassignedSales,
      unassignedReturns,
      trend: fillDailyTrend(range, trendRows),
    };
  }
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

// Días sin ventas van en 0 para que el gráfico de tendencia no salte fechas.
function fillDailyTrend(
  range: DateRange,
  rows: { date: Date; netSales: number }[],
) {
  const byDay = new Map(rows.map((row) => [toDateKey(row.date), row.netSales]));
  const trend: { date: string; netSales: number }[] = [];
  for (
    const day = new Date(range.from);
    day <= range.to;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    const key = toDateKey(day);
    trend.push({ date: key, netSales: byDay.get(key) ?? 0 });
  }
  return trend;
}
