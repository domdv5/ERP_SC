export type DocumentType = 'CM' | 'DVC' | 'EAI' | 'SAJ' | 'T'
export type DocumentStatus = 'draft' | 'confirmed' | 'voided'

export interface DocumentWarehouse {
  id: string
  name: string
}

export interface DocumentThirdParty {
  id: string
  name: string
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
  product: {
    id: string
    code: string
    description: string
  }
}

export interface DocumentListItem {
  id: string
  type: DocumentType
  number: number
  date: string
  status: DocumentStatus
  total: number
  freight: number | null
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
  sourceDocument: DocumentSourceRef | null
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
  observaciones?: string
}

export interface CreateDocumentPayload {
  type: DocumentType
  date: string
  thirdPartyId?: string
  warehouseId?: string
  destWarehouseId?: string
  destBinId?: string
  freight?: number
  notes?: string
  items: CreateDocumentItemPayload[]
}

export type UpdateDocumentPayload = Omit<CreateDocumentPayload, 'type'>
