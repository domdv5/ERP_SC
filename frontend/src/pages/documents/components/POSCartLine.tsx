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
  // Precio mínimo actual del producto (piso del 2%). Lo resuelve la pantalla de checkout al
  // entrar el código al carrito. Viene sin valor mientras ese dato todavía no llegó.
  minSalePrice?: number
  // Disponible del producto (stock total menos lo reservado), el mismo dato que en el listado
  // de productos, resuelto junto con el precio mínimo. Solo informativo: el backend rechaza al
  // confirmar si de verdad no alcanza; esto es solo un aviso temprano.
  availableStock?: number
}

// Fila de carrito del checkout de ventas, a propósito con su propio componente (no reutiliza el
// de los otros documentos): aquel tiene columnas que cambian según el tipo de documento y no
// encajan con la venta, y acá el producto siempre llega ya resuelto (por escaneo o búsqueda),
// nunca se elige desde un buscador dentro de la fila.
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
