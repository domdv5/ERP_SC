import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DOC_TYPE_ACCENT } from '../document.constants'
import type { FormValues } from '../document-form.schema'
import { typeLabelFor } from './documentTypeLabels'

interface DocumentFormHeaderProps {
  docType: FormValues['type']
  isEditing: boolean
  onBack: () => void
}

export function DocumentFormHeader({ docType, isEditing, onBack }: DocumentFormHeaderProps) {
  const accent = DOC_TYPE_ACCENT[docType]

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={onBack}
        className="p-2 rounded-xl text-content-faint hover:text-content hover:bg-surface-hover transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div
        className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
          accent.iconBg,
        )}
      >
        <accent.icon className={cn('w-6 h-6', accent.iconText)} />
      </div>
      <div>
        <h1 className="text-2xl text-content">
          {isEditing ? `Editar ${typeLabelFor(docType)}` : `Nueva ${typeLabelFor(docType)}`}
        </h1>
        <p className="text-content-muted text-sm mt-0.5 font-accent">
          {isEditing
            ? 'Editando borrador'
            : docType === 'REM'
              ? 'Crea una nueva remisión'
              : docType === 'DVV'
                ? 'Crea una nueva devolución en venta'
                : docType === 'CMO'
                  ? 'Registra la compra con factura; los valores se digitan sin IVA'
                  : 'Crea una nueva operación de inventario'}
        </p>
      </div>
    </div>
  )
}
