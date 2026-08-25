import { Trash2 } from 'lucide-react'
import type { UseFormRegister, UseFormWatch } from 'react-hook-form'
import { HintText } from '@/components/shared'
import type { FormValues } from '@/pages/documents/document-form.schema'

const formatCOP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v)

interface POSCartLineProps {
  index: number
  register: UseFormRegister<FormValues>
  watch: UseFormWatch<FormValues>
  onRemove: () => void
  // Precio mínimo vigente del producto (piso del 2%) — resuelto por POSCheckoutPage vía
  // getProductByCode una vez el código del producto entra al carrito (ver useQueries en la
  // página). undefined mientras ese detalle todavía no llegó.
  minSalePrice?: number
  // Disponible neto (totalStock - reservado) del producto — mismo dato/fuente que Product.availableStock,
  // resuelto junto con minSalePrice. Solo informativo: el backend rechaza con 409 estructurado si de
  // verdad no alcanza al confirmar (ver StockShortfallDialog); esto es feedback temprano no bloqueante.
  availableStock?: number
}

// Fila de carrito del checkout POS — deliberadamente propia (no reusa ProductRow.tsx): ese
// componente tiene columnas condicionadas por docType (costo/costo readonly/precio) que no
// calzan con POS, y aquí el producto siempre llega ya resuelto (por escaneo o búsqueda manual),
// nunca se elige desde un combobox dentro de la fila.
export function POSCartLine({ index, register, watch, onRemove, minSalePrice, availableStock }: POSCartLineProps) {
  const productCode = watch(`items.${index}.productCode`)
  const productDesc = watch(`items.${index}.productDesc`)
  const quantity = Number(watch(`items.${index}.quantity`) ?? 0)
  const unitPrice = Number(watch(`items.${index}.unitPrice`) ?? 0)
  const subtotal = quantity * unitPrice

  const isBelowFloor = minSalePrice !== undefined && unitPrice > 0 && unitPrice < minSalePrice
  const exceedsAvailable = availableStock !== undefined && quantity > availableStock

  return (
    <>
      <tr className={isBelowFloor ? 'bg-red-500/5' : undefined}>
        <td className="px-4 py-3 min-w-[220px]">
          <p className="text-sm text-content font-medium truncate">{productDesc}</p>
          <p className="text-xs text-content-faint font-mono">{productCode}</p>
        </td>

        <td className="px-4 py-3 w-24">
          <input
            type="number"
            min={1}
            step={1}
            {...register(`items.${index}.quantity`)}
            className="w-full px-2.5 py-1.5 text-sm text-center rounded-lg border bg-surface-raised text-content focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all border-ui-border-medium"
          />
        </td>

        <td className="px-4 py-3 w-32">
          <input
            type="number"
            min={0}
            step={0.01}
            {...register(`items.${index}.unitPrice`)}
            className={
              'w-full px-2.5 py-1.5 text-sm text-right rounded-lg border bg-surface-raised text-content transition-all ' +
              'focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary ' +
              (isBelowFloor ? 'border-red-500' : 'border-ui-border-medium')
            }
          />
        </td>

        <td className="px-4 py-3 w-32 text-right">
          <span className="text-sm text-content-secondary font-medium">{formatCOP(subtotal)}</span>
        </td>

        <td className="px-3 py-3 w-10 text-center">
          <button
            type="button"
            onClick={onRemove}
            aria-label="Quitar producto"
            className="p-1.5 rounded-lg text-content-faint hover:text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </td>
      </tr>

      {(isBelowFloor || exceedsAvailable) && (
        <tr>
          <td className="px-4 pt-0 pb-2" colSpan={5}>
            <div className="flex flex-wrap gap-x-4">
              {isBelowFloor && (
                <HintText variant="warning">
                  Por debajo del precio mínimo ({formatCOP(minSalePrice!)})
                </HintText>
              )}
              {exceedsAvailable && (
                <HintText variant="warning">Supera el disponible ({availableStock})</HintText>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
