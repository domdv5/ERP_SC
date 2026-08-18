export type DocumentType = 'CM' | 'DVC' | 'EAI' | 'SAJ' | 'T' | 'PV'
export type DocumentStatus = 'draft' | 'confirmed' | 'voided'
// Motivo del ajuste — obligatorio solo para documentos EAI (Entrada por Ajuste de Inventario).
export type EaiAdjustmentReason = 'negativo' | 'inventario_general' | 'traspaso_costo' | 'otro'

export interface DocumentWarehouse {
  id: string
  name: string
}

export interface DocumentThirdParty {
  id: string
  name: string
  // Solo presente cuando el tercero es proveedor — marcas activas que le pertenecen, usadas
  // en CM/DVC para filtrar/bloquear el buscador y el escaneo de producto por marca.
  // discountNotes: condiciones de descuento en texto libre, mostradas como banner informativo
  // solo en CM (ver DocumentFormPage.tsx) — nunca calculado, solo lectura.
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

export interface DocumentItem {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  unitCost: number
  subtotal: number
  // Nota de talla por línea, solo aplica a traslados (T) — permite registrar un mismo código
  // de producto dividido en varios bultos, cada uno con una talla distinta.
  observaciones?: string | null
  // Solo preventas (PV): cantidad ya liberada de la reserva lógica vía POST /documents/:id/release-items.
  releasedQuantity?: number
  // Solo preventas (PV): cantidad convertida a la unidad base cuando el producto se maneja por docena.
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
  // Solo documentos EAI — motivo del ajuste y explicación libre cuando adjustmentReason === 'otro'.
  adjustmentReason?: EaiAdjustmentReason | null
  adjustmentReasonOther?: string | null
  notes: string | null
  thirdParty: DocumentThirdParty | null
  user: DocumentUser
  warehouse: DocumentWarehouse | null
  destWarehouse: DocumentWarehouse | null
  _count: { documentItems: number }
  createdAt: string
}

export interface Document extends DocumentListItem {
  documentItems: DocumentItem[]
  destBin: DocumentBin | null
  sourceBin: DocumentBin | null
  sourceDocument: DocumentSourceRef | null
  confirmedBy: DocumentUser | null
  voidedBy: DocumentUser | null
  // Solo preventas (PV) — vendedora responsable de la operación, distinta del cliente (thirdParty).
  seller: DocumentThirdParty | null
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
}

export interface CreateDocumentItemPayload {
  productId: string
  quantity: number
  unitCost?: number
  // Solo preventas (PV) — precio unitario de venta de la línea; opcional (el backend usa
  // el salePrice vigente del producto si no se envía).
  unitPrice?: number
  observaciones?: string
}

export interface CreateDocumentPayload {
  type: DocumentType
  date: string
  thirdPartyId?: string
  // Solo preventas (PV) — vendedora responsable, a nivel de documento.
  sellerId?: string
  warehouseId?: string
  sourceBinId?: string
  destWarehouseId?: string
  destBinId?: string
  // Solo documentos EAI — motivo del ajuste; adjustmentReasonOther es obligatorio solo cuando
  // adjustmentReason === 'otro'.
  adjustmentReason?: EaiAdjustmentReason
  // null explícito (no undefined) cuando el motivo deja de ser 'otro' — así la clave viaja
  // en el JSON y el backend limpia la columna en vez de dejar el texto viejo huérfano.
  adjustmentReasonOther?: string | null
  notes?: string
  items: CreateDocumentItemPayload[]
}

export type UpdateDocumentPayload = Omit<CreateDocumentPayload, 'type'>

export interface ReleaseDocumentItemPayload {
  documentItemId: string
  quantity: number
}

export interface ReleaseItemsPayload {
  items: ReleaseDocumentItemPayload[]
  notes?: string
}
