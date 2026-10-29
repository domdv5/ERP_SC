export type {
  AppliedCustomerCredit,
  CustomerCredit,
  CustomerCreditApplication,
  DocumentBin,
  DocumentCustomerBranch,
  DocumentDetail,
  DocumentItem,
  DocumentListItem,
  DocumentMeta,
  DocumentPayment,
  DocumentSourceRef,
  DocumentStatus,
  DocumentThirdParty,
  DocumentThirdPartyDetail,
  DocumentType,
  DocumentUser,
  DocumentWarehouse,
  DvvRefundMethod,
  EaiAdjustmentReason,
  PaymentMethod,
  PvConversionStatus,
  PvDerivedDocRef,
  PvStatus,
} from '@contracts/documents'

import type {
  DocumentType,
  DocumentStatus,
  EaiAdjustmentReason,
  DvvRefundMethod,
  PaymentMethod,
} from '@contracts/documents'

// Fila de la bandeja "Compras oficiales pendientes": CM confirmada oficial sin CMO confirmada enlazada.
export interface PendingOfficialPurchase {
  id: string
  number: number | string
  date: string
  supplierInvoiceNumber: string | null
  total: number | string
  thirdParty: { id: string; name: string } | null
  documentItems: {
    productId: string
    quantity: number
    unitCost: number | string
    product: { id: string; code: string; description: string }
  }[]
}

export interface PendingOfficialPurchasesMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface GetPendingOfficialPurchasesParams {
  page?: number
  limit?: number
  supplierId?: string
  search?: string
  dateFrom?: string
  dateTo?: string
}

// Saldo a favor disponible de un cliente, tal como lo devuelve el endpoint de saldos
// disponibles del checkout. Solo trae los que están disponibles y con saldo mayor a cero.
export interface AvailableCustomerCredit {
  id: string
  amount: number
  balance: number
  status: string
  createdAt: string
  sourceDocument: { id: string; type: DocumentType; number: number; date: string }
}

export interface AvailableCustomerCreditsResponse {
  credits: AvailableCustomerCredit[]
  totalAvailable: number
}

export interface GetDocumentsParams {
  page?: number
  limit?: number
  type?: DocumentType
  types?: string
  status?: DocumentStatus
  dateFrom?: string
  dateTo?: string
  search?: string
  // Buscar preventas activas de un cliente (lo usa el checkout de ventas): trae las preventas
  // confirmadas de ese cliente.
  thirdPartyId?: string
}

export interface CreateDocumentItemPayload {
  productId: string
  quantity: number
  unitCost?: number
  // Solo preventas y remisiones: precio de venta de la línea. Es opcional; si no se envía, el
  // backend usa el precio de venta actual del producto.
  unitPrice?: number
  observaciones?: string
  addedAt?: string
}

export interface CreateDocumentPayload {
  type: DocumentType
  date: string
  thirdPartyId?: string
  // Solo ventas de clientes con sucursales (obligatoria); null al editar la quita.
  customerBranchId?: string | null
  // Solo preventas y remisiones: vendedora responsable, a nivel de documento.
  sellerId?: string
  // Solo compras (CM), obligatorio: quién recibió la mercancía.
  receiverId?: string
  warehouseId?: string
  sourceBinId?: string
  destWarehouseId?: string
  destBinId?: string
  // Solo en entradas por ajuste; la explicación libre es obligatoria solo si el motivo es "otro".
  adjustmentReason?: EaiAdjustmentReason
  // Se manda null explícito (no undefined) cuando el motivo deja de ser "otro": así la clave
  // viaja en el JSON y el backend borra el texto viejo en vez de dejarlo guardado.
  adjustmentReasonOther?: string | null
  notes?: string
  // Solo POS/POSO de contado: deben sumar el total a cobrar al confirmar; al editar reemplaza todas las líneas.
  payments?: { method: PaymentMethod; amount: number }[]
  // Solo DVV, obligatorio: define si deja saldo a favor, es cambio de producto, o devuelve dinero.
  refundMethod?: DvvRefundMethod
  // Solo en creación COT: backend netea la CxC y valida cupo sobre el neto (POS los aplica recién al confirmar).
  customerCredits?: { customerCreditId: string; amount: number }[]
  // Solo CM: el backend rechaza el flag en otros tipos; con true exige supplierInvoiceNumber.
  officialPurchase?: boolean
  // Solo CM oficial y CMO; '' al editar limpia el valor guardado.
  supplierInvoiceNumber?: string
  // Solo CMO: CM oficial confirmada de la que se precargó la compra; null al editar quita el vínculo.
  sourceDocumentId?: string | null
  // Una por formulario abierto: si se reintenta tras un fallo de red, el backend devuelve el documento ya creado.
  idempotencyKey?: string
  items: CreateDocumentItemPayload[]
}

export type UpdateDocumentPayload = Omit<CreateDocumentPayload, 'type' | 'idempotencyKey'>

// Body opcional de confirm, solo POS/COT: aplica saldos a favor del cliente al confirmar.
export interface ConfirmDocumentPayload {
  customerCredits?: { customerCreditId: string; amount: number }[]
}

export interface ConvertDocumentPayload {
  // El backend permite convertir una preventa o remisión confirmada en venta de contado o a crédito.
  targetType: 'POS' | 'COT'
}

// Resumen del cupo de crédito del cliente, en pesos. El disponible es el límite menos lo
// usado (puede ser negativo).
export interface CreditLimitSummary {
  creditLimit: number
  usedCredit: number
  availableCredit: number
}

// Cuerpo del error "cupo excedido" (al crear, confirmar o convertir una venta a crédito).
// `credit` viaja al lado de `message` en la respuesta, igual que los faltantes del error de stock.
export interface CreditLimitExceededDetail extends CreditLimitSummary {
  requested: number
}

export interface ReleaseDocumentItemPayload {
  documentItemId: string
  quantity: number
}

// El backend responde { message, missingStock } al confirmar y GET /documents/:id/missing-stock lo devuelve directo
export interface MissingStockItem {
  productId: string
  code: string
  available: number
  requested: number
}

export interface ReleaseItemsPayload {
  items: ReleaseDocumentItemPayload[]
  notes?: string
}
