import { ArrowRightLeft, Loader2 } from 'lucide-react'
import { docNumber } from '@/lib/format'
import type { Document } from '@/types/document.types'
import { sourceTypeLabel } from './useSaleDraft'

interface PendingConversionNoticeProps {
  document: Document
  isCredit: boolean
  cartItemCount: number
  isConverting: boolean
  onConvert: () => void
  onDismiss: () => void
}

// Aviso de preventa/remisión activa con productos pendientes por convertir en venta.
export function PendingConversionNotice({
  document,
  isCredit,
  cartItemCount,
  isConverting,
  onConvert,
  onDismiss,
}: PendingConversionNoticeProps) {
  return (
    <div className="flex items-start gap-3 px-5 py-4 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
      <ArrowRightLeft className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">
          {document.thirdParty?.name ?? 'Este cliente'} tiene una {sourceTypeLabel(document.type)}{' '}
          activa ({docNumber(document.type, document.number)}) con productos pendientes por
          convertir.
        </p>
        <p className="text-xs text-blue-600/80 dark:text-blue-400/70 mt-1 font-accent">
          Se creará una venta {isCredit ? 'a crédito' : 'nueva'} con los mismos ítems y precios
          cotizados de esa {sourceTypeLabel(document.type)}.
          {cartItemCount > 0 &&
            ` Esto reemplazará los ${cartItemCount} producto(s) ya agregados al carrito.`}
        </p>
        <div className="flex items-center gap-3 mt-3">
          <button
            type="button"
            onClick={onConvert}
            disabled={isConverting}
            className="btn-primary flex items-center gap-2 px-3 py-1.5 text-xs disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isConverting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Convertir a esta venta
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs font-medium text-content-muted hover:text-content transition-colors"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  )
}
