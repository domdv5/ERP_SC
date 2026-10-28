import { useEffect, useRef, useState } from 'react'
import { useFieldArray, type Control } from 'react-hook-form'
import type { FormValues } from '../document-form.schema'

export type ScannedProductInfo = Record<
  string,
  { avgCost: number; unitOfMeasure: 'unidad' | 'docena'; availableStock?: number }
>

export function useDocumentItems(control: Control<FormValues>) {
  // Datos del producto al momento de escanearlo; availableStock queda vacío al reabrir un borrador (mostrar el "actual" engañaría, ya está reservando).
  const [scannedProductInfo, setScannedProductInfo] = useState<ScannedProductInfo>({})

  // useRef, no useState: la lista de referencias del ciclo escanear → cantidad → escanear no debe provocar re-render.
  const quantityInputRefs = useRef<Map<number, HTMLInputElement>>(new Map())
  const barcodeInputRef = useRef<{ focus: () => void }>(null)
  const [pendingQuantityFocusIndex, setPendingQuantityFocusIndex] = useState<number | null>(null)

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' })

  // `fields` en las dependencias: si el índice pendiente se fija junto con la fila nueva, el efecto se re-evalúa cuando ya está montada.
  useEffect(() => {
    if (pendingQuantityFocusIndex === null) return
    quantityInputRefs.current.get(pendingQuantityFocusIndex)?.focus()
    setPendingQuantityFocusIndex(null)
  }, [pendingQuantityFocusIndex, fields])

  return {
    fields,
    append,
    remove,
    replace,
    scannedProductInfo,
    setScannedProductInfo,
    quantityInputRefs,
    barcodeInputRef,
    setPendingQuantityFocusIndex,
  }
}

export type DocumentItems = ReturnType<typeof useDocumentItems>
