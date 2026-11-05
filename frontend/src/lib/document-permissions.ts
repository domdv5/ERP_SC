import type { DocumentStatus, DocumentType } from '@/types/document.types'

// Record exige listar todos los tipos: si el contrato agrega uno, no compila hasta sumarlo aquí.
const DOCUMENT_TYPE_KEYS: Record<DocumentType, true> = {
  CM: true,
  DVC: true,
  RMDVC: true,
  PE: true,
  EAI: true,
  SAJ: true,
  COT: true,
  POS: true,
  REM: true,
  DVV: true,
  T: true,
  PV: true,
  CMO: true,
  POSO: true,
}
const ALL_DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_KEYS) as DocumentType[]

// Ventas que se anulan con document.void.{TIPO}; el resto se anula con el mismo permiso que lo crea, igual que el backend.
const VOID_PERMISSION_TYPES: ReadonlySet<DocumentType> = new Set(['POS', 'COT', 'POSO', 'REM'])

export function canVoidDocument(type: DocumentType, permissions: readonly string[]): boolean {
  const action = VOID_PERMISSION_TYPES.has(type) ? 'void' : 'create'
  return permissions.includes(`document.${action}.${type}`)
}

// Editar, eliminar y confirmar un borrador exigen document.create.{TIPO} en el backend.
export function canChangeDocument(type: DocumentType, permissions: readonly string[]): boolean {
  return permissions.includes(`document.create.${type}`)
}

// Tipos que validan disponible al confirmar (findMissingStock en el backend); el endpoint exige document.create.{TIPO}.
const STOCK_CHECK_TYPES: ReadonlySet<DocumentType> = new Set(['POS', 'COT', 'PV', 'REM'])

export function canCheckMissingStock(
  doc: { type: DocumentType; status: DocumentStatus },
  permissions: readonly string[],
): boolean {
  return (
    doc.status === 'draft' &&
    STOCK_CHECK_TYPES.has(doc.type) &&
    permissions.includes(`document.create.${doc.type}`)
  )
}

// Cartera y libro oficial enlazan a cualquier tipo, así que quien los lee ve todos, igual que el backend.
const SEE_ALL_PERMISSIONS = ['ar.read', 'ap.read', 'official.read']

const VISIBILITY_PREFIXES = ['document.create.', 'document.void.', 'document.convert.']

// Tipos que generan movimientos de kardex: los que ve quien solo tiene inventory_case.read (espeja STOCK_MOVING_TYPES del backend).
const STOCK_MOVING_TYPES: readonly DocumentType[] = [
  'CM',
  'DVC',
  'EAI',
  'SAJ',
  'T',
  'POS',
  'COT',
  'DVV',
]

// Tipos que el usuario ve en el listado y en el detalle: todos con cartera o libro oficial; si no, los que crea, anula o convierte.
export function visibleDocumentTypes(permissions: readonly string[]): DocumentType[] {
  if (SEE_ALL_PERMISSIONS.some((p) => permissions.includes(p))) return ALL_DOCUMENT_TYPES
  const types = new Set<DocumentType>()
  if (permissions.includes('inventory_case.read')) STOCK_MOVING_TYPES.forEach((t) => types.add(t))
  for (const p of permissions) {
    const prefix = VISIBILITY_PREFIXES.find((pre) => p.startsWith(pre))
    if (prefix) types.add(p.slice(prefix.length) as DocumentType)
  }
  return [...types]
}

export function canViewDocument(type: DocumentType, permissions: readonly string[]): boolean {
  return visibleDocumentTypes(permissions).includes(type)
}
