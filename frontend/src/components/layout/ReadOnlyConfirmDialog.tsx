import { AlertTriangle } from 'lucide-react'

interface ReadOnlyConfirmDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}

export function ReadOnlyConfirmDialog({ open, onConfirm, onCancel, isPending }: ReadOnlyConfirmDialogProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold text-content">Activar modo de solo lectura</h3>
            <p className="text-sm text-content-muted mt-1">
              Esto bloqueará todas las operaciones de escritura en la aplicación para todos los usuarios. Úsalo
              únicamente durante el cierre contable de fin de mes.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-content-secondary bg-surface border border-ui-border-medium rounded-lg hover:bg-surface-raised transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {isPending ? 'Activando...' : 'Sí, activar'}
          </button>
        </div>
      </div>
    </div>
  )
}
