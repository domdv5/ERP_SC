import type { UseFormRegister } from 'react-hook-form'
import { Info, Link2 } from 'lucide-react'
import { docNumber } from '@/lib/format'
import type { DocumentSourceRef } from '@/types/document.types'
import type { FormValues } from '../document-form.schema'

interface OfficialInvoiceFieldsProps {
  register: UseFormRegister<FormValues>
  docType: FormValues['type']
  isOfficialPurchase: boolean
  sourceRef: DocumentSourceRef | null
}

export function OfficialInvoiceFields({
  register,
  docType,
  isOfficialPurchase,
  sourceRef,
}: OfficialInvoiceFieldsProps) {
  return (
    <>
      {/* Facturación oficial — CM: casilla + factura del proveedor; CMO: factura (obligatoria) y vínculo a la CM origen. */}
      {(docType === 'CM' || docType === 'CMO') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {docType === 'CM' && (
            <label className="flex items-center gap-2.5 text-sm font-medium text-content-secondary cursor-pointer self-end pb-2">
              <input
                type="checkbox"
                {...register('officialPurchase')}
                className="w-4 h-4 rounded border-ui-border-medium accent-brand-secondary"
              />
              Con factura (compra oficial)
            </label>
          )}
          {(docType === 'CMO' || isOfficialPurchase) && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-content-secondary">
                Número de factura del proveedor <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                maxLength={50}
                placeholder="Ej. FV-12345"
                {...register('supplierInvoiceNumber')}
                className="input-hard w-full px-3 py-2 text-sm border-ui-border-medium text-content placeholder:text-content-faint transition-all"
              />
            </div>
          )}
          {docType === 'CMO' && sourceRef && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-content-secondary">
                Compra de origen
              </label>
              <div className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-ui-border-medium bg-surface-raised text-content">
                <Link2 className="w-4 h-4 text-content-muted shrink-0" />
                <span className="font-mono">{docNumber(sourceRef.type, sourceRef.number)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {docType === 'CMO' && sourceRef && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-xs font-accent">
            Los valores se precargaron desde la compra {docNumber(sourceRef.type, sourceRef.number)}{' '}
            sin el IVA que traían incluido (costo ÷ 1,19). Revísalos contra la factura del
            proveedor.
          </p>
        </div>
      )}
    </>
  )
}
