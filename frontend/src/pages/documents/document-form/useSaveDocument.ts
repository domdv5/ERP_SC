import { useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createDocument, updateDocument } from '@/services/documents.service'
import { invalidateAfterDocumentChange } from '@/lib/invalidation'
import type { FormValues } from '../document-form.schema'
import { buildDocumentPayload } from './buildDocumentPayload'

interface UseSaveDocumentArgs {
  id: string | undefined
  isEditing: boolean
  needsCustomer: boolean
  customerBranchCount: number
  isLoadingBranches: boolean
}

export function useSaveDocument({
  id,
  isEditing,
  needsCustomer,
  customerBranchCount,
  isLoadingBranches,
}: UseSaveDocumentArgs) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const idempotencyKeyRef = useRef(crypto.randomUUID())

  const invalidate = useCallback(() => {
    invalidateAfterDocumentChange(queryClient, [id])
  }, [queryClient, id])

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: createDocument,
    onSuccess: (doc) => {
      invalidate()
      toast.success('Operación creada correctamente')
      navigate(`/documents/${doc.id}`)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Error al crear la operación')
    },
  })

  const { mutate: update, isPending: isUpdating } = useMutation({
    mutationFn: ({
      docId,
      payload,
    }: {
      docId: string
      payload: Parameters<typeof updateDocument>[1]
    }) => updateDocument(docId, payload),
    onSuccess: (doc) => {
      invalidate()
      toast.success('Operación actualizada correctamente')
      navigate(`/documents/${doc.id}`)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Error al actualizar la operación')
    },
  })

  const isPending = isCreating || isUpdating

  const onSubmit = (values: FormValues) => {
    if (needsCustomer && values.thirdPartyId) {
      if (isLoadingBranches) {
        toast.error('Espera a que carguen las sucursales del cliente')
        return
      }
      if (customerBranchCount > 0 && !values.customerBranchId) {
        toast.error('Selecciona la sucursal del cliente')
        return
      }
    }
    const payload = buildDocumentPayload(values, {
      needsCustomer,
      hasBranches: customerBranchCount > 0,
      isEditing,
    })

    if (isEditing && id) {
      const { type: _type, ...rest } = payload
      update({ docId: id, payload: rest })
    } else {
      create({ ...payload, idempotencyKey: idempotencyKeyRef.current })
    }
  }

  return { onSubmit, isPending }
}
