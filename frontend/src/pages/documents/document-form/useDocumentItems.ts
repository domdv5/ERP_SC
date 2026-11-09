import { useRef, useState } from 'react'
import { useFieldArray, type Control } from 'react-hook-form'
import type { FormValues } from '../document-form.schema'

export type ScannedProductInfo = Record<
  string,
  { avgCost: number; unitOfMeasure: 'unidad' | 'docena'; availableToSell?: number }
>

export function useDocumentItems(control: Control<FormValues>) {
  // Datos del producto al momento de escanearlo; availableToSell queda vacío al reabrir un borrador (mostrar el "actual" engañaría, ya está reservando).
  const [scannedProductInfo, setScannedProductInfo] = useState<ScannedProductInfo>({})

  const barcodeInputRef = useRef<{ focus: () => void }>(null)
  // Lecturas del lector todavía en fila: mientras haya, no se guarda el documento
  const [isScanPending, setIsScanPending] = useState(false)

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' })

  return {
    fields,
    append,
    remove,
    replace,
    scannedProductInfo,
    setScannedProductInfo,
    barcodeInputRef,
    isScanPending,
    setIsScanPending,
  }
}

export type DocumentItems = ReturnType<typeof useDocumentItems>
