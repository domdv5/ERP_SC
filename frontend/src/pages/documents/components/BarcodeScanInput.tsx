import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { ScanLine } from 'lucide-react'
import { toast } from 'sonner'
import type { UseFieldArrayAppend, UseFormGetValues, UseFormSetValue } from 'react-hook-form'
import { getProductByCode } from '@/services/products.service'
import { cn } from '@/lib/utils'
import type { ProductByCode } from '@/types/product.types'
import type { DocumentType } from '@/types/document.types'
import type { FormValues } from '@/pages/documents/document-form.schema'
import { suggestedUnitCost } from '@/lib/suggested-unit-cost'
import { createScanQueue, findRowIndexByCode } from './scan-queue'
import { findRowIndexToAdd, separatesRows } from './row-grouping'

export interface BarcodeScanInputHandle {
  focus: () => void
}

interface BarcodeScanInputProps {
  docType: DocumentType
  append: UseFieldArrayAppend<FormValues, 'items'>
  getValues: UseFormGetValues<FormValues>
  setValue: UseFormSetValue<FormValues>
  onProductScanned: (
    productId: string,
    avgCost: number,
    unitOfMeasure: 'unidad' | 'docena',
    availableToSell: number,
  ) => void
  // true mientras haya lecturas en la fila; el documento no se guarda hasta que vuelva a false
  onPendingChange?: (hasPending: boolean) => void
  // Marcas del proveedor elegido (solo compras/devoluciones); otra marca bloquea el escaneo, no solo avisa
  supplierBrandIds?: string[]
  disabled?: boolean
  // Solo para el mensaje de bloqueo por marca
  supplierName?: string
}

// Input siempre enfocado para lector de código de barras: cada Enter entra a la fila y suma cantidad o agrega fila
// No reusa el Combobox compartido porque ese solo funciona con mouse, incompatible con un lector
export const BarcodeScanInput = forwardRef<BarcodeScanInputHandle, BarcodeScanInputProps>(
  function BarcodeScanInput(
    {
      docType,
      append,
      getValues,
      setValue,
      onProductScanned,
      onPendingChange,
      supplierBrandIds,
      disabled,
      supplierName,
    },
    ref,
  ) {
    const inputRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => ({
      focus: () => {
        if (!disabled) inputRef.current?.focus()
      },
    }))

    useEffect(() => {
      if (disabled) return
      inputRef.current?.focus()
    }, [disabled])

    const addOneTo = (index: number, productCode: string) => {
      const currentQty = Number(getValues(`items.${index}.quantity`)) || 0
      setValue(`items.${index}.quantity`, currentQty + 1)
      setValue(`items.${index}.addedAt`, new Date().toISOString())
      toast.success(`${productCode} — cantidad +1`)
    }

    const processCode = async (code: string) => {
      const currentItems = getValues('items')
      // Producto ya en la fila que corresponde: +1 sin ir al servidor; su precio y costo ya quedaron en la fila
      const rowIndex = findRowIndexByCode(currentItems, code, separatesRows(docType))
      if (rowIndex >= 0) {
        addOneTo(rowIndex, currentItems[rowIndex].productCode)
        return
      }

      let product: ProductByCode
      try {
        product = await getProductByCode(code)
      } catch (error) {
        if ((error as { response?: { status?: number } })?.response?.status === 404) {
          toast.error(`Código no encontrado: ${code}`)
        } else {
          toast.error('Error al buscar el producto')
        }
        return
      }

      // Bloqueo total, no solo aviso: marca distinta del proveedor elegido es siempre un error real
      if (supplierBrandIds !== undefined && !supplierBrandIds.includes(product.brandId)) {
        toast.error(
          `${product.code} no pertenece a las marcas de ${supplierName ?? 'este proveedor'}`,
        )
        return
      }

      const itemsNow = getValues('items')
      const existingIndex = findRowIndexToAdd(itemsNow, docType, product.id)
      if (existingIndex >= 0) {
        addOneTo(existingIndex, product.code)
        return
      }

      const avgCost = Number(product.avgCost)
      const salePrice = Number(product.salePrice)
      const shouldPrefillPrice =
        docType === 'PV' || docType === 'POS' || docType === 'COT' || docType === 'POSO'
      append(
        {
          productId: product.id,
          productCode: product.code,
          productDesc: product.description,
          quantity: 1,
          unitCost: suggestedUnitCost(docType, product),
          unitPrice: shouldPrefillPrice ? salePrice : undefined,
          observaciones: undefined,
          addedAt: new Date().toISOString(),
        },
        // El foco se queda en el escaneo para poder pistolear seguido
        { shouldFocus: false },
      )
      onProductScanned(product.id, avgCost, product.unitOfMeasure, product.availableToSell)
      toast.success(`${product.code} agregado`)
    }

    // La fila se crea una sola vez: lee siempre la versión de processCode con las props actuales
    const processCodeRef = useRef(processCode)
    processCodeRef.current = processCode
    const onPendingChangeRef = useRef(onPendingChange)
    onPendingChangeRef.current = onPendingChange
    const queueRef = useRef<ReturnType<typeof createScanQueue> | null>(null)
    queueRef.current ??= createScanQueue(
      (code) => processCodeRef.current(code),
      (pending) => onPendingChangeRef.current?.(pending > 0),
    )

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return
      if (e.key !== 'Enter') return
      e.preventDefault()
      const input = e.currentTarget
      const code = input.value.trim()
      // Se limpia ya, no al terminar: la siguiente lectura no se mezcla con esta
      input.value = ''
      if (!code) return
      queueRef.current?.enqueue(code)
    }

    return (
      <div className="px-6 py-4 border-b border-ui-divide bg-brand-secondary/5">
        <label className="block text-xs font-semibold text-content-faint uppercase tracking-wider mb-1.5">
          Escaneo rápido
        </label>
        <div className="relative max-w-sm">
          <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            defaultValue=""
            onKeyDown={handleKeyDown}
            placeholder={
              disabled ? 'Selecciona un proveedor primero' : 'Escanear código de barras...'
            }
            autoComplete="off"
            disabled={disabled}
            className={cn(
              'input-hard w-full pl-9 pr-3 py-2 text-sm placeholder:text-content-faint',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          />
        </div>
      </div>
    )
  },
)
