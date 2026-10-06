import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentStatus, DocumentType } from '@/common/enums';
import { buildDateColumnRange } from '@/common/utils/date-range.util';
import { PrismaService } from '@/prisma/prisma.service';
import {
  FindOfficialLedgerDto,
  FindOfficialLedgerMovementsDto,
} from './dto/index';

interface LedgerRow {
  product_id: string;
  code: string;
  description: string;
  opening: number;
  purchased: number;
  sold: number;
}

interface LedgerTotalsRow {
  total: number;
  opening: number;
  purchased: number;
  sold: number;
}

/** Libro de control oficial: saldo por producto derivado en vivo de CMO (+) y POSO (−) confirmadas; puede quedar negativo y nunca bloquea. */
@Injectable()
export class OfficialLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(dto: FindOfficialLedgerDto) {
    const { page = 1, limit = 20, dateFrom, dateTo, search } = dto;
    buildDateColumnRange(dateFrom, dateTo);

    const term = search?.trim();
    const searchSql = term
      ? Prisma.sql`AND (p.code ILIKE ${`%${escapeLike(term)}%`} OR p.description ILIKE ${`%${escapeLike(term)}%`})`
      : Prisma.empty;
    const toSql = dateTo
      ? Prisma.sql`AND d.date <= ${dateTo}::date`
      : Prisma.empty;
    const beforeFromSql = dateFrom
      ? Prisma.sql`d.date < ${dateFrom}::date`
      : Prisma.sql`FALSE`;
    const inRangeSql = dateFrom
      ? Prisma.sql`d.date >= ${dateFrom}::date`
      : Prisma.sql`TRUE`;

    // Un solo GROUP BY por producto con agregación condicional; el HAVING oculta productos cuyo neto previo y rango son cero.
    const aggregated = Prisma.sql`
      SELECT p.id AS product_id, p.code, p.description,
        COALESCE(SUM(CASE WHEN ${beforeFromSql} THEN
          CASE d.type WHEN 'CMO' THEN di.quantity ELSE -di.quantity END
        END), 0)::int AS opening,
        COALESCE(SUM(CASE WHEN ${inRangeSql} AND d.type = 'CMO' THEN di.quantity END), 0)::int AS purchased,
        COALESCE(SUM(CASE WHEN ${inRangeSql} AND d.type = 'POSO' THEN di.quantity END), 0)::int AS sold
      FROM document_item di
      JOIN document d ON d.id = di.document_id
      JOIN product p ON p.id = di.product_id
      WHERE d.type IN ('CMO', 'POSO') AND d.status = 'confirmed'
        ${toSql} ${searchSql}
      GROUP BY p.id, p.code, p.description
      HAVING COALESCE(SUM(CASE WHEN ${beforeFromSql} THEN
          CASE d.type WHEN 'CMO' THEN di.quantity ELSE -di.quantity END
        END), 0) <> 0
        OR COALESCE(SUM(CASE WHEN ${inRangeSql} AND d.type = 'CMO' THEN di.quantity END), 0) <> 0
        OR COALESCE(SUM(CASE WHEN ${inRangeSql} AND d.type = 'POSO' THEN di.quantity END), 0) <> 0
    `;

    const [rows, totalsRows] = await this.prisma.$transaction([
      this.prisma.$queryRaw<LedgerRow[]>`
        WITH agg AS (${aggregated})
        SELECT * FROM agg ORDER BY code
        LIMIT ${limit} OFFSET ${(page - 1) * limit}
      `,
      this.prisma.$queryRaw<LedgerTotalsRow[]>`
        WITH agg AS (${aggregated})
        SELECT COUNT(*)::int AS total,
          COALESCE(SUM(opening), 0)::int AS opening,
          COALESCE(SUM(purchased), 0)::int AS purchased,
          COALESCE(SUM(sold), 0)::int AS sold
        FROM agg
      `,
    ]);

    const totals = totalsRows[0];

    return {
      items: rows.map((row) => ({
        productId: row.product_id,
        code: row.code,
        name: row.description,
        openingBalance: row.opening,
        purchased: row.purchased,
        sold: row.sold,
        closingBalance: row.opening + row.purchased - row.sold,
      })),
      meta: {
        total: totals.total,
        page,
        limit,
        totalPages: Math.ceil(totals.total / limit),
        totals: {
          openingBalance: totals.opening,
          purchased: totals.purchased,
          sold: totals.sold,
          closingBalance: totals.opening + totals.purchased - totals.sold,
        },
      },
    };
  }

  async findProductMovements(
    productId: string,
    dto: FindOfficialLedgerMovementsDto,
  ) {
    const { dateFrom, dateTo } = dto;
    const dateRange = buildDateColumnRange(dateFrom, dateTo);

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, code: true, description: true },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    const [items, purchasedBefore, soldBefore] = await this.prisma.$transaction(
      [
        this.prisma.documentItem.findMany({
          where: {
            productId,
            document: {
              type: { in: [DocumentType.CMO, DocumentType.POSO] },
              status: DocumentStatus.confirmed,
              ...((dateFrom || dateTo) && { date: dateRange }),
            },
          },
          select: {
            quantity: true,
            document: {
              select: {
                id: true,
                type: true,
                number: true,
                date: true,
                thirdParty: { select: { name: true } },
              },
            },
          },
          orderBy: [
            { document: { date: 'asc' } },
            { document: { createdAt: 'asc' } },
            { id: 'asc' },
          ],
        }),
        this.openingAggregate(productId, DocumentType.CMO, dateFrom),
        this.openingAggregate(productId, DocumentType.POSO, dateFrom),
      ],
      // RepeatableRead: con READ COMMITTED cada consulta toma su propio snapshot y el saldo inicial podría no cuadrar con los movimientos.
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    const openingBalance =
      (purchasedBefore._sum.quantity ?? 0) - (soldBefore._sum.quantity ?? 0);

    let runningBalance = openingBalance;
    const movements = items.map((item) => {
      const quantity =
        item.document.type === DocumentType.CMO
          ? item.quantity
          : -item.quantity;
      runningBalance += quantity;

      return {
        date: item.document.date,
        documentId: item.document.id,
        type: item.document.type,
        number: item.document.number,
        thirdPartyName: item.document.thirdParty?.name ?? null,
        quantity,
        runningBalance,
      };
    });

    return {
      product: {
        id: product.id,
        code: product.code,
        name: product.description,
      },
      openingBalance,
      closingBalance: runningBalance,
      movements,
    };
  }

  // Sin dateFrom el corte es la época Unix: no matchea nada y el saldo inicial queda en 0.
  private openingAggregate(
    productId: string,
    type: DocumentType,
    dateFrom?: string,
  ) {
    return this.prisma.documentItem.aggregate({
      where: {
        productId,
        document: {
          type,
          status: DocumentStatus.confirmed,
          date: {
            lt: dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`) : new Date(0),
          },
        },
      },
      _sum: { quantity: true },
    });
  }
}

/** Escapa los comodines de ILIKE para que el término se busque literal. */
function escapeLike(term: string) {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}
