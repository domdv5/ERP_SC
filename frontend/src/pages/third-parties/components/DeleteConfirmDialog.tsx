import { AlertTriangle } from 'lucide-react'
import type { ThirdParty } from '@/types'

interface DeleteConfirmDialogProps {
  thirdParty: ThirdParty | null
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}

export function DeleteConfirmDialog({ thirdParty, onConfirm, onCancel, isPending }: DeleteConfirmDialogProps) {
  if (!thirdParty) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Eliminar tercero</h3>
            <p className="text-sm text-gray-500 mt-1">
              ¿Estás seguro de eliminar a <span className="font-medium text-gray-700">{thirdParty.name}</span>?
              Esta acción lo marcará como inactivo.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50">
            {isPending ? 'Eliminando...' : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}
