// Contrato de casos de diferencias de inventario: lo que entregan los endpoints de /inventory-cases, tal como viaja en JSON.
// Solo tipos planos (el frontend lo importa con `import type`). Decimal y Date viajan como string.

import type { DocumentType } from './documents';

export type InventoryCaseStatus = 'open' | 'closed';
export type InventoryCaseCause =
  | 'venta_otro_producto'
  | 'traslado_mal_registrado'
  | 'compra_mal_digitada'
  | 'devolucion_no_registrada'
  | 'error_conteo'
  | 'perdida_faltante'
  | 'otro'
  | 'ajuste_anulado';

export interface InventoryCaseDocumentRef {
  id: string;
  type: DocumentType;
  number: string;
}

export interface InventoryCaseUserRef {
  id: string;
  name: string;
}

export interface InventoryCaseRow {
  id: string;
  number: string;
  createdAt: string;
  product: {
    id: string;
    code: string;
    description: string;
    brandName: string;
  };
  warehouse: { id: string; name: string };
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  adjustmentDocument: InventoryCaseDocumentRef;
  adjustedBy: InventoryCaseUserRef;
  status: InventoryCaseStatus;
  closedAt: string | null;
  daysOpen: number;
}

export interface InventoryCaseListResponse {
  items: InventoryCaseRow[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    openCount: number;
    closedThisMonth: number;
    // Días promedio para cerrar (1 decimal) de los casos cerrados este mes; null si no hay.
    avgDaysToClose: number | null;
  };
}

export interface InventoryCaseOpenCount {
  count: number;
}

export interface InventoryCaseMovement {
  id: string;
  createdAt: string;
  movementType: string;
  quantity: number;
  previousStock: number | null;
  newStock: number | null;
  document: InventoryCaseDocumentRef | null;
  user: InventoryCaseUserRef | null;
}

export interface InventoryCaseDetail extends InventoryCaseRow {
  cause: InventoryCaseCause | null;
  justification: string | null;
  originDocument: InventoryCaseDocumentRef | null;
  closedBy: InventoryCaseUserRef | null;
  reopenedBy: InventoryCaseUserRef | null;
  reopenedAt: string | null;
  // Notas de la EAI que originó el caso.
  notes: string | null;
  // Últimos movimientos del producto en la bodega hasta el ajuste (el ajuste incluido), del más viejo al más nuevo.
  movements: InventoryCaseMovement[];
  // Solo una sugerencia: la salida anterior al ajuste que sacó exactamente las unidades ajustadas.
  suggestedOriginDocumentId: string | null;
}

export interface InventoryCaseReport {
  totals: {
    cases: number;
    closed: number;
    open: number;
    units: number;
    approxCost: number;
  };
  byCause: { cause: InventoryCaseCause; count: number }[];
  byWarehouse: {
    warehouseId: string;
    name: string;
    count: number;
    approxCost: number;
  }[];
  topProducts: {
    productId: string;
    code: string;
    description: string;
    count: number;
    units: number;
    approxCost: number;
    mostCommonCause: InventoryCaseCause | null;
  }[];
}
