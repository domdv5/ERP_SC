import { Link } from 'react-router-dom'
import { docNumber } from '@/lib/format'
import { canViewDocument } from '@/lib/document-permissions'
import { useAuthStore } from '@/stores/auth.store'
import type { InventoryCaseDocumentRef } from '@/types/inventory-case.types'

interface DocumentLinkProps {
  document: InventoryCaseDocumentRef
  // Evita que el clic en el enlace abra también la fila de la tabla.
  stopPropagation?: boolean
}

// inventory_case.read ya ve todos los tipos, pero el chequeo se deja por si el rol cambia.
export function DocumentLink({ document, stopPropagation = false }: DocumentLinkProps) {
  const userPermissions = useAuthStore((s) => s.user?.permissions)
  const label = docNumber(document.type, document.number)
  if (!canViewDocument(document.type, userPermissions ?? [])) {
    return <span className="font-mono text-xs">{label}</span>
  }
  return (
    <Link
      to={`/documents/${document.id}`}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
      className="link-plain font-mono text-xs"
    >
      {label}
    </Link>
  )
}
