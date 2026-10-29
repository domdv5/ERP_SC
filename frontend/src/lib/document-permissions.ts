import type { DocumentStatus, DocumentType } from '@/types/document.types'

// Ventas que se anulan con document.void.{TIPO}; el resto de tipos sigue con su permiso de siempre.
const VOID_PERMISSION_TYPES: ReadonlySet<DocumentType> = new Set(['POS', 'COT', 'POSO', 'REM'])

export function canVoidDocument(type: DocumentType, permissions: readonly string[]): boolean {
  return !VOID_PERMISSION_TYPES.has(type) || permissions.includes(`document.void.${type}`)
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

// Tipos que el usuario ve en el listado: crea, anula o convierte (document.create/void/convert.*), igual que el backend.
const VISIBILITY_PREFIXES = ['document.create.', 'document.void.', 'document.convert.']

export function visibleDocumentTypes(permissions: readonly string[]): DocumentType[] {
  const types = new Set<DocumentType>()
  for (const p of permissions) {
    const prefix = VISIBILITY_PREFIXES.find((pre) => p.startsWith(pre))
    if (prefix) types.add(p.slice(prefix.length) as DocumentType)
  }
  return [...types]
}

// Mismo criterio que el backend para el detalle: cartera y libro oficial ven cualquier tipo.
const SEE_ALL_PERMISSIONS = ['ar.read', 'ap.read', 'official.read']

export function canViewDocument(type: DocumentType, permissions: readonly string[]): boolean {
  return (
    SEE_ALL_PERMISSIONS.some((p) => permissions.includes(p)) ||
    visibleDocumentTypes(permissions).includes(type)
  )
}
