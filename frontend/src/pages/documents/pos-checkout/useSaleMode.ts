import { useState } from 'react'
import { usePermission } from '@/hooks/usePermission'
import { DOC_TYPE_ACCENT } from '@/pages/documents/document.constants'
import type { DocumentType } from '@/types/document.types'

// Modo del checkout: venta de contado (POS) o venta a crédito (COT). COT no lleva forma de
// pago, valida el cupo de crédito del cliente y genera una cuenta por cobrar al confirmar.
export type SaleMode = Extract<DocumentType, 'POS' | 'COT'>

export function useSaleMode() {
  // Solo visible con permiso COT; se bloquea con borrador en curso (el tipo de un documento creado no cambia).
  const canCreateCOT = usePermission('document.create.COT')
  const canCreatePOSO = usePermission('document.create.POSO')
  const [mode, setMode] = useState<SaleMode>('POS')
  // Venta oficial (POSO): solo contado, precios con IVA, sin stock ni saldos a favor; se bloquea con borrador en curso.
  const [official, setOfficial] = useState(false)
  const isCredit = mode === 'COT'
  const docType: DocumentType = official ? 'POSO' : mode
  const accent = DOC_TYPE_ACCENT[docType]

  return {
    canCreateCOT,
    canCreatePOSO,
    mode,
    setMode,
    official,
    setOfficial,
    isCredit,
    docType,
    accent,
  }
}
