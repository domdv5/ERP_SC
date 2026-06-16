import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CheckCircle2,
  Pencil,
  Trash2,
  XCircle,
  AlertTriangle,
  FileText,
  User,
  Calendar,
  Warehouse,
  ArrowRight,
  Package,
  Loader2,
} from 'lucide-react'

import {
  getDocument,
  confirmDocument,
  voidDocument,
  deleteDocument,
} from '@/services/documents.service'
import { cn } from '@/lib/utils'
import type { DocumentType, DocumentStatus } from '@/types/document.types'

// ─── helpers ─────────────────────────────────────────────────────────────────

const formatCOP = (v: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(v)

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

// ─── label maps ──────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<DocumentType, { label: string; className: string }> = {
  CM:  { label: 'Compra',          className: 'bg-blue-100   text-blue-700   dark:bg-blue-500/20   dark:text-blue-400'   },
  DVC: { label: 'Dev. Compra',     className: 'bg-amber-100  text-amber-700  dark:bg-amber-500/20  dark:text-amber-400'  },
  EAI: { label: 'Entrada Ajuste',  className: 'bg-teal-100   text-teal-700   dark:bg-teal-500/20   dark:text-teal-400'   },
  SAJ: { label: 'Salida Ajuste',   className: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' },
  T:   { label: 'Traslado',        className: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' },
}

const STATUS_LABELS: Record<DocumentStatus, { label: string; className: string }> = {
  draft:     { label: 'Borrador',   className: 'bg-gray-100  text-gray-600  dark:bg-gray-500/20  dark:text-gray-400'  },
  confirmed: { label: 'Confirmado', className: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
  voided:    { label: 'Anulado',    className: 'bg-red-100   text-red-700   dark:bg-red-500/20   dark:text-red-400'   },
}

// ─── confirm dialog ───────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  confirmClass: string
  isPending: boolean
  onConfirm: () => void
  onCancel: () => void
  icon: React.ReactNode
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmClass,
  isPending,
  onConfirm,
  onCancel,
  icon,
}: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative z-10 bg-surface rounded-2xl border border-ui-border shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-start gap-4">
          <div className="shrink-0 mt-0.5">{icon}</div>
          <div>
            <h3 className="text-base text-content mb-2">{title}</h3>
            <p className="text-sm text-content-secondary leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-content-secondary border border-ui-border-medium rounded-xl hover:bg-surface-hover transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl transition-opacity disabled:opacity-60',
              confirmClass,
            )}
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── detail page ─────────────────────────────────────────────────────────────

