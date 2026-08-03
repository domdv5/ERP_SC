import { Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProductLocationsResult } from '@/types/product.types'

interface ProductSummaryCardProps {
  product: ProductLocationsResult['product']
  totalBinQuantity: number
}

const UNIT_LABELS: Record<ProductLocationsResult['product']['unitOfMeasure'], string> = {
  unidad: 'Unidad',
  docena: 'Docena',
}

export function ProductSummaryCard({ product, totalBinQuantity }: ProductSummaryCardProps) {
  return (
    <div className="bg-surface rounded-2xl border border-ui-border shadow-sm p-5">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 gradient-action">
          <Package className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-mono text-xs font-medium text-content-muted">{product.code}</p>
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-medium',
                product.active
                  ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                  : 'bg-surface-hover text-content-muted',
              )}
            >
              {product.active ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <h2 className="text-lg text-content mt-1">{product.description}</h2>
          <div className="flex items-center gap-4 mt-2 text-xs text-content-muted font-accent">
            <span>Marca: {product.brand.name}</span>
            <span>Unidad: {UNIT_LABELS[product.unitOfMeasure]}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl text-content">{totalBinQuantity.toLocaleString('es-CO')}</p>
          <p className="text-xs text-content-faint font-accent">en bultos</p>
        </div>
      </div>
    </div>
  )
}
