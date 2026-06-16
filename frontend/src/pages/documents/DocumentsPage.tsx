import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import { FileText, CheckCircle2, Clock, Plus } from 'lucide-react'
import { getDocuments } from '@/services/documents.service'
import {
  StatsGrid,
  TableToolbar,
  TableSkeleton,
  EmptyState,
  ErrorState,
  TablePagination,
} from '@/components/shared'
import { cn } from '@/lib/utils'
import type { DocumentListItem, DocumentType, DocumentStatus } from '@/types/document.types'

// ─── helpers ────────────────────────────────────────────────────────────────

const formatCOP = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

// ─── label maps ─────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<DocumentType, { label: string; className: string }> = {
  CM:  { label: 'Compra',           className: 'bg-blue-100   text-blue-700   dark:bg-blue-500/20   dark:text-blue-400'   },
  DVC: { label: 'Dev. Compra',      className: 'bg-amber-100  text-amber-700  dark:bg-amber-500/20  dark:text-amber-400'  },
  EAI: { label: 'Entrada Ajuste',   className: 'bg-teal-100   text-teal-700   dark:bg-teal-500/20   dark:text-teal-400'   },
  SAJ: { label: 'Salida Ajuste',    className: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' },
  T:   { label: 'Traslado',         className: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' },
}

const STATUS_LABELS: Record<DocumentStatus, { label: string; className: string }> = {
  draft:     { label: 'Borrador',   className: 'bg-gray-100  text-gray-600  dark:bg-gray-500/20  dark:text-gray-400'  },
  confirmed: { label: 'Confirmado', className: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
  voided:    { label: 'Anulado',    className: 'bg-red-100   text-red-700   dark:bg-red-500/20   dark:text-red-400'   },
}

const ALL_TYPES: { value: string; label: string }[] = [
  { value: '',    label: 'Todos los tipos' },
  { value: 'CM',  label: 'Compra' },
  { value: 'DVC', label: 'Devolución compra' },
  { value: 'EAI', label: 'Entrada ajuste' },
  { value: 'SAJ', label: 'Salida ajuste' },
  { value: 'T',   label: 'Traslado' },
]

const ALL_STATUSES: { value: string; label: string }[] = [
  { value: '',          label: 'Todos los estados' },
  { value: 'draft',     label: 'Borrador' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'voided',    label: 'Anulado' },
]

// ─── component ──────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const navigate = useNavigate()

  const [search, setSearch]         = useState('')
  const [typeFilter, setTypeFilter] = useState<DocumentType | ''>('')
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | ''>('')
  const [page, setPage] = useState(1)

  const [debouncedSearch] = useDebounce(search, 400)

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [debouncedSearch, typeFilter, statusFilter])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['documents', debouncedSearch, typeFilter, statusFilter, page],
    queryFn: () =>
      getDocuments({
        search: debouncedSearch || undefined,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        page,
        limit: 20,
      }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })

  const items        = data?.items ?? []
  const meta         = data?.meta
  const total        = meta?.total ?? 0
  const totalPages   = meta?.totalPages ?? 1
  const confirmedCount = meta?.confirmedCount ?? 0
  const draftCount   = meta?.draftCount ?? 0

  const statCards = [
    {
      label: 'Total',
      value: total,
      icon: FileText,
      bg: 'bg-brand-primary/10',
      fg: 'text-brand-primary dark:text-content',
    },
    {
      label: 'Confirmados',
      value: confirmedCount,
      icon: CheckCircle2,
      bg: 'bg-brand-secondary/10',
      fg: 'text-brand-secondary',
    },
    {
      label: 'Borradores',
      value: draftCount,
      icon: Clock,
      bg: 'bg-amber-500/10',
      fg: 'text-amber-500',
    },
  ]

  const docNumber = (doc: DocumentListItem) =>
    `${doc.type}-${String(doc.number).padStart(6, '0')}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-content">Operaciones</h1>
          <p className="text-content-muted text-sm mt-0.5 font-accent">
            Compras, ajustes y traslados de inventario
          </p>
        </div>
        <button
          onClick={() => navigate('/documents/new')}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl transition-all hover:opacity-90 hover:shadow-lg active:scale-[0.98] gradient-action"
        >
          <Plus className="w-4 h-4" />
          Nueva operación
        </button>
      </div>

      <StatsGrid cards={statCards} isLoading={isLoading} />

      {/* Table card */}
      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
        {/* Toolbar row */}
        <div className="border-b border-ui-border">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            placeholder="Buscar por número..."
            isLoading={isLoading}
            itemCount={items.length}
            total={total}
            onRefresh={refetch}
          />
          {/* Extra filter row */}
          <div className="px-5 pb-4 flex gap-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as DocumentType | '')}
              className="text-sm bg-surface-raised border border-ui-border-medium rounded-lg px-3 py-1.5 text-content focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all"
            >
              {ALL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as DocumentStatus | '')}
              className="text-sm bg-surface-raised border border-ui-border-medium rounded-lg px-3 py-1.5 text-content focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all"
            >
              {ALL_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isError && (
          <ErrorState message="Error al cargar las operaciones" onRetry={refetch} />
        )}

        {isLoading && (
          <TableSkeleton rows={6} widths={['w-28', 'w-36', 'w-24', 'w-20']} />
        )}

        {!isLoading && !isError && items.length === 0 && (
          <EmptyState
            icon={FileText}
            title={
              debouncedSearch
                ? `Sin resultados para "${debouncedSearch}"`
                : 'No hay operaciones registradas'
            }
            description={
              debouncedSearch
                ? 'Prueba con otro número de operación'
                : 'Crea la primera con el botón "Nueva operación"'
            }
          />
        )}

        {!isLoading && !isError && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border">
                  {['Número', 'Fecha', 'Tipo', 'Tercero', 'Bodega', 'Ítems', 'Total', 'Estado'].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-5 py-3"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-divide">
                {items.map((doc) => {
                  const typeInfo   = TYPE_LABELS[doc.type]
                  const statusInfo = STATUS_LABELS[doc.status]
                  return (
                    <tr
                      key={doc.id}
                      onClick={() => navigate(`/documents/${doc.id}`)}
                      className="hover:bg-surface-raised transition-colors group cursor-pointer"
                    >
                      {/* Number */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 gradient-dark">
                            <FileText className="w-4 h-4 text-white/70" />
                          </div>
                          <span className="font-mono text-xs font-medium text-content">
                            {docNumber(doc)}
                          </span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                        {formatDate(doc.date)}
                      </td>

                      {/* Type */}
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
                            typeInfo.className,
                          )}
                        >
                          {typeInfo.label}
                        </span>
                      </td>

                      {/* Third party */}
                      <td className="px-5 py-3.5 text-content-secondary text-xs max-w-[180px]">
                        <span className="truncate block">
                          {doc.thirdParty?.name ?? '—'}
                        </span>
                      </td>

                      {/* Warehouse */}
                      <td className="px-5 py-3.5 text-content-muted text-xs max-w-[140px]">
                        <span className="truncate block">
                          {doc.type === 'T'
                            ? `${doc.warehouse?.name ?? '—'} → ${doc.destWarehouse?.name ?? '—'}`
                            : (doc.warehouse?.name ?? doc.destWarehouse?.name ?? '—')}
                        </span>
                      </td>

                      {/* Item count */}
                      <td className="px-5 py-3.5 text-content-faint text-xs text-center">
                        {doc._count.documentItems}
                      </td>

                      {/* Total */}
                      <td className="px-5 py-3.5 text-content-secondary font-medium text-xs whitespace-nowrap">
                        {formatCOP(doc.total)}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium',
                            statusInfo.className,
                          )}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isError && (
          <TablePagination
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  )
}