export default function DocumentDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const queryClient = useQueryClient()

  const [confirmOpen, setConfirmOpen]   = useState(false)
  const [voidOpen, setVoidOpen]         = useState(false)
  const [deleteOpen, setDeleteOpen]     = useState(false)

  const {
    data: doc,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['document', id],
    queryFn: () => getDocument(id!),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(id),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['documents'] })
    queryClient.invalidateQueries({ queryKey: ['document', id] })
  }

  const { mutate: doConfirm, isPending: isConfirming } = useMutation({
    mutationFn: () => confirmDocument(id!),
    onSuccess: () => {
      invalidate()
      setConfirmOpen(false)
      toast.success('Operación confirmada. El inventario fue actualizado.')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Error al confirmar la operación')
    },
  })

  const { mutate: doVoid, isPending: isVoiding } = useMutation({
    mutationFn: () => voidDocument(id!),
    onSuccess: () => {
      invalidate()
      setVoidOpen(false)
      toast.success('Operación anulada. Los movimientos de inventario fueron revertidos.')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Error al anular la operación')
    },
  })

  const { mutate: doDelete, isPending: isDeleting } = useMutation({
    mutationFn: () => deleteDocument(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      toast.success('Operación eliminada correctamente')
      navigate('/documents')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Error al eliminar la operación')
    },
  })

  // ── loading / error states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-surface-hover animate-pulse" />
          <div className="w-48 h-7 rounded-lg bg-surface-hover animate-pulse" />
        </div>
        <div className="bg-surface rounded-2xl border border-ui-border p-6 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-6 rounded-lg bg-surface-hover animate-pulse" style={{ width: `${60 + i * 10}%` }} />
          ))}
        </div>
        <div className="bg-surface rounded-2xl border border-ui-border p-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-surface-hover animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !doc) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/documents')}
          className="flex items-center gap-2 text-sm text-content-muted hover:text-content transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a operaciones
        </button>
        <div className="bg-surface rounded-2xl border border-ui-border p-8 text-center">
          <FileText className="w-12 h-12 text-content-faint mx-auto mb-3" />
          <p className="text-content-secondary mb-3">Error al cargar la operación</p>
          <button
            onClick={() => refetch()}
            className="text-sm text-brand-secondary hover:underline"
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    )
  }

  const docNumber    = `${doc.type}-${String(doc.number).padStart(6, '0')}`
  const typeInfo     = TYPE_LABELS[doc.type]
  const statusInfo   = STATUS_LABELS[doc.status]
  const isDraft      = doc.status === 'draft'
  const isConfirmed  = doc.status === 'confirmed'
  const isVoided     = doc.status === 'voided'

  const itemsTotal = doc.documentItems.reduce((sum, item) => sum + item.subtotal, 0)

  return (
    <div className="space-y-6 pb-10">
      {/* Back */}
      <button
        onClick={() => navigate('/documents')}
        className="flex items-center gap-2 text-sm text-content-muted hover:text-content transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a operaciones
      </button>

      {/* Voided banner */}
      {isVoided && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-red-500/10 border border-red-500/20">
          <XCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">
            Esta operación fue anulada. Los movimientos de inventario fueron revertidos.
          </p>
        </div>
      )}

      {/* Header card */}
      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 gradient-dark">
              <FileText className="w-6 h-6 text-white/70" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl text-content font-mono">{docNumber}</h1>
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', typeInfo.className)}>
                  {typeInfo.label}
                </span>
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', statusInfo.className)}>
                  {statusInfo.label}
                </span>
              </div>
              <p className="text-content-muted text-sm mt-1 font-accent">
                Creado por {doc.user.name}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {isDraft && (
              <>
                <button
                  onClick={() => navigate(`/documents/${doc.id}/edit`)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-content-secondary border border-ui-border-medium rounded-xl hover:bg-surface-hover transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Editar
                </button>
                <button
                  onClick={() => setDeleteOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
                <button
                  onClick={() => setConfirmOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl gradient-action hover:opacity-90 transition-opacity"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmar
                </button>
              </>
            )}
            {isConfirmed && (
              <button
                onClick={() => setVoidOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Anular
              </button>
            )}
          </div>
        </div>

        {/* Meta grid */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 border-t border-ui-divide pt-5">
          {/* Date */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-content-muted" />
            </div>
            <div>
              <p className="text-xs text-content-faint font-accent">Fecha</p>
              <p className="text-sm text-content">{formatDate(doc.date)}</p>
            </div>
          </div>

          {/* Third party */}
          {doc.thirdParty && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-content-muted" />
              </div>
              <div>
                <p className="text-xs text-content-faint font-accent">
                  {doc.type === 'CM' || doc.type === 'DVC' ? 'Proveedor' : 'Tercero'}
                </p>
                <p className="text-sm text-content">{doc.thirdParty.name}</p>
              </div>
            </div>
          )}

          {/* Warehouse(s) */}
          {doc.type === 'T' ? (
            <div className="flex items-start gap-3 col-span-2">
              <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
                <ArrowRight className="w-4 h-4 text-content-muted" />
              </div>
              <div>
                <p className="text-xs text-content-faint font-accent">Traslado</p>
                <div className="flex items-center gap-2 text-sm text-content">
                  <span>{doc.warehouse?.name ?? '—'}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-content-faint" />
                  <span>{doc.destWarehouse?.name ?? '—'}</span>
                  {doc.destBin && (
                    <span className="text-content-muted">
                      / {doc.destBin.zone.name} / {doc.destBin.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            (doc.warehouse || doc.destWarehouse) && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
                  <Warehouse className="w-4 h-4 text-content-muted" />
                </div>
                <div>
                  <p className="text-xs text-content-faint font-accent">Bodega</p>
                  <p className="text-sm text-content">
                    {doc.destWarehouse?.name ?? doc.warehouse?.name ?? '—'}
                  </p>
                </div>
              </div>
            )
          )}

          {/* Freight */}
          {doc.freight !== null && doc.freight !== undefined && doc.freight > 0 && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
                <Package className="w-4 h-4 text-content-muted" />
              </div>
              <div>
                <p className="text-xs text-content-faint font-accent">Flete</p>
                <p className="text-sm text-content">{formatCOP(doc.freight)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        {doc.notes && (
          <div className="mt-4 px-4 py-3 rounded-xl bg-surface-raised border border-ui-border">
            <p className="text-xs text-content-faint font-accent mb-1">Notas</p>
            <p className="text-sm text-content-secondary">{doc.notes}</p>
          </div>
        )}
      </div>

      {/* Items table */}
      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-ui-divide">
          <h2 className="text-base text-content">
            Ítems
            <span className="ml-2 text-sm text-content-faint font-normal">
              ({doc.documentItems.length})
            </span>
          </h2>
        </div>

        {doc.documentItems.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-content-muted text-sm">Sin ítems</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border">
                  {['Código', 'Descripción', 'Cantidad', 'Costo unit.', 'Subtotal'].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-5 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-divide">
                {doc.documentItems.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs text-content">
                      {item.product.code}
                    </td>
                    <td className="px-5 py-3.5 text-content max-w-[280px]">
                      <span className="truncate block">{item.product.description}</span>
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs">
                      {item.quantity.toLocaleString('es-CO')}
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs">
                      {item.unitCost > 0 ? formatCOP(item.unitCost) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-content-secondary font-medium text-xs">
                      {item.subtotal > 0 ? formatCOP(item.subtotal) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-ui-border bg-surface-raised">
                  <td colSpan={3} />
                  <td className="px-5 py-3.5 text-xs font-semibold text-content-faint uppercase tracking-wider">
                    Total
                  </td>
                  <td className="px-5 py-3.5 text-sm font-medium text-content-secondary">
                    {formatCOP(itemsTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Dialogs ────────────────────────────────────────────────────────── */}

      {/* Confirm document */}
      <ConfirmDialog
        open={confirmOpen}
        title="Confirmar operación"
        description={`Al confirmar ${docNumber}, se ejecutarán los movimientos de inventario correspondientes. Esta acción no se puede deshacer directamente (solo anulando la operación después).`}
        confirmLabel="Confirmar operación"
        confirmClass="gradient-action"
        isPending={isConfirming}
        onConfirm={doConfirm}
        onCancel={() => setConfirmOpen(false)}
        icon={
          <div className="w-10 h-10 rounded-xl flex items-center justify-center gradient-action shrink-0">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
        }
      />

      {/* Void document */}
      <ConfirmDialog
        open={voidOpen}
        title="Anular operación"
        description={`Al anular ${docNumber}, todos los movimientos de inventario generados por esta operación serán revertidos. Esta acción afecta el stock y no se puede deshacer.`}
        confirmLabel="Anular operación"
        confirmClass="bg-red-600 hover:bg-red-700"
        isPending={isVoiding}
        onConfirm={doVoid}
        onCancel={() => setVoidOpen(false)}
        icon={
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/15 shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
        }
      />

      {/* Delete document */}
      <ConfirmDialog
        open={deleteOpen}
        title="Eliminar operación"
        description={`¿Estás seguro de eliminar el borrador ${docNumber}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar borrador"
        confirmClass="bg-red-600 hover:bg-red-700"
        isPending={isDeleting}
        onConfirm={doDelete}
        onCancel={() => setDeleteOpen(false)}
        icon={
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/15 shrink-0">
            <Trash2 className="w-5 h-5 text-red-500" />
          </div>
        }
      />
    </div>
  )
}
