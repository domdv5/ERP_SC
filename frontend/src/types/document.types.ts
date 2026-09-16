// POS = venta de contado, COT = venta a crédito. Ambas comparten la pantalla de checkout
// (POSCheckoutPage con toggle Contado/Crédito); COT además valida el cupo del cliente y
// genera una cuenta por cobrar al confirmar.
// REM = remisión: documento transitorio "gemelo de PV" — reserva lógica de stock (sin
// movimiento físico), convertible a POS/COT, con liberación parcial. En el frontend se
// trata casi idéntico a PV (mismo form genérico, mismas columnas de reserva).
export type DocumentType = 'CM' | 'DVC' | 'EAI' | 'SAJ' | 'T' | 'PV' | 'POS' | 'COT' | 'REM' | 'DVV'
export type DocumentStatus = 'draft' | 'confirmed' | 'voided'
export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia'
// Motivo del ajuste — obligatorio solo para documentos EAI (Entrada por Ajuste de Inventario).
export type EaiAdjustmentReason = 'negativo' | 'inventario_general' | 'traspaso_costo' | 'otro'
// Modalidad de una devolución en venta (DVV), obligatoria al crearla. "Saldo a favor" y
// "cambio de producto" generan una nota de saldo a favor del cliente; "devolución de dinero"
// solo revierte el inventario y no deja saldo.
export type DvvRefundMethod = 'saldo_a_favor' | 'cambio_producto' | 'devolucion_dinero'

export interface DocumentWarehouse {
  id: string
  name: string
}

export interface DocumentThirdParty {
  id: string
  name: string
  // Solo viene cuando el tercero es proveedor: sus marcas activas. En compras y devoluciones
  // se usan para limitar el buscador y el escaneo de productos a esas marcas.
  // discountNotes: condiciones de descuento en texto libre, se muestran como aviso solo en
  // compras. Nunca se calcula nada, es solo lectura.
  supplier?: { brands: { id: string; name: string }[]; discountNotes?: string | null } | null
}

export interface DocumentUser {
  id: number
  name: string
}

export interface DocumentBin {
  id: string
  name: string
  zone: {
    name: string
  }
}

export interface DocumentSourceRef {
  id: string
  type: DocumentType
  number: number
}

export type PvConversionStatus = 'none' | 'pending' | 'converted'

// Referencia liviana a una venta derivada de una preventa o remisión. El backend la incluye
// en el bloque de estado de conversión de esos documentos.
export interface PvDerivedDocRef {
  id: string
  type: DocumentType
  // El backend ya lo manda con ceros a la izquierda (ej. "000012"); mostrarlo tal cual junto al tipo.
  number: string
  status: DocumentStatus
}

// Bloque que arma el backend, presente en preventas y remisiones (null en el resto):
// - converted: tiene al menos una venta derivada confirmada.
// - pending: tiene alguna venta derivada sin anular, pero ninguna confirmada.
// - none: no tiene derivadas o están todas anuladas.
// `documents` trae TODAS las derivadas, anuladas incluidas; el front filtra según el estado.
// La clave se sigue llamando `pv` por historia.
export interface PvStatus {
  conversion: {
    status: PvConversionStatus
    documents: PvDerivedDocRef[]
  }
}

export interface DocumentItem {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  unitCost: number
  subtotal: number
  // Nota de talla por línea, solo en traslados: permite registrar un mismo producto repartido
  // en varios bultos, cada uno con una talla distinta.
  observaciones?: string | null
  // Solo preventas y remisiones: cantidad ya liberada de la reserva.
  releasedQuantity?: number
  // Solo preventas y remisiones: cantidad ya convertida a una venta.
  convertedQuantity?: number
  product: {
    id: string
    code: string
    description: string
    avgCost: string
    unitOfMeasure: 'unidad' | 'docena'
  }
}

export interface DocumentListItem {
  id: string
  type: DocumentType
  number: number
  date: string
  status: DocumentStatus
  total: number
  // Solo en entradas por ajuste: el motivo y, cuando el motivo es "otro", la explicación libre.
  adjustmentReason?: EaiAdjustmentReason | null
  adjustmentReasonOther?: string | null
  notes: string | null
  thirdParty: DocumentThirdParty | null
  user: DocumentUser
  warehouse: DocumentWarehouse | null
  destWarehouse: DocumentWarehouse | null
  // Solo en ventas de contado; null en el resto. Es solo informativo.
  paymentMethod: PaymentMethod | null
  _count: { documentItems: number }
  createdAt: string
  // Preventas y remisiones: estado de conversión a venta y sus documentos derivados. null en el resto.
  pv: PvStatus | null
}

