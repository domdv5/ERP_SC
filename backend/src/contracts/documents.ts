// Contrato de documentos: lo que GET /documents y GET /documents/:id entregan, tal como viaja en JSON.
// Solo tipos planos: sin importar Prisma ni NestJS (el frontend lo importa con `import type`).
// Decimal y Date viajan como string.

export type DocumentType =
  | 'CM'
  | 'DVC'
  | 'RMDVC'
  | 'PE'
  | 'EAI'
  | 'SAJ'
  | 'COT'
  | 'POS'
  | 'REM'
  | 'DVV'
  | 'T'
  | 'PV'
  | 'CMO'
  | 'POSO';
export type DocumentStatus = 'draft' | 'confirmed' | 'voided';
export type PaymentMethod = 'efectivo_almacen' | 'consignacion_almacen';
export type EaiAdjustmentReason =
  'negativo' | 'inventario_general' | 'traspaso_costo' | 'otro';
export type DvvRefundMethod =
  'saldo_a_favor' | 'cambio_producto' | 'devolucion_dinero';
export type PvConversionStatus = 'none' | 'pending' | 'converted';

export interface DocumentWarehouse {
  id: string;
  name: string;
}

export interface DocumentThirdParty {
  id: string;
  name: string;
}

// Solo en el detalle: si es proveedor, sus marcas activas y las notas de descuento.
export interface DocumentThirdPartyDetail extends DocumentThirdParty {
  supplier: {
    discountNotes: string | null;
    brands: { id: string; name: string }[];
  } | null;
}

export interface DocumentCustomerBranch {
  id: string;
  name: string;
  address: string | null;
  city: { name: string; department: { name: string } } | null;
}

export interface DocumentUser {
  id: string;
  name: string;
}

export interface DocumentBin {
  id: string;
  code: number;
  zone: { name: string };
}

export interface DocumentSourceRef {
  id: string;
  type: DocumentType;
  number: string;
}

// El number ya viaja con ceros a la izquierda (ej. "000012").
export interface PvDerivedDocRef {
  id: string;
  type: DocumentType;
  number: string;
  status: DocumentStatus;
}

// Solo PV/REM; en el resto el bloque `pv` es null.
export interface PvStatus {
  conversion: {
    status: PvConversionStatus;
    documents: PvDerivedDocRef[];
  };
}

export interface DocumentItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  unitCost: string;
  subtotal: string;
  addedAt: string;
  // Solo CMO/POSO.
  taxAmount: string | null;
  observaciones: string | null;
  releasedQuantity: number;
  convertedQuantity: number;
  product: {
    id: string;
    code: string;
    description: string;
    avgCost: string;
    unitOfMeasure: 'unidad' | 'docena';
  };
}

export interface DocumentPayment {
  method: PaymentMethod;
  amount: string;
}

export interface CustomerCreditApplication {
  id: string;
  amount: string;
  saleDocumentId: string;
  saleDocument: { type: DocumentType };
  appliedAt: string;
}

// Saldo a favor que originó una DVV.
export interface CustomerCredit {
  id: string;
  amount: string;
  balance: string;
  status: string;
  createdAt: string;
  applications: CustomerCreditApplication[];
}

// Saldo a favor aplicado a una venta POS/COT, visto desde esa venta.
export interface AppliedCustomerCredit {
  id: string;
  amount: string;
  appliedAt: string;
  customerCredit: {
    id: string;
    sourceDocument: DocumentSourceRef | null;
  };
}

// Campos que tienen en común una fila del listado y el detalle.
interface DocumentBase {
  id: string;
  type: DocumentType;
  number: string;
  date: string;
  status: DocumentStatus;
  total: string;
  notes: string | null;
  adjustmentReason: EaiAdjustmentReason | null;
  adjustmentReasonOther: string | null;
  refundMethod: DvvRefundMethod | null;
  officialPurchase: boolean;
  supplierInvoiceNumber: string | null;
  // Solo CMO/POSO: IVA total del documento.
  taxTotal: string | null;
  thirdParty: DocumentThirdParty | null;
  user: DocumentUser;
  updatedBy: DocumentUser | null;
  confirmedBy: DocumentUser | null;
  voidedBy: DocumentUser | null;
  warehouse: DocumentWarehouse | null;
  destWarehouse: DocumentWarehouse | null;
  editedAt: string | null;
  confirmedAt: string | null;
  voidedAt: string | null;
  createdAt: string;
  pv: PvStatus | null;
  // Solo CM: sus CMO no anuladas; null en otros tipos.
  officialPurchases: PvDerivedDocRef[] | null;
}

// Una fila de GET /documents.
export interface DocumentListItem extends DocumentBase {
  _count: { documentItems: number };
}

// GET /documents/:id (también lo devuelven confirm, void, convert, duplicate y release).
export interface DocumentDetail extends DocumentBase {
  thirdParty: DocumentThirdPartyDetail | null;
  thirdPartyId: string | null;
  sellerId: string | null;
  receiverId: string | null;
  customerBranchId: string | null;
  warehouseId: string | null;
  destWarehouseId: string | null;
  sourceBinId: string | null;
  destBinId: string | null;
  sourceDocumentId: string | null;
  convertedAt: string | null;
  documentItems: DocumentItem[];
  payments: DocumentPayment[];
  seller: DocumentThirdParty | null;
  receiver: DocumentThirdParty | null;
  customerBranch: DocumentCustomerBranch | null;
  convertedBy: DocumentUser | null;
  destBin: DocumentBin | null;
  sourceDocument: DocumentSourceRef | null;
  customerCredits: CustomerCredit[];
  appliedCustomerCredits: AppliedCustomerCredit[];
}

export interface DocumentMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  draftCount: number;
  confirmedCount: number;
}

export interface DocumentListResponse {
  items: DocumentListItem[];
  meta: DocumentMeta;
}
