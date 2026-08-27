import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { ScanLine } from 'lucide-react'
import { toast } from 'sonner'
import type { UseFieldArrayAppend, UseFormGetValues, UseFormSetValue } from 'react-hook-form'
import { getProductByCode } from '@/services/products.service'
import { cn } from '@/lib/utils'
import type { Product } from '@/types/product.types'
import type { DocumentType } from '@/types/document.types'
import type { FormValues } from '@/pages/documents/document-form.schema'

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
    availableStock: number,
  ) => void
  // Lleva el foco al input de cantidad de la fila afectada (nueva o incrementada) tras un
  // escaneo exitoso — ver ciclo de foco escaneo→cantidad→escaneo en DocumentFormPage.
  focusQuantityInput: (index: number) => void
  // Marcas del proveedor elegido en el documento (solo CM/DVC) — cualquier producto escaneado
  // cuya marca no esté en esta lista se bloquea (nunca solo advertencia, ver plan). undefined
  // cuando el tipo de documento no aplica este filtro (PV/EAI/SAJ/T).
  supplierBrandIds?: string[]
  // true mientras needsSupplier === true y todavía no hay proveedor elegido — deshabilita el
  // input por completo (no tiene sentido escanear sin saber contra qué proveedor validar).
  disabled?: boolean
  // Nombre del proveedor elegido, solo para el mensaje de bloqueo por marca (reusa tpSelectedName
  // de DocumentFormPage).
  supplierName?: string
}

/**
 * Dedicated always-focused input for barcode-scanner-gun workflows. A scanner types the
 * product code into whatever has focus and sends Enter — this input stays focused at all
 * times and, on Enter, looks up the product by exact code match and either bumps an
 * existing row's quantity or appends a new one. Sits alongside (does not replace) the
 * manual "Agregar ítem" button/combobox flow.
 *
 * No reusa el `Combobox` compartido a propósito: ese componente no tiene soporte de teclado
 * (sin Enter-to-select, sin navegación con flechas), toda selección ahí es solo con mouse —
 * incompatible con un lector de código de barras, que solo puede "teclear" texto + Enter.
 *
 * Expone un handle imperativo (`focus`) porque DocumentFormPage necesita poder devolver el
 * foco aquí desde afuera (ej. tras confirmar la cantidad en ProductRow) — no alcanza con el
 * useEffect de mount, que solo cubre el foco inicial.
 */
export const BarcodeScanInput = forwardRef<BarcodeScanInputHandle, BarcodeScanInputProps>(
  function BarcodeScanInput(
    { docType, append, getValues, setValue, onProductScanned, focusQuantityInput, supplierBrandIds, disabled, supplierName },
    ref,
  ) {
    const inputRef = useRef<HTMLInputElement>(null)
    // Evita procesar un segundo Enter mientras el lookup del primero sigue en vuelo (doble
    // disparo de scanner, o Enter mantenido) — sin esto podría duplicarse el mismo ítem.
    const isProcessingRef = useRef(false)

    useImperativeHandle(ref, () => ({
      // Defensivo: si el proveedor se limpió a mitad de carga (cambio de tipo/proveedor) no debe
      // quedar foco en un input inutilizable.
      focus: () => { if (!disabled) inputRef.current?.focus() },
    }))

    useEffect(() => {
      if (disabled) return
      inputRef.current?.focus()
    }, [disabled])

    const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return
      if (e.key !== 'Enter') return
      e.preventDefault()
      if (isProcessingRef.current) return

      const input = inputRef.current
      const code = input?.value.trim() ?? ''
      if (!code) {
        // Sin código no hay fila a la que saltar — el foco se queda aquí (ya lo tenía).
        inputRef.current?.focus()
        return
      }

      isProcessingRef.current = true
      try {
        let product: Product
        try {
          product = await getProductByCode(code)
        } catch (error) {
          if ((error as { response?: { status?: number } })?.response?.status === 404) {
            toast.error('Código no encontrado')
            // Path de error: no hay fila de cantidad a la que saltar, el foco se queda aquí.
            inputRef.current?.focus()
            return
          }
          throw error
        }

        // Bloqueo duro: un producto de marca ajena al proveedor elegido siempre es un error real
        // (proveedor equivocado en el documento, o producto equivocado escaneado) — nunca se
        // agrega la fila, solo se avisa. Mismo patrón que el bloque de "código no encontrado".
        if (supplierBrandIds !== undefined && !supplierBrandIds.includes(product.brandId)) {
          toast.error(`${product.code} no pertenece a las marcas de ${supplierName ?? 'este proveedor'}`)
          inputRef.current?.focus()
          return
        }

        const currentItems = getValues('items')
        const existingIndex = currentItems.findIndex((item) => item.productId === product.id)

        if (existingIndex >= 0) {
          const currentQty = Number(currentItems[existingIndex].quantity) || 0
          setValue(`items.${existingIndex}.quantity`, currentQty + 1)
          toast.success(`${product.code} — cantidad +1`)
          focusQuantityInput(existingIndex)
        } else {
          const avgCost = Number(product.avgCost)
          const salePrice = Number(product.salePrice)
          const shouldPrefillCost = docType === 'CM' || docType === 'DVC' || docType === 'EAI'
          const shouldPrefillPrice = docType === 'PV' || docType === 'POS' || docType === 'COT'
          const newIndex = currentItems.length
          append({
            productId:     product.id,
            productCode:   product.code,
            productDesc:   product.description,
            quantity:      1,
            unitCost:      shouldPrefillCost ? avgCost : undefined,
            unitPrice:     shouldPrefillPrice ? salePrice : undefined,
            observaciones: undefined,
          })
          onProductScanned(product.id, avgCost, product.unitOfMeasure, product.availableStock)
          toast.success(`${product.code} agregado`)
          focusQuantityInput(newIndex)
        }
      } catch {
        toast.error('Error al buscar el producto')
        // Path de error: mismo criterio que el 404 — no hay fila a la que saltar.
        inputRef.current?.focus()
      } finally {
        if (input) input.value = ''
        isProcessingRef.current = false
      }
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
            onKeyDown={(e) => { void handleKeyDown(e) }}
            placeholder={disabled ? 'Selecciona un proveedor primero' : 'Escanear código de barras...'}
            autoComplete="off"
            disabled={disabled}
            className={cn(
              'w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-surface-raised text-content placeholder:text-content-faint',
              'focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'border-ui-border-medium',
            )}
          />
        </div>
      </div>
    )
  },
)
