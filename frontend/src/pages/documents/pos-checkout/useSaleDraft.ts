import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseFieldArrayReplace } from 'react-hook-form'
import { toast } from 'sonner'
import { getDocument, convertDocument } from '@/services/documents.service'
import { docNumber } from '@/lib/format'
import { invalidateAfterDocumentChange } from '@/lib/invalidation'
import type { FormValues } from '@/pages/documents/document-form.schema'
import {
  hasPendingItems,
  findActivePendingPreventa,
  type PaymentLine,
} from '@/pages/documents/pos-checkout.utils'
import type { DocumentDetail, DocumentSourceRef, DocumentType } from '@/types/document.types'
import { extractErrorMessage } from './useCreditLimit'
import type { SaleMode } from './useSaleMode'
import type { SaleParties } from './useSaleParties'

// Sustantivo del documento de origen para el aviso de conversión: preventa o remisión.
export const sourceTypeLabel = (type: DocumentType) => (type === 'REM' ? 'remisión' : 'preventa')

interface UseSaleDraftArgs {
  mode: SaleMode
  official: boolean
  setMode: (mode: SaleMode) => void
  setOfficial: (official: boolean) => void
  parties: SaleParties
  replaceItems: UseFieldArrayReplace<FormValues, 'items'>
  setPaymentRows: (rows: PaymentLine[]) => void
  handleCreditError: (err: unknown) => boolean
}

// Borrador en curso (create→confirm, o conversión ya aplicada) y preventa activa pendiente de convertir.
export function useSaleDraft({
  mode,
  official,
  setMode,
  setOfficial,
  parties,
  replaceItems,
  setPaymentRows,
  handleCreditError,
}: UseSaleDraftArgs) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  // Entrada desde "Convertir a venta" en el detalle de una preventa o remisión. Se acepta un
  // parámetro genérico y también los nombres antiguos (?fromPV= era el único antes de la remisión).
  // Entrada desde "Editar" en el detalle de un borrador de venta; tiene prioridad sobre ?fromX.
  const resumeDraftId = searchParams.get('draft') || undefined
  const fromSourceId = resumeDraftId
    ? undefined
    : searchParams.get('fromPV') ||
      searchParams.get('fromREM') ||
      searchParams.get('fromDocId') ||
      undefined

  const [draftId, setDraftId] = useState<string | null>(null)
  const [draftNumber, setDraftNumber] = useState<string | null>(null)
  const [sourceDocument, setSourceDocument] = useState<DocumentSourceRef | null>(null)

  // ── preventa activa pendiente de convertir ────────────────────────────────
  const [pendingPreventa, setPendingPreventa] = useState<DocumentDetail | null>(null)
  const [checkingPreventa, setCheckingPreventa] = useState(false)

  // Corre en el onChange del buscador, no en un efecto: un efecto se re-disparía en bucle cuando la conversión fija el cliente por código.
  async function handleCustomerSelected(id: string, label: string) {
    parties.selectCustomer(id, label)
    setPendingPreventa(null)
    // La conversión PV/REM→venta no existe para POSO: no se busca preventa activa en modo oficial.
    if (official) return
    await checkPendingPreventa(id)
  }

  async function checkPendingPreventa(id: string) {
    setCheckingPreventa(true)
    try {
      const pv = await findActivePendingPreventa(id)
      setPendingPreventa(pv)
    } catch {
      // El aviso no es crítico: si la detección falla, el operario no ve el banner y sigue con
      // una venta normal. No vale la pena mostrar un error por esto.
    } finally {
      setCheckingPreventa(false)
    }
  }

  // Entrada desde "Convertir a venta": precarga la preventa/remisión por id sin que el operario vuelva a buscar cliente.
  const { data: fromSourceDoc } = useQuery({
    queryKey: ['document', fromSourceId],
    queryFn: () => getDocument(fromSourceId!),
    enabled: Boolean(fromSourceId) && !draftId,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (!fromSourceDoc) return
    if (!hasPendingItems(fromSourceDoc)) {
      toast.error(
        `Esta ${sourceTypeLabel(fromSourceDoc.type)} ya no tiene cantidad pendiente por convertir`,
      )
      return
    }
    setPendingPreventa(fromSourceDoc)
  }, [fromSourceDoc])

  // Carga en el checkout un documento de venta ya creado (conversión o borrador retomado).
  function hydrateFromDocument(doc: DocumentDetail) {
    setDraftId(doc.id)
    setDraftNumber(doc.number)
    setMode(doc.type === 'COT' ? 'COT' : 'POS')
    setOfficial(doc.type === 'POSO')
    parties.loadFromDocument(doc)
    replaceItems(
      doc.documentItems.map((item) => ({
        productId: item.productId,
        productCode: item.product.code,
        productDesc: item.product.description,
        quantity: item.quantity,
        unitCost: undefined,
        unitPrice: Number(item.unitPrice),
        observaciones: undefined,
        addedAt: item.addedAt,
      })),
    )
    setSourceDocument(doc.sourceDocument)
  }

  // Retoma un borrador de venta (?draft=<id>) como si se hubiera creado en esta pantalla.
  const { data: resumeDoc, isError: isResumeError } = useQuery({
    queryKey: ['document', resumeDraftId],
    queryFn: () => getDocument(resumeDraftId!),
    enabled: Boolean(resumeDraftId),
    staleTime: 5 * 60 * 1000,
  })
  const resumedRef = useRef(false)

  useEffect(() => {
    if (!resumeDraftId) return
    if (isResumeError) {
      toast.error('No se pudo cargar el borrador')
      navigate('/documents', { replace: true })
      return
    }
    if (!resumeDoc || resumedRef.current) return
    resumedRef.current = true
    const isSaleDraft =
      resumeDoc.status === 'draft' && ['POS', 'COT', 'POSO'].includes(resumeDoc.type)
    if (!isSaleDraft) {
      toast.error('Solo se pueden retomar borradores de venta')
      navigate(`/documents/${resumeDoc.id}`, { replace: true })
      return
    }
    hydrateFromDocument(resumeDoc)
    if (resumeDoc.payments?.length) {
      setPaymentRows(
        resumeDoc.payments.map((p) => ({ method: p.method, amount: Number(p.amount) })),
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeDoc, isResumeError, resumeDraftId])

  // Convertir a crédito puede devolver error de cupo; las formas de pago se eligen en el checkout.
  const { mutate: doConvert, isPending: isConverting } = useMutation({
    mutationFn: (pvId: string) => convertDocument(pvId, { targetType: mode }),
    onSuccess: (converted) => {
      hydrateFromDocument(converted)
      const sourceLabel = converted.sourceDocument
        ? docNumber(converted.sourceDocument.type, converted.sourceDocument.number)
        : 'el documento de origen'
      setPendingPreventa(null)
      invalidateAfterDocumentChange(queryClient, [converted.id, converted.sourceDocument?.id])
      toast.success(
        `Venta creada a partir de ${sourceLabel}. Revisa los precios antes de confirmar.`,
      )
    },
    onError: (err: unknown) => {
      if (handleCreditError(err)) return
      toast.error(extractErrorMessage(err) ?? 'Error al convertir la preventa')
    },
  })

  return {
    resumeDraftId,
    draftId,
    setDraftId,
    draftNumber,
    setDraftNumber,
    sourceDocument,
    pendingPreventa,
    setPendingPreventa,
    checkingPreventa,
    checkPendingPreventa,
    handleCustomerSelected,
    doConvert,
    isConverting,
  }
}
