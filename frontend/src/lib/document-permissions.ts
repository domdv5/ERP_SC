import type { DocumentType } from '@/types/document.types'

// Ventas que se anulan con document.void.{TIPO}; el resto de tipos sigue con su permiso de siempre.
const VOID_PERMISSION_TYPES: ReadonlySet<DocumentType> = new Set(['POS', 'COT', 'POSO', 'REM'])

export function canVoidDocument(type: DocumentType, permissions: readonly string[]): boolean {
  return !VOID_PERMISSION_TYPES.has(type) || permissions.includes(`document.void.${type}`)
}

// Tipos que el usuario ve en el listado: crea (document.create.*) o anula (document.void.*), igual que el backend.
export function visibleDocumentTypes(permissions: readonly string[]): DocumentType[] {
  const types = new Set<DocumentType>()
  for (const p of permissions) {
    if (p.startsWith('document.create.'))
      types.add(p.slice('document.create.'.length) as DocumentType)
    else if (p.startsWith('document.void.'))
      types.add(p.slice('document.void.'.length) as DocumentType)
  }
  return [...types]
}
