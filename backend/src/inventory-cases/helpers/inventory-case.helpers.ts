import { BadRequestException } from '@nestjs/common';
import {
  InventoryCaseCause,
  InventoryCaseStatus,
  Prisma,
} from '@prisma/client';
import { toCents } from '@/common/utils/money.util';
import { assertValidCalendarDate } from '@/common/utils/date-range.util';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Días enteros entre dos fechas. */
export function wholeDaysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

/** Filtro sobre una columna timestamp para días YYYY-MM-DD de Bogotá (UTC-5 fijo, sin horario de verano), ambos extremos inclusivos. */
export function buildBogotaDayRange(from?: string, to?: string) {
  if (from) assertValidCalendarDate('from', from);
  if (to) assertValidCalendarDate('to', to);
  if (from && to && from > to) {
    throw new BadRequestException('from no puede ser posterior a to');
  }
  if (!from && !to) return undefined;

  return {
    ...(from && { gte: new Date(`${from}T00:00:00.000-05:00`) }),
    ...(to && { lte: new Date(`${to}T23:59:59.999-05:00`) }),
  };
}

/** Primer instante del mes actual en Bogotá. */
export function startOfMonthInBogota(now: Date) {
  const month = now
    .toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' })
    .slice(0, 7);
  return new Date(`${month}-01T00:00:00.000-05:00`);
}

export function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

export interface ReportCase {
  status: InventoryCaseStatus;
  cause: InventoryCaseCause | null;
  quantity: number;
  productId: string;
  warehouseId: string;
  product: { code: string; description: string };
  warehouse: { name: string };
  documentItem: { unitCost: Prisma.Decimal | number };
}

const TOP_PRODUCTS = 10;

function addOne<Key>(counts: Map<Key, number>, key: Key) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

// Gana la causa más repetida; en empate, la primera por nombre.
function pickMostCommon(counts: Map<InventoryCaseCause, number>) {
  const [first] = [...counts].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  return first?.[0] ?? null;
}

/** Agrega los casos del periodo (sin los cerrados por anulación del ajuste); el costo aproximado es cantidad × costo de la línea de la EAI, sumado en centavos. */
export function buildReport(allCases: ReportCase[]) {
  const cases = allCases.filter(
    (item) => item.cause !== InventoryCaseCause.ajuste_anulado,
  );
  const totals = { closed: 0, open: 0, units: 0, cents: 0 };
  const causeCounts = new Map<InventoryCaseCause, number>();
  const warehouses = new Map<
    string,
    { name: string; count: number; cents: number }
  >();
  const products = new Map<
    string,
    {
      code: string;
      description: string;
      count: number;
      units: number;
      cents: number;
      causes: Map<InventoryCaseCause, number>;
    }
  >();

  for (const item of cases) {
    const cents = toCents(Number(item.documentItem.unitCost) * item.quantity);
    const isClosed = item.status === InventoryCaseStatus.closed;

    totals[isClosed ? 'closed' : 'open'] += 1;
    totals.units += item.quantity;
    totals.cents += cents;
    if (isClosed && item.cause) addOne(causeCounts, item.cause);

    const warehouse = warehouses.get(item.warehouseId) ?? {
      name: item.warehouse.name,
      count: 0,
      cents: 0,
    };
    warehouse.count += 1;
    warehouse.cents += cents;
    warehouses.set(item.warehouseId, warehouse);

    const product = products.get(item.productId) ?? {
      ...item.product,
      count: 0,
      units: 0,
      cents: 0,
      causes: new Map<InventoryCaseCause, number>(),
    };
    product.count += 1;
    product.units += item.quantity;
    product.cents += cents;
    if (isClosed && item.cause) addOne(product.causes, item.cause);
    products.set(item.productId, product);
  }

  return {
    totals: {
      cases: cases.length,
      closed: totals.closed,
      open: totals.open,
      units: totals.units,
      approxCost: totals.cents / 100,
    },
    byCause: [...causeCounts]
      .map(([cause, count]) => ({ cause, count }))
      .sort((a, b) => b.count - a.count || a.cause.localeCompare(b.cause)),
    byWarehouse: [...warehouses]
      .map(([warehouseId, value]) => ({
        warehouseId,
        name: value.name,
        count: value.count,
        approxCost: value.cents / 100,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    topProducts: [...products]
      .map(([productId, value]) => ({
        productId,
        code: value.code,
        description: value.description,
        count: value.count,
        units: value.units,
        approxCost: value.cents / 100,
        mostCommonCause: pickMostCommon(value.causes),
      }))
      .sort(
        (a, b) =>
          b.count - a.count ||
          b.units - a.units ||
          a.code.localeCompare(b.code),
      )
      .slice(0, TOP_PRODUCTS),
  };
}
