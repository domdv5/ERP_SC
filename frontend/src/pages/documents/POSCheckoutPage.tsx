import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { useDebounce } from 'use-debounce'
import { toast } from 'sonner'
import {
  CalendarDays,
  ArrowLeft,
  Loader2,
  User,
  UserCog,
  Wallet,
  ArrowRightLeft,
  CreditCard,
  Plus,
  Trash2,
} from 'lucide-react'

import {
  getDocument,
  createDocument,
  updateDocument,
  confirmDocument,
  convertDocument,
  getCreditLimit,
  getAvailableCustomerCredits,
} from '@/services/documents.service'
import { getThirdParties } from '@/services/third-parties.service'
import { getProductByCode } from '@/services/products.service'
import {
  Combobox,
  SegmentedToggle,
  CreditsPanel,
  CustomerBranchSelect,
  ThousandsInput,
} from '@/components/shared'
import { useCustomerBranches } from '@/hooks/useCustomerBranches'
import type { ComboboxOption } from '@/components/shared'
import { usePermission } from '@/hooks/usePermission'
import { cn } from '@/lib/utils'
import { formatCOP, docNumber, todayInBogota } from '@/lib/format'
import { invalidateAfterDocumentChange } from '@/lib/invalidation'
import {
  addOfficialTax,
  computeOfficialTotals,
  getOfficialMinNetPrice,
  getOfficialNetSalePrice,
} from '@/lib/tax'
import {
  suggestCreditAmounts,
  limitCreditAmount,
  limitCreditsToTotal,
} from '@/lib/credit-application'
import { DOC_TYPE_ACCENT } from './document.constants'
import type { FormValues } from './document-form.schema'
import { BarcodeScanInput } from './components/BarcodeScanInput'
import { POSCartLine } from './components/POSCartLine'
import { MissingStockDialog } from './components/MissingStockDialog'
import {
  hasPendingItems,
  findActivePendingPreventa,
  findPriceFloorViolations,
  parseMissingStockError,
  parseCreditLimitError,
  calculatePaymentDifference,
  arePaymentsValid,
  type MissingStockItem,
  type PaymentLine,
  type SelectedCredit,
} from './pos-checkout.utils'

import type {
  CreditLimitExceededDetail,
  Document,
  DocumentSourceRef,
  DocumentType,
  PaymentMethod,
  UpdateDocumentPayload,
} from '@/types/document.types'
import type { ThirdParty } from '@/types/third-party.types'
import type { Product } from '@/types/product.types'

// Modo del checkout: venta de contado (POS) o venta a crédito (COT). COT no lleva forma de
// pago, valida el cupo de crédito del cliente y genera una cuenta por cobrar al confirmar.
type SaleMode = Extract<DocumentType, 'POS' | 'COT'>

// ─── constants ───────────────────────────────────────────────────────────────

// Sustantivo del documento de origen para el aviso de conversión: preventa o remisión.
const sourceTypeLabel = (type: DocumentType) => (type === 'REM' ? 'remisión' : 'preventa')

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
]

