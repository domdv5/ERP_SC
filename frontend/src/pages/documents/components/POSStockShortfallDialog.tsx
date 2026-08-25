import { AlertTriangle, X } from 'lucide-react'
import type { StockShortfall } from '@/pages/documents/pos-checkout.utils'

interface POSStockShortfallDialogProps {
  shortfalls: StockShortfall[]
  onClose: () => void
}

// Modal del 409 estructurado de confirmar POS (ver parseStockShortfallError en pos-checkout.utils.ts) —
// lista TODOS los productos en falta, no solo el primero (requisito explícito: el operario necesita ver
// el panorama completo antes de decidir qué cantidades ajustar). El documento ya quedó creado como
// borrador cuando este modal aparece — cerrar solo oculta el aviso, no descarta nada.
export function POSStockShortfallDialog({ shortfalls, onClose }: POSStockShortfallDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ui-border bg-red-500/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-red-500/15 shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <h2 className="text-content font-semibold">Stock insuficiente</h2>
              <p className="text-content-muted text-xs mt-0.5 font-accent">
                El borrador quedó guardado — ajusta las cantidades y confirma de nuevo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-content-faint hover:text-content transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto">
          <div className="overflow-x-auto rounded-xl border border-ui-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border bg-surface-raised">
                  <th className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-4 py-2.5">
                    Código
                  </th>
                  <th className="text-right text-xs font-semibold text-content-faint uppercase tracking-wider px-4 py-2.5">
                    Disponible
                  </th>
                  <th className="text-right text-xs font-semibold text-content-faint uppercase tracking-wider px-4 py-2.5">
                    Solicitado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-divide">
                {shortfalls.map((s) => (
                  <tr key={s.productId}>
                    <td className="px-4 py-2.5 font-mono text-xs text-content">{s.code}</td>
                    <td className="px-4 py-2.5 text-right text-content-secondary">{s.available}</td>
                    <td className="px-4 py-2.5 text-right text-red-500 font-medium">{s.requested}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-ui-border bg-surface-raised flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white rounded-xl gradient-action hover:opacity-90 transition-opacity"
          >
            Entendido, ajustar cantidades
          </button>
        </div>
      </div>
    </div>
  )
}
