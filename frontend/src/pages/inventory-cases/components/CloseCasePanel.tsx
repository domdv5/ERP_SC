import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check } from 'lucide-react'
import { closeInventoryCase } from '@/services/inventory-cases.service'
import { invalidateInventoryCases } from '@/lib/invalidation'
import { docNumber } from '@/lib/format'
import type { InventoryCaseDocumentRef } from '@/types/inventory-case.types'
import { closeCaseSchema, type CloseCaseFormData } from '../close-case.schema'
import { CLOSABLE_CAUSE_OPTIONS, JUSTIFICATION_MAX_LENGTH } from '../inventory-cases.constants'

interface CloseCasePanelProps {
  caseId: string
  originDocument: InventoryCaseDocumentRef | null
  onClearOrigin: () => void
}

export function CloseCasePanel({ caseId, originDocument, onClearOrigin }: CloseCasePanelProps) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CloseCaseFormData>({
    resolver: zodResolver(closeCaseSchema),
    defaultValues: { justification: '' },
  })

  const justificationLength = watch('justification')?.length ?? 0

  const { mutate: closeCase, isPending } = useMutation({
    mutationFn: (data: CloseCaseFormData) =>
      closeInventoryCase(caseId, { ...data, originDocumentId: originDocument?.id }),
    onSuccess: () => {
      invalidateInventoryCases(queryClient)
      toast.success('Caso cerrado')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Error al cerrar el caso')
      // Un 409 (otra persona lo cerró) deja la pantalla vieja: se recarga el detalle.
      invalidateInventoryCases(queryClient)
    },
  })

  return (
    <form
      onSubmit={handleSubmit((data) => closeCase(data))}
      aria-labelledby="close-case-title"
      className="card-hard p-5 space-y-4"
    >
      <h2 id="close-case-title" className="text-lg text-content">
        Cerrar caso
      </h2>

      <div className="space-y-1.5">
        <label htmlFor="close-cause" className="text-sm font-medium text-content-secondary">
          Causa <span aria-hidden="true">*</span>
        </label>
        <select
          id="close-cause"
          defaultValue=""
          aria-invalid={Boolean(errors.cause)}
          {...register('cause')}
          className="input-hard w-full text-sm px-3 py-2 text-content"
        >
          <option value="" disabled>
            Selecciona una causa
          </option>
          {CLOSABLE_CAUSE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.cause && <p className="text-xs text-red-500">{errors.cause.message}</p>}
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-content-secondary">
          Documento de origen <span className="font-normal text-content-muted">(opcional)</span>
        </p>
        <div className="flex items-center justify-between gap-2 rounded-md border-2 border-ui-border-medium bg-surface-raised px-3 py-2 text-sm">
          {originDocument ? (
            <>
              <span className="font-mono text-xs text-content">
                {docNumber(originDocument.type, originDocument.number)}
              </span>
              <button type="button" onClick={onClearOrigin} className="link-plain text-xs">
                Sin documento
              </button>
            </>
          ) : (
            <span className="text-content-muted">Sin documento</span>
          )}
        </div>
        <p className="text-xs text-content-muted">Márcalo con el botón de la línea de tiempo.</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="close-justification" className="text-sm font-medium text-content-secondary">
          Justificación <span aria-hidden="true">*</span>
        </label>
        <textarea
          id="close-justification"
          rows={5}
          aria-invalid={Boolean(errors.justification)}
          {...register('justification')}
          className="input-hard w-full text-sm px-3 py-2 text-content resize-y"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-red-500">{errors.justification?.message}</p>
          <p className="text-xs text-content-muted shrink-0">
            {justificationLength} / {JUSTIFICATION_MAX_LENGTH}
          </p>
        </div>
        <p className="text-xs text-content-muted">Qué pasó y qué se hará.</p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="btn-primary w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold"
      >
        <Check className="w-4 h-4" aria-hidden="true" />
        {isPending ? 'Cerrando...' : 'Cerrar caso'}
      </button>
      <p className="text-xs text-center text-content-muted">
        Al cerrarlo, el caso queda en solo lectura.
      </p>
    </form>
  )
}