function extractErrorMessage(err: unknown): string | undefined {
  const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message
  return typeof message === 'string' ? message : undefined
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function POSCheckoutPage() {
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

  // Reusa el form genérico solo para el input de escaneo; el resto de sus campos no se usan, la venta se arma aparte.
  const { control, register, watch, setValue, getValues } = useForm<FormValues>({
    defaultValues: { type: 'PV', date: todayInBogota(), items: [] },
  })
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' })
  const cartItems = watch('items')

  // ── cliente ────────────────────────────────────────────────────────────────
  const [thirdPartyId, setThirdPartyId] = useState('')
  const [tpSelectedName, setTpSelectedName] = useState('')
  const [customerBranchId, setCustomerBranchId] = useState('')
  const [tpSearch, setTpSearch] = useState('')
  const [debouncedTpSearch] = useDebounce(tpSearch, 400)
  const hasTpSearch = debouncedTpSearch.length >= 1

  const { data: tpData, isLoading: isLoadingTp } = useQuery({
    queryKey: ['third-parties-search-pos-customer', debouncedTpSearch],
    queryFn: () =>
      getThirdParties({
        search: debouncedTpSearch || undefined,
        page: 1,
        limit: 30,
        isCustomer: true,
      }),
    staleTime: 2 * 60 * 1000,
    enabled: hasTpSearch,
  })

  const tpOptions: ComboboxOption[] = (tpData?.items ?? []).map((tp: ThirdParty) => ({
    id: tp.id,
    label: tp.name,
  }))
  const tpDisplayOptions: ComboboxOption[] =
    thirdPartyId && !debouncedTpSearch
      ? [
          { id: thirdPartyId, label: tpSelectedName },
          ...tpOptions.filter((o) => o.id !== thirdPartyId),
        ]
      : tpOptions

  // ── vendedor ───────────────────────────────────────────────────────────────
  const [sellerId, setSellerId] = useState('')
  const [sellerSelectedName, setSellerSelectedName] = useState('')
  const [sellerSearch, setSellerSearch] = useState('')
  const [debouncedSellerSearch] = useDebounce(sellerSearch, 400)
  const hasSellerSearch = debouncedSellerSearch.length >= 1

  const { data: sellerData, isLoading: isLoadingSeller } = useQuery({
    queryKey: ['third-parties-search-pos-seller', debouncedSellerSearch],
    queryFn: () =>
      getThirdParties({
        search: debouncedSellerSearch || undefined,
        page: 1,
        limit: 30,
        isSeller: true,
      }),
    staleTime: 2 * 60 * 1000,
    enabled: hasSellerSearch,
  })

  const sellerOptions: ComboboxOption[] = (sellerData?.items ?? []).map((tp: ThirdParty) => ({
    id: tp.id,
    label: tp.name,
  }))
  const sellerDisplayOptions: ComboboxOption[] =
    sellerId && !debouncedSellerSearch
      ? [
          { id: sellerId, label: sellerSelectedName },
          ...sellerOptions.filter((o) => o.id !== sellerId),
        ]
      : sellerOptions

  // ── modo de venta: contado (POS) / crédito (COT) ─────────────────────────
  // Solo visible con permiso COT; se bloquea con borrador en curso (el tipo de un documento creado no cambia).
  const canCreateCOT = usePermission('document.create.COT')
  const canCreatePOSO = usePermission('document.create.POSO')
  const [mode, setMode] = useState<SaleMode>('POS')
  // Venta oficial (POSO): solo contado, valores sin IVA, sin stock ni saldos a favor; se bloquea con borrador en curso.
  const [official, setOfficial] = useState(false)
  const isCredit = mode === 'COT'
  const { branches: customerBranches, isLoading: isLoadingBranches } =
    useCustomerBranches(thirdPartyId)
  const needsBranch = customerBranches.length > 0
  const docType: DocumentType = official ? 'POSO' : mode
  const accent = DOC_TYPE_ACCENT[docType]

  // ── formas de pago (solo contado) ────────────────────────────────────────
  const [paymentRows, setPaymentRows] = useState<PaymentLine[]>([{ method: '', amount: undefined }])
  // Mientras haya una sola fila y no se haya tecleado el monto, este sigue al total a cobrar.
  const [isAmountEdited, setIsAmountEdited] = useState(false)

  // Error de cupo excedido del backend (create/confirm/convert); cubre la carrera entre ventas del mismo cliente.
  const [creditError, setCreditError] = useState<{
    message: string
    detail: CreditLimitExceededDetail
  } | null>(null)

  // ── borrador en curso (create→confirm, o conversión ya aplicada) ─────────
  const [draftId, setDraftId] = useState<string | null>(null)
  const [draftNumber, setDraftNumber] = useState<number | null>(null)
  const [sourceDocument, setSourceDocument] = useState<DocumentSourceRef | null>(null)

  // ── preventa activa pendiente de convertir ────────────────────────────────
  const [pendingPreventa, setPendingPreventa] = useState<Document | null>(null)
  const [checkingPreventa, setCheckingPreventa] = useState(false)

  // Corre en el onChange del buscador, no en un efecto: un efecto se re-disparía en bucle cuando la conversión fija el cliente por código.
  async function handleCustomerSelected(id: string, label: string) {
    setThirdPartyId(id)
    setTpSelectedName(label)
    setCustomerBranchId('')
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

  // ── cupo de crédito del cliente (solo modo crédito) ──────────────────────
  const { data: creditData, isLoading: isLoadingCredit } = useQuery({
    queryKey: ['customer-credit', thirdPartyId],
    queryFn: () => getCreditLimit(thirdPartyId),
    enabled: isCredit && Boolean(thirdPartyId),
    staleTime: 30 * 1000,
  })

  // Saldos a favor disponibles del cliente. Se consultan también en contado: un saldo a favor
  // se puede aplicar tanto a una venta de contado como a una a crédito.
  const { data: availableCreditsData } = useQuery({
    queryKey: ['customer-available-credits', thirdPartyId],
    queryFn: () => getAvailableCustomerCredits(thirdPartyId),
    enabled: Boolean(thirdPartyId) && !official,
    staleTime: 30 * 1000,
  })

  // Cualquier cambio de contexto borra el error de cupo ya mostrado (el usuario cambió de
  // cliente, de modo, o ajustó el carrito y va a reintentar).
  useEffect(() => {
    setCreditError(null)
  }, [mode, thirdPartyId])

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
  function hydrateFromDocument(doc: Document) {
    setDraftId(doc.id)
    setDraftNumber(doc.number)
    setMode(doc.type === 'COT' ? 'COT' : 'POS')
    setOfficial(doc.type === 'POSO')
    setThirdPartyId(doc.thirdParty?.id ?? '')
    setTpSelectedName(doc.thirdParty?.name ?? '')
    setCustomerBranchId(doc.customerBranch?.id ?? '')
    setSellerId(doc.seller?.id ?? '')
    setSellerSelectedName(doc.seller?.name ?? '')
    replace(
      doc.documentItems.map((item) => ({
        productId: item.productId,
        productCode: item.product.code,
        productDesc: item.product.description,
        quantity: item.quantity,
        unitCost: undefined,
        unitPrice: item.unitPrice,
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
      const credit = parseCreditLimitError(err)
      if (credit) {
        setCreditError({
          message: extractErrorMessage(err) ?? 'Cupo de crédito insuficiente',
          detail: credit,
        })
        return
      }
      toast.error(extractErrorMessage(err) ?? 'Error al convertir la preventa')
    },
  })

  // ── producto elegido a mano en una fila vacía (alternativa al escaneo) ────
  function handleRowProductSelect(index: number, product: Product) {
    // Deja el producto ya conocido en la caché de búsqueda por código, para no volver a pedir
    // al servidor el precio mínimo y el disponible de esta misma fila.
    queryClient.setQueryData(['product-by-code', product.code], product)

    const currentItems = getValues('items')
    const existingIndex = currentItems.findIndex(
      (item, i) => item.productId === product.id && i !== index,
    )
    if (existingIndex >= 0) {
      // Igual que el escaneo: suma en la fila existente y descarta la vacía.
      const rowQty = Number(currentItems[index].quantity) || 1
      const existingQty = Number(currentItems[existingIndex].quantity) || 0
      setValue(`items.${existingIndex}.quantity`, existingQty + rowQty)
      setValue(`items.${existingIndex}.addedAt`, new Date().toISOString())
      remove(index)
      toast.success(`${product.code} ya estaba en el carrito — cantidad sumada`)
      return
    }

    setValue(`items.${index}.productId`, product.id)
    setValue(`items.${index}.productCode`, product.code)
    setValue(`items.${index}.productDesc`, product.description)
    setValue(
      `items.${index}.unitPrice`,
      official ? getOfficialNetSalePrice(Number(product.salePrice)) : Number(product.salePrice),
    )
    setValue(`items.${index}.addedAt`, new Date().toISOString())
  }

  // ── detalle de producto por código (minSalePrice + disponible) ───────────
  // El escaneo no trae precio mínimo ni producto completo; se pide el detalle de cada código del carrito aparte.
  const uniqueProductCodes = useMemo(
    () => Array.from(new Set(cartItems.map((i) => i.productCode).filter(Boolean))),
    [cartItems],
  )

  const productDetailQueries = useQueries({
    queries: uniqueProductCodes.map((code) => ({
      queryKey: ['product-by-code', code],
      queryFn: () => getProductByCode(code),
      staleTime: 5 * 60 * 1000,
    })),
  })

  const productDetailByCode = useMemo(() => {
    const map = new Map<string, { minSalePrice: number; availableStock: number; id: string }>()
    productDetailQueries.forEach((q) => {
      if (q.data) map.set(q.data.code, q.data)
    })
    return map
  }, [productDetailQueries])

  const minSalePriceByProductId = useMemo(() => {
    const map = new Map<string, number>()
    productDetailByCode.forEach((p) =>
      map.set(p.id, official ? getOfficialMinNetPrice(p.minSalePrice) : p.minSalePrice),
    )
    return map
  }, [productDetailByCode, official])

  const priceFloorViolations = findPriceFloorViolations(
    cartItems
      .filter((i) => i.productId)
      .map((i) => ({
        productId: i.productId,
        code: i.productCode,
        unitPrice: Number(i.unitPrice ?? 0),
      })),
    minSalePriceByProductId,
  )

  // ── total + validaciones ──────────────────────────────────────────────────
  const total = cartItems.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
    0,
  )
  const hasValidItems =
    fields.length > 0 && cartItems.every((item) => item.productId && Number(item.quantity) > 0)
  const totalUnits = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  // En venta oficial el precio digitado va sin IVA: total = subtotal + IVA por línea.
  const officialTotals = computeOfficialTotals(
    cartItems.map((item) => ({
      quantity: Number(item.quantity || 0),
      unitValue: Number(item.unitPrice || 0),
    })),
  )
  const grandTotal = official ? officialTotals.total : total

  // ── saldos a favor aplicados a la venta ─────────────────────────────────
  const availableCredits = official ? [] : (availableCreditsData?.credits ?? [])
  // Monto aplicado por cada saldo a favor (id del saldo → monto). El usuario puede bajarlo.
  const [creditAmounts, setCreditAmounts] = useState<Record<string, number>>({})
  // Por-crédito, no global: tocar un saldo no congela la propuesta de los demás, que sigue recalculando mientras sube el total.
  const creditsTouchedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    creditsTouchedRef.current = new Set()
  }, [thirdPartyId])

  // Propone aplicar el máximo posible (los saldos más antiguos primero, excluyendo los ya
  // tocados a mano) hasta cubrir lo que falta del total tras descontar lo aplicado a mano.
  useEffect(() => {
    setCreditAmounts((prev) => {
      const touched = creditsTouchedRef.current
      const manuallyAppliedSum = availableCredits
        .filter((c) => touched.has(c.id))
        .reduce((sum, c) => sum + Math.max(0, Math.min(prev[c.id] ?? 0, c.balance)), 0)
      const remaining = Math.max(total - manuallyAppliedSum, 0)
      const proposal = suggestCreditAmounts(
        availableCredits.filter((c) => !touched.has(c.id)),
        remaining,
      )

      const next: Record<string, number> = {}
      availableCredits.forEach((c) => {
        next[c.id] = touched.has(c.id) ? (prev[c.id] ?? 0) : 0
      })
      proposal.forEach((p) => {
        next[p.id] = p.amount
      })
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thirdPartyId, availableCreditsData, total, official])

  const balanceByCreditId = new Map(availableCredits.map((c) => [c.id, c.balance]))
  // Lista final aplicada: cada monto recortado a su saldo, y la suma recortada al total.
  const selectedCredits: SelectedCredit[] = limitCreditsToTotal(
    availableCredits
      .map((c) => ({
        id: c.id,
        amount: Math.max(0, Math.min(creditAmounts[c.id] ?? 0, c.balance)),
      }))
      .filter((c) => c.amount > 0),
    total,
  ).map((c) => ({ customerCreditId: c.id, amount: c.amount }))
  const creditsApplied = selectedCredits.reduce((sum, c) => sum + c.amount, 0)
  const totalToPay = Math.max(grandTotal - creditsApplied, 0)

  const paymentLines: PaymentLine[] =
    paymentRows.length === 1 && !isAmountEdited
      ? [{ ...paymentRows[0], amount: totalToPay }]
      : paymentRows
  const paymentDifference = calculatePaymentDifference(paymentLines, totalToPay)
  // Si el saldo a favor cubre toda la venta no hay nada que cobrar: no se piden formas de pago.
  const needsPayments = !isCredit && totalToPay > 0

  function updatePaymentRow(index: number, patch: Partial<PaymentLine>) {
    setPaymentRows(paymentLines.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function addPaymentRow() {
    setPaymentRows([
      ...paymentLines,
      { method: '', amount: paymentDifference > 0 ? paymentDifference : undefined },
    ])
  }

  function removePaymentRow(index: number) {
    setIsAmountEdited(true)
    setPaymentRows(paymentLines.filter((_, i) => i !== index))
  }

  function setCreditAmount(creditId: string, next: number) {
    creditsTouchedRef.current.add(creditId)
    setCreditAmounts((prev) => {
      const balance = balanceByCreditId.get(creditId) ?? 0
      const othersSum = Object.entries(prev)
        .filter(([id]) => id !== creditId)
        .reduce((sum, [, amt]) => sum + amt, 0)
      return { ...prev, [creditId]: limitCreditAmount(next, balance, total, othersSum) }
    })
  }

  // Bloqueo duro sobre el neto (total menos saldos a favor); no hay override, se sube el cupo desde la ficha del cliente.
  const creditExceeded =
    isCredit && Boolean(creditData) && total - creditsApplied > creditData!.availableCredit

  const missingItems: string[] = []
  if (!thirdPartyId) missingItems.push('Selecciona un cliente')
  if (thirdPartyId && isLoadingBranches) missingItems.push('Cargando sucursales del cliente...')
  if (needsBranch && !customerBranchId) missingItems.push('Selecciona la sucursal del cliente')
  if (!sellerId) missingItems.push('Selecciona una vendedora')
  if (needsPayments && paymentLines.some((line) => !line.method))
    missingItems.push('Selecciona una forma de pago')
  if (needsPayments && !arePaymentsValid(paymentLines, totalToPay))
    missingItems.push('Las formas de pago deben sumar el total a cobrar')
  if (!hasValidItems) missingItems.push('Agrega al menos un producto con cantidad válida')
  if (priceFloorViolations.length > 0)
    missingItems.push('Corrige los precios por debajo del mínimo permitido')
  if (isCredit && thirdPartyId && isLoadingCredit)
    missingItems.push('Cargando cupo de crédito del cliente...')
  if (creditExceeded) missingItems.push('La venta supera el cupo de crédito disponible del cliente')

  const canConfirm = missingItems.length === 0

  // ── mutaciones de guardado/confirmación ───────────────────────────────────
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

  // Pasa un error de cupo excedido al panel de error dedicado; devuelve true si lo manejó.
  function handleCreditError(err: unknown): boolean {
    const credit = parseCreditLimitError(err)
    if (!credit) return false
    setCreditError({
      message: extractErrorMessage(err) ?? 'Cupo de crédito insuficiente',
      detail: credit,
    })
    return true
  }

  async function handleConfirm() {
    if (!canConfirm || isSubmitting) return
    setCreditError(null)

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

  if (resumeDraftId && !draftId) {
    return <div className="h-64 rounded-2xl bg-surface-raised animate-pulse" />
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Encabezado */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/documents')}
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
                ? 'Venta oficial de contado (valores sin IVA)'
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

      {draftId && (
        <p className="text-content-muted text-sm font-accent">
          El tipo de venta se elige antes de convertir o guardar. Para cambiarlo, elimina el
          borrador.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ── Columna principal ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Datos de la venta */}
          <div className={cn('card-hard p-6 space-y-5 border-l-[6px]', accent.border)}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ui-divide pb-3">
              <h2 className="text-base text-content">Datos de la venta</h2>
              <div className="flex flex-wrap items-center gap-3">
                {canCreatePOSO && (
                  <SegmentedToggle
                    checked={official}
                    disabled={Boolean(draftId)}
                    onChange={(checked) => {
                      if (draftId || sourceDocument) return
                      setOfficial(checked)
                      // Precio de venta trae IVA; en modo oficial se digita sin IVA, así que se convierte el carrito.
                      getValues('items').forEach((item, i) => {
                        if (item.unitPrice === undefined) return
                        setValue(
                          `items.${i}.unitPrice`,
                          checked
                            ? getOfficialNetSalePrice(item.unitPrice)
                            : addOfficialTax(item.unitPrice),
                        )
                      })
                      if (checked) {
                        setMode('POS')
                        setPendingPreventa(null)
                      } else if (thirdPartyId) {
                        // El cliente pudo elegirse en modo oficial, donde no se buscó su preventa activa.
                        void checkPendingPreventa(thirdPartyId)
                      }
                    }}
                    uncheckedLabel="Normal"
                    checkedLabel="Oficial"
                  />
                )}
                {canCreateCOT && !official && (
                  <SegmentedToggle
                    checked={isCredit}
                    disabled={Boolean(draftId)}
                    onChange={(checked) => {
                      if (!draftId) setMode(checked ? 'COT' : 'POS')
                    }}
                    uncheckedLabel="Contado"
                    checkedLabel="Crédito"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-content-secondary">
                  <User className="w-3.5 h-3.5" />
                  Cliente <span className="text-red-500">*</span>
                </label>
                <Combobox
                  value={thirdPartyId}
                  onChange={(id, option) => {
                    void handleCustomerSelected(id, option.label)
                  }}
                  options={tpDisplayOptions}
                  isLoading={isLoadingTp}
                  placeholder="Selecciona un cliente..."
                  searchValue={tpSearch}
                  onSearchChange={setTpSearch}
                />
                {checkingPreventa && (
                  <p className="text-xs text-content-faint font-accent">
                    Buscando preventas activas...
                  </p>
                )}
                {thirdPartyId && (
                  <CustomerBranchSelect
                    branches={customerBranches}
                    value={customerBranchId}
                    onChange={setCustomerBranchId}
                    isLoading={isLoadingBranches}
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-content-secondary">
                  <UserCog className="w-3.5 h-3.5" />
                  Vendedora <span className="text-red-500">*</span>
                </label>
                <Combobox
                  value={sellerId}
                  onChange={(id, option) => {
                    setSellerId(id)
                    setSellerSelectedName(option.label)
                  }}
                  options={sellerDisplayOptions}
                  isLoading={isLoadingSeller}
                  placeholder="Selecciona una vendedora..."
                  searchValue={sellerSearch}
                  onSearchChange={setSellerSearch}
                />
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-content-secondary">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Fecha
                </label>
                <input
                  type="date"
                  value={todayInBogota()}
                  readOnly
                  className="input-hard w-full px-3 py-2 text-sm text-content border-ui-border-medium opacity-60 cursor-not-allowed"
                />
              </div>

              {/* Formas de pago — solo venta de contado con algo por cobrar. */}
              {needsPayments && (
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-content-secondary">
                    <Wallet className="w-3.5 h-3.5" />
                    Formas de pago <span className="text-red-500">*</span>
                  </label>
                  {paymentLines.map((line, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <select
                        value={line.method}
                        onChange={(e) =>
                          updatePaymentRow(index, { method: e.target.value as PaymentMethod | '' })
                        }
                        className="input-hard flex-1 min-w-0 px-3 py-2 text-sm text-content transition-all border-ui-border-medium"
                      >
                        <option value="">Selecciona una forma de pago</option>
                        {PAYMENT_METHOD_OPTIONS.filter(
                          (opt) =>
                            opt.value === line.method ||
                            !paymentLines.some((other) => other.method === opt.value),
                        ).map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <ThousandsInput
                        value={line.amount}
                        onChange={(v) => {
                          setIsAmountEdited(true)
                          updatePaymentRow(index, { amount: v })
                        }}
                        className="w-36 py-2 text-right bg-surface-raised"
                      />
                      {paymentLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePaymentRow(index)}
                          aria-label="Quitar forma de pago"
                          className="p-2 text-content-faint hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={addPaymentRow}
                      disabled={paymentLines.length >= PAYMENT_METHOD_OPTIONS.length}
                      className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar forma de pago
                    </button>
                    {paymentDifference !== 0 && (
                      <span
                        className={cn(
                          'text-sm font-medium',
                          paymentDifference > 0
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-500',
                        )}
                      >
                        {paymentDifference > 0
                          ? `Falta ${formatCOP(paymentDifference)}`
                          : `Sobra ${formatCOP(-paymentDifference)}`}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Panel de cupo de crédito — informativo, solo lectura. La validación real la hace
                el backend; esto solo muestra el bloqueo antes de confirmar. */}
            {isCredit && thirdPartyId && (
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50/60 dark:bg-indigo-500/10 p-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                  <CreditCard className="w-3.5 h-3.5" />
                  Cupo de crédito del cliente
                </p>
                {isLoadingCredit ? (
                  <p className="text-sm text-content-muted mt-2 font-accent">Consultando cupo...</p>
                ) : creditData ? (
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <div>
                      <p className="text-[11px] text-content-faint font-accent uppercase tracking-wide">
                        Límite
                      </p>
                      <p className="text-sm text-content mt-0.5 font-mono">
                        {formatCOP(creditData.creditLimit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-content-faint font-accent uppercase tracking-wide">
                        Usado
                      </p>
                      <p className="text-sm text-content mt-0.5 font-mono">
                        {formatCOP(creditData.usedCredit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-content-faint font-accent uppercase tracking-wide">
                        Disponible
                      </p>
                      <p
                        className={cn(
                          'text-sm mt-0.5 font-mono',
                          creditData.availableCredit <= 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-emerald-600 dark:text-emerald-400',
                        )}
                      >
                        {formatCOP(creditData.availableCredit)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-content-muted mt-2 font-accent">
                    No se pudo consultar el cupo.
                  </p>
                )}
                {creditExceeded && creditData && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-3">
                    El neto a crédito ({formatCOP(total - creditsApplied)}) supera el cupo
                    disponible ({formatCOP(creditData.availableCredit)}). Para realizarla, aumenta
                    el cupo del cliente desde su ficha (requiere autorización).
                  </p>
                )}
              </div>
            )}

            {/* Error de cupo devuelto por el backend (dos ventas compitiendo por el cupo, o al convertir). */}
            {creditError && (
              <div className="rounded-xl border-2 border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 p-4">
                <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                  {creditError.message}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                  <div>
                    <p className="text-red-600/70 dark:text-red-400/70 font-accent">Límite</p>
                    <p className="text-red-700 dark:text-red-400 mt-0.5 font-mono">
                      {formatCOP(creditError.detail.creditLimit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-red-600/70 dark:text-red-400/70 font-accent">Usado</p>
                    <p className="text-red-700 dark:text-red-400 mt-0.5 font-mono">
                      {formatCOP(creditError.detail.usedCredit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-red-600/70 dark:text-red-400/70 font-accent">Disponible</p>
                    <p className="text-red-700 dark:text-red-400 mt-0.5 font-mono">
                      {formatCOP(creditError.detail.availableCredit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-red-600/70 dark:text-red-400/70 font-accent">Solicitado</p>
                    <p className="text-red-700 dark:text-red-400 mt-0.5 font-mono">
                      {formatCOP(creditError.detail.requested)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Saldo a favor del cliente aplicable a esta venta. */}
            {!official && (
              <CreditsPanel
                title="Saldo a favor del cliente"
                credits={availableCredits.map((c) => ({
                  id: c.id,
                  balance: c.balance,
                  label: docNumber(c.sourceDocument.type, c.sourceDocument.number),
                }))}
                creditAmounts={creditAmounts}
                setCreditAmount={setCreditAmount}
                creditsApplied={creditsApplied}
                totalAvailable={availableCreditsData?.totalAvailable ?? 0}
              />
            )}
          </div>

          {/* Aviso de preventa activa */}
          {pendingPreventa && !official && (
            <div className="flex items-start gap-3 px-5 py-4 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
              <ArrowRightLeft className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">
                  {pendingPreventa.thirdParty?.name ?? 'Este cliente'} tiene una{' '}
                  {sourceTypeLabel(pendingPreventa.type)} activa (
                  {docNumber(pendingPreventa.type, pendingPreventa.number)}) con productos
                  pendientes por convertir.
                </p>
                <p className="text-xs text-blue-600/80 dark:text-blue-400/70 mt-1 font-accent">
                  Se creará una venta {isCredit ? 'a crédito' : 'nueva'} con los mismos ítems y
                  precios cotizados de esa {sourceTypeLabel(pendingPreventa.type)}.
                  {fields.length > 0 &&
                    ` Esto reemplazará los ${fields.length} producto(s) ya agregados al carrito.`}
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <button
                    type="button"
                    onClick={() => doConvert(pendingPreventa.id)}
                    disabled={isConverting}
                    className="btn-primary flex items-center gap-2 px-3 py-1.5 text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isConverting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Convertir a esta venta
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingPreventa(null)}
                    className="text-xs font-medium text-content-muted hover:text-content transition-colors"
                  >
                    Ahora no
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Productos */}
          <div className="card-hard overflow-hidden">
            <div className="px-6 py-4 border-b border-ui-divide flex items-center justify-between">
              <div>
                <h2 className="text-base text-content">Productos</h2>
                <p className="text-xs text-content-faint font-accent mt-0.5">
                  Escanea o busca para agregar
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  append({
                    productId: '',
                    productCode: '',
                    productDesc: '',
                    quantity: 1,
                    unitCost: undefined,
                    unitPrice: undefined,
                    observaciones: undefined,
                    addedAt: new Date().toISOString(),
                  })
                }
                className="btn-primary flex items-center gap-2 px-3 py-1.5 text-sm"
              >
                <Plus className="w-4 h-4" />
                Agregar ítem
              </button>
            </div>

            <BarcodeScanInput
              docType={docType}
              append={append}
              getValues={getValues}
              setValue={setValue}
              onProductScanned={() => {}}
              focusQuantityInput={() => {}}
              supplierBrandIds={undefined}
            />

            {fields.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-content-muted text-sm">
                  El carrito está vacío. Escanea o busca un producto.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ui-border">
                      <th className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-4 py-3">
                        Producto
                      </th>
                      <th className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-4 py-3 w-24">
                        Cant.
                      </th>
                      <th className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-4 py-3 w-32">
                        Precio unit.{' '}
                        {official && (
                          <span className="text-content-faint normal-case">(sin IVA)</span>
                        )}
                      </th>
                      <th className="text-right text-xs font-semibold text-content-faint uppercase tracking-wider px-4 py-3 w-32">
                        Subtotal
                      </th>
                      {official && (
                        <th className="text-right text-xs font-semibold text-content-faint uppercase tracking-wider px-4 py-3 w-28">
                          IVA 19%
                        </th>
                      )}
                      <th className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-4 py-3 w-40">
                        Hora
                      </th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ui-divide">
                    {fields.map((field, index) => {
                      const code = cartItems[index]?.productCode
                      const detail = code ? productDetailByCode.get(code) : undefined
                      return (
                        <POSCartLine
                          key={field.id}
                          index={index}
                          register={register}
                          control={control}
                          watch={watch}
                          onRemove={() => remove(index)}
                          onProductSelect={(product) => handleRowProductSelect(index, product)}
                          minSalePrice={detail && minSalePriceByProductId.get(detail.id)}
                          availableStock={official ? undefined : detail?.availableStock}
                          showTax={official}
                        />
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Resumen (sticky) ──────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-6 space-y-4">
          <div className="card-hard p-6 space-y-4">
            <div>
              <p className="text-xs text-content-faint font-accent uppercase tracking-wider">
                {official
                  ? 'Total a pagar (con IVA)'
                  : creditsApplied > 0
                    ? isCredit
                      ? 'Total a crédito (neto)'
                      : 'Total a pagar en efectivo'
                    : 'Total a pagar'}
              </p>
              <p className="text-4xl text-content mt-1 font-display tabular-nums">
                {formatCOP(totalToPay)}
              </p>
              {official && (
                <div className="mt-2 space-y-0.5 text-xs font-accent">
                  <div className="flex items-center justify-between text-content-muted">
                    <span>Subtotal (sin IVA)</span>
                    <span className="font-mono">{formatCOP(officialTotals.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-content-muted">
                    <span>IVA (19%)</span>
                    <span className="font-mono">{formatCOP(officialTotals.taxTotal)}</span>
                  </div>
                </div>
              )}
              {creditsApplied > 0 && (
                <div className="mt-2 space-y-0.5 text-xs font-accent">
                  <div className="flex items-center justify-between text-content-muted">
                    <span>Total</span>
                    <span className="font-mono">{formatCOP(total)}</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Saldo a favor</span>
                    <span className="font-mono">− {formatCOP(creditsApplied)}</span>
                  </div>
                </div>
              )}
              <p className="text-xs text-content-muted mt-2 font-accent">
                {fields.length} producto{fields.length === 1 ? '' : 's'} · {totalUnits} unidad
                {totalUnits === 1 ? '' : 'es'}
              </p>
            </div>

            {missingItems.length > 0 && (
              <ul className="space-y-1.5 text-xs text-amber-600 dark:text-amber-400 border-t border-ui-divide pt-4">
                {missingItems.map((m) => (
                  <li key={m} className="flex items-start gap-1.5">
                    <span className="mt-0.5">•</span>
                    {m}
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={() => {
                void handleConfirm()
              }}
              disabled={!canConfirm || isSubmitting}
              className="btn-primary w-full flex items-center justify-center gap-2 px-5 py-3 text-sm disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar venta
            </button>
            <button
              type="button"
              onClick={() => navigate('/documents')}
              className="btn-secondary w-full px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>

      {missingStock && (
        <MissingStockDialog missingStock={missingStock} onClose={() => setMissingStock(null)} />
      )}
    </div>
  )
}
