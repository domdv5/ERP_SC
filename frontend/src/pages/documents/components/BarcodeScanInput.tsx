import { useEffect, useRef } from 'react'
import { ScanLine } from 'lucide-react'
import { toast } from 'sonner'
import type { UseFieldArrayAppend, UseFormGetValues, UseFormSetValue } from 'react-hook-form'
import { getProductByCode } from '@/services/products.service'
import { cn } from '@/lib/utils'
import type { Product } from '@/types/product.types'
import type { DocumentType } from '@/types/document.types'
import type { FormValues } from '@/pages/documents/document-form.schema'

interface BarcodeScanInputProps {
  docType: DocumentType
  append: UseFieldArrayAppend<FormValues, 'items'>
  getValues: UseFormGetValues<FormValues>
  setValue: UseFormSetValue<FormValues>
  onProductScanned: (productId: string, avgCost: number, unitOfMeasure: 'unidad' | 'docena') => void
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
 */
export function BarcodeScanInput({ docType, append, getValues, setValue, onProductScanned }: BarcodeScanInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  // Evita procesar un segundo Enter mientras el lookup del primero sigue en vuelo (doble
  // disparo de scanner, o Enter mantenido) — sin esto podría duplicarse el mismo ítem.
  const isProcessingRef = useRef(false)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (isProcessingRef.current) return

    const input = inputRef.current
    const code = input?.value.trim() ?? ''
    if (!code) return

    isProcessingRef.current = true
    try {
      let product: Product
      try {
        product = await getProductByCode(code)
      } catch (error) {
        if ((error as { response?: { status?: number } })?.response?.status === 404) {
          toast.error('Código no encontrado')
          return
        }
        throw error
      }

      const currentItems = getValues('items')
      const existingIndex = currentItems.findIndex((item) => item.productId === product.id)

      if (existingIndex >= 0) {
        const currentQty = Number(currentItems[existingIndex].quantity) || 0
        setValue(`items.${existingIndex}.quantity`, currentQty + 1)
        toast.success(`${product.code} — cantidad +1`)
      } else {
        const avgCost = Number(product.avgCost)
        const shouldPrefillCost = docType === 'CM' || docType === 'DVC' || docType === 'EAI'
        append({
          productId:     product.id,
          productCode:   product.code,
          productDesc:   product.description,
          quantity:      1,
          unitCost:      shouldPrefillCost ? avgCost : undefined,
          observaciones: undefined,
        })
        onProductScanned(product.id, avgCost, product.unitOfMeasure)
        toast.success(`${product.code} agregado`)
      }
    } catch {
      toast.error('Error al buscar el producto')
    } finally {
      if (input) input.value = ''
      isProcessingRef.current = false
      inputRef.current?.focus()
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
          placeholder="Escanear código de barras..."
          autoComplete="off"
          className={cn(
            'w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-surface-raised text-content placeholder:text-content-faint',
            'focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all',
            'border-ui-border-medium',
          )}
        />
      </div>
    </div>
  )
}
