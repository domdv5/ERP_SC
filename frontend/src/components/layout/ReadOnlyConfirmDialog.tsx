import { AlertTriangle } from 'lucide-react'

interface ReadOnlyConfirmDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}

export function ReadOnlyConfirmDialog({
  open,
  onConfirm,
  onCancel,
  isPending,
}: ReadOnlyConfirmDialogProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-surface border-2 border-ui-border-medium rounded-md shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-md border-2 border-red-600 bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold text-content">Activar modo de solo lectura</h3>
            <p className="text-sm text-content-muted mt-1">
              Esto bloqueará todas las operaciones de escritura en la aplicación para todos los
              usuarios. Úsalo únicamente durante el cierre contable de fin de mes.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} className="btn-secondary px-4 py-2 text-sm">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={isPending} className="btn-danger px-4 py-2 text-sm">
            {isPending ? 'Activando...' : 'Sí, activar'}
          </button>
        </div>
      </div>
    </div>
  )
}
