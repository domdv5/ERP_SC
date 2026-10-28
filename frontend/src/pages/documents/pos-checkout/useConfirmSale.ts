import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createDocument, updateDocument, confirmDocument } from '@/services/documents.service'
import { docNumber, todayInBogota } from '@/lib/format'
import { invalidateAfterDocumentChange } from '@/lib/invalidation'
import type { FormValues } from '@/pages/documents/document-form.schema'
import {
  parseMissingStockError,
  type MissingStockItem,
  type PaymentLine,
  type SelectedCredit,
} from '@/pages/documents/pos-checkout.utils'
import type {
  Document,
  DocumentType,
  PaymentMethod,
  UpdateDocumentPayload,
} from '@/types/document.types'
import { extractErrorMessage } from './useCreditLimit'

interface UseConfirmSaleArgs {
  canConfirm: boolean
  docType: DocumentType
  official: boolean
  isCredit: boolean
  draftId: string | null
  setDraftId: (id: string) => void
  setDraftNumber: (number: number) => void
  thirdPartyId: string
  customerBranchId: string
  needsBranch: boolean
  sellerId: string
  needsPayments: boolean
  paymentLines: PaymentLine[]
  cartItems: FormValues['items']
  selectedCredits: SelectedCredit[]
  clearCreditError: () => void
  handleCreditError: (err: unknown) => boolean
}

// Guarda el borrador (create o update) y lo confirma; maneja stock insuficiente y cupo de crédito.
export function useConfirmSale({
  canConfirm,
  docType,
  official,
  isCredit,
  draftId,
  setDraftId,
  setDraftNumber,
  thirdPartyId,
  customerBranchId,
  needsBranch,
  sellerId,
  needsPayments,
  paymentLines,
  cartItems,
  selectedCredits,
  clearCreditError,
  handleCreditError,
}: UseConfirmSaleArgs) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [missingStock, setMissingStock] = useState<MissingStockItem[] | null>(null)
  const idempotencyKeyRef = useRef(crypto.randomUUID())

  const { mutateAsync: createMutateAsync, isPending: isCreating } = useMutation({
    mutationFn: createDocument,
  })
  const { mutateAsync: updateMutateAsync, isPending: isUpdating } = useMutation({
    mutationFn: ({ docId, payload }: { docId: string; payload: UpdateDocumentPayload }) =>
      updateDocument(docId, payload),
  })
  const { mutateAsync: confirmMutateAsync, isPending: isConfirming } = useMutation({
    mutationFn: ({ id, customerCredits }: { id: string; customerCredits: SelectedCredit[] }) =>
      confirmDocument(id, customerCredits.length ? { customerCredits } : undefined),
  })

  const isSubmitting = isCreating || isUpdating || isConfirming

  const invalidateAfterSale = (confirmed: Document) => {
    invalidateAfterDocumentChange(queryClient, [confirmed.id, confirmed.sourceDocument?.id])
  }

  async function handleConfirm() {
    if (!canConfirm || isSubmitting) return
    clearCreditError()

    const items = cartItems.map((i) => ({
      productId: i.productId,
      quantity: Number(i.quantity),
      unitPrice:
        i.unitPrice !== undefined && !Number.isNaN(Number(i.unitPrice))
          ? Number(i.unitPrice)
          : undefined,
      addedAt: i.addedAt,
    }))
    const payload: UpdateDocumentPayload = {
      date: todayInBogota(),
      thirdPartyId,
      // null suelta una sucursal vieja del borrador si el cliente ya no la requiere.
      customerBranchId: needsBranch ? customerBranchId : null,
      sellerId,
      // Sin cobro (crédito o cubierta con saldo a favor) manda lista vacía para soltar líneas viejas del borrador.
      payments: needsPayments
        ? paymentLines.map((l) => ({
            method: l.method as PaymentMethod,
            amount: Number(l.amount),
          }))
        : [],
      items,
    }

    let doc: Document
    try {
      if (draftId) {
        doc = await updateMutateAsync({ docId: draftId, payload })
      } else {
        // Crédito manda los saldos desde el create (la CxC nace neteada); contado los aplica recién al confirmar.
        doc = await createMutateAsync({
          type: docType,
          ...payload,
          idempotencyKey: idempotencyKeyRef.current,
          customerCredits: isCredit && selectedCredits.length ? selectedCredits : undefined,
        })
        setDraftId(doc.id)
        setDraftNumber(doc.number)
      }
    } catch (err) {
      if (handleCreditError(err)) return
      toast.error(extractErrorMessage(err) ?? 'Error al guardar la venta')
      return
    }

    try {
      const confirmed = await confirmMutateAsync({ id: doc.id, customerCredits: selectedCredits })
      invalidateAfterSale(confirmed)
      toast.success(
        official
          ? `Venta oficial ${docNumber(confirmed.type, confirmed.number)} confirmada. No se movió inventario.`
          : `Venta ${docNumber(confirmed.type, confirmed.number)} confirmada. El inventario fue actualizado.`,
      )
      navigate(`/documents/${confirmed.id}`)
    } catch (err) {
      // El borrador ya quedó guardado aunque la confirmación falle: el listado tiene que mostrarlo
      invalidateAfterDocumentChange(queryClient, [doc.id])
      const parsedMissingStock = parseMissingStockError(err)
      if (parsedMissingStock) {
        setMissingStock(parsedMissingStock)
        return
      }
      if (handleCreditError(err)) return
      toast.error(extractErrorMessage(err) ?? 'Error al confirmar la venta')
    }
  }

  return { handleConfirm, isSubmitting, missingStock, setMissingStock }
}
