import { ArrowLeft, ArrowRightLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { docNumber } from '@/lib/format'
import { DOC_TYPE_ACCENT } from '@/pages/documents/document.constants'
import type { DocumentSourceRef, DocumentType } from '@/types/document.types'

interface SaleHeaderProps {
  docType: DocumentType
  official: boolean
  isCredit: boolean
  draftId: string | null
  draftNumber: number | null
  sourceDocument: DocumentSourceRef | null
  onBack: () => void
}

export function SaleHeader({
  docType,
  official,
  isCredit,
  draftId,
  draftNumber,
  sourceDocument,
  onBack,
}: SaleHeaderProps) {
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
        <h1 className="text-2xl text-content">Nueva venta</h1>
        <p className="text-content-muted text-sm mt-0.5 font-accent">
          {draftId && draftNumber !== null
            ? `Borrador ${docNumber(docType, draftNumber)} en curso`
            : official
              ? 'Venta oficial de contado (precios con IVA)'
              : isCredit
                ? 'Venta a crédito'
                : 'Venta de contado'}
        </p>
      </div>
      {sourceDocument && (
        <span className="ml-auto pill-stamp bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400">
          <ArrowRightLeft className="w-3.5 h-3.5" />
          Convertida desde {docNumber(sourceDocument.type, sourceDocument.number)}
        </span>
      )}
    </div>
  )
}