export interface Document extends DocumentListItem {
  documentItems: DocumentItem[]
  destBin: DocumentBin | null
  sourceBin: DocumentBin | null
  sourceDocument: DocumentSourceRef | null
  confirmedBy: DocumentUser | null
  voidedBy: DocumentUser | null
  // Solo en el detalle, no en el listado. updatedBy: quién editó el borrador por última vez
  // (null si nunca se editó). convertedBy / convertedAt: quién y cuándo convirtió el documento
  // en una venta (solo preventas y remisiones; null si no se convirtió).
  updatedBy?: DocumentUser | null
  convertedBy?: DocumentUser | null
  convertedAt?: string | null
  // Preventas y remisiones: vendedora responsable, distinta del cliente.
  seller: DocumentThirdParty | null
  // Solo en devoluciones en venta (DVV): modalidad de la devolución.
  refundMethod?: DvvRefundMethod | null
  // Solo en DVV con modalidad "saldo a favor" o "cambio de producto": las notas de saldo a
  // favor que generó esta devolución (vacío en "devolución de dinero").
  customerCredits?: CustomerCredit[]
  // Solo en ventas POS/COT: los saldos a favor que se aplicaron a esta venta.
  appliedCustomerCredits?: AppliedCustomerCredit[]
}

// Nota de saldo a favor generada por una devolución en venta. `balance` es lo que queda
// disponible tras las aplicaciones; `applications` lista en qué ventas se usó.
export interface CustomerCredit {
  id: string
  amount: number
  balance: number
  status: string
  createdAt: string
  applications: CustomerCreditApplication[]
}

export interface CustomerCreditApplication {
  id: string
  amount: number
  saleDocumentId: string
  appliedAt: string
}

// Aplicación de un saldo a favor vista desde la venta que lo consumió (bloque del detalle de
// POS/COT). Enlaza con la DVV que originó el saldo.
export interface AppliedCustomerCredit {
  id: string
  amount: number
  appliedAt: string
  customerCredit: {
    id: string
    sourceDocument: { id: string; type: DocumentType; number: number }
  }
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

export interface DocumentMeta {
  total: number
  page: number
  limit: number
  totalPages: number
  draftCount: number
  confirmedCount: number
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
}

export interface CreateDocumentPayload {
  type: DocumentType
  date: string
  thirdPartyId?: string
  // Solo preventas y remisiones: vendedora responsable, a nivel de documento.
  sellerId?: string
  warehouseId?: string
  sourceBinId?: string
  destWarehouseId?: string
  destBinId?: string
  // Solo en entradas por ajuste: el motivo. La explicación libre es obligatoria solo cuando el
  // motivo es "otro".
  adjustmentReason?: EaiAdjustmentReason
  // Se manda null explícito (no undefined) cuando el motivo deja de ser "otro": así la clave
  // viaja en el JSON y el backend borra el texto viejo en vez de dejarlo guardado.
  adjustmentReasonOther?: string | null
  notes?: string
  // Solo en ventas de contado, donde es obligatorio (lo valida el backend; en el tipo queda opcional).
  paymentMethod?: PaymentMethod
  // Solo en devoluciones en venta (DVV): obligatorio. Define si la devolución deja saldo a
  // favor, es para cambio de producto, o se devuelve en dinero.
  refundMethod?: DvvRefundMethod
  // Saldos a favor del cliente que se aplican a esta venta. Solo lo usa la creación de ventas
  // a crédito (COT): el backend netea la cuenta por cobrar y valida el cupo sobre el neto. No
  // se persiste como tal; el POS los aplica recién al confirmar.
  customerCredits?: { customerCreditId: string; amount: number }[]
  items: CreateDocumentItemPayload[]
}

export type UpdateDocumentPayload = Omit<CreateDocumentPayload, 'type'>

// Cuerpo opcional de POST /documents/:id/confirm. Solo lo usan las ventas POS/COT para
// aplicar saldos a favor del cliente al confirmar. Sin cuerpo, el confirm se comporta igual
// que siempre.
export interface ConfirmDocumentPayload {
  customerCredits?: { customerCreditId: string; amount: number }[]
}

export interface ConvertDocumentPayload {
  // El backend permite convertir una preventa o remisión confirmada en venta de contado o a crédito.
  targetType: 'POS' | 'COT'
  // Solo aplica al convertir a venta de contado; la venta a crédito no lleva forma de pago.
  paymentMethod?: PaymentMethod
}

// Resumen del cupo de crédito del cliente, en pesos. El disponible es el límite menos lo
// usado (puede ser negativo).
export interface CustomerCreditSummary {
  creditLimit: number
  usedCredit: number
  availableCredit: number
}

// Cuerpo del error "cupo excedido" (al crear, confirmar o convertir una venta a crédito).
// `credit` viaja al lado de `message` en la respuesta, igual que los faltantes del error de stock.
export interface CreditLimitExceededDetail extends CustomerCreditSummary {
  requested: number
}

export interface ReleaseDocumentItemPayload {
  documentItemId: string
  quantity: number
}

export interface ReleaseItemsPayload {
  items: ReleaseDocumentItemPayload[]
  notes?: string
}
