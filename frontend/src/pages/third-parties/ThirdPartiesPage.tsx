import { useEffect, useState } from 'react'
import { useDebounce } from 'use-debounce'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Users, Building2, User } from 'lucide-react'
import { getThirdParties, createThirdParty, updateThirdParty, deleteThirdParty } from '@/services/third-parties.service'
import { ThirdPartyForm } from './components/ThirdPartyForm'
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog'
import { StatsGrid, TableToolbar, TableSkeleton, EmptyState, ErrorState, TablePagination } from '@/components/shared'
import { cn } from '@/lib/utils'
import type { ThirdParty } from '@/types'

const ROLE_BADGES = [
  { key: 'isCustomer', label: 'Cliente',   color: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
  { key: 'isSupplier', label: 'Proveedor', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  { key: 'isSeller',   label: 'Vendedor',  color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' },
]

export default function ThirdPartiesPage() {
  const queryClient = useQueryClient()

  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const [formOpen, setFormOpen]   = useState(false)
  const [editing, setEditing]     = useState<ThirdParty | null>(null)
  const [deleting, setDeleting]   = useState<ThirdParty | null>(null)

  const [debouncedSearch] = useDebounce(search, 400)

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['third-parties', debouncedSearch, page],
    queryFn: () => getThirdParties({ search: debouncedSearch || undefined, page, limit: 20 }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })

  const totalPages    = data?.meta.totalPages ?? 1
  const items         = data?.items ?? []
  const total         = data?.meta.total ?? 0
  const customerCount = data?.meta.customerCount ?? 0
  const supplierCount = data?.meta.supplierCount ?? 0

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['third-parties'] })

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: createThirdParty,
    onSuccess: () => { invalidate(); setFormOpen(false); toast.success('Tercero creado correctamente') },
    onError:   () => toast.error('Error al crear el tercero'),
  })

  const { mutate: update, isPending: isUpdating } = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateThirdParty>[1] }) =>
      updateThirdParty(id, payload),
    onSuccess: () => { invalidate(); setEditing(null); toast.success('Tercero actualizado correctamente') },
    onError:   () => toast.error('Error al actualizar el tercero'),
  })

  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => deleteThirdParty(id),
    onSuccess: () => { invalidate(); setDeleting(null); toast.success('Tercero eliminado correctamente') },
    onError:   () => toast.error('Error al eliminar el tercero'),
  })

  const statCards = [
    { label: 'Total',       value: total,          icon: Users,     bg: 'bg-brand-primary/10',   fg: 'text-brand-primary dark:text-content' },
    { label: 'Clientes',    value: customerCount,  icon: User,      bg: 'bg-brand-secondary/10', fg: 'text-brand-secondary' },
    { label: 'Proveedores', value: supplierCount,  icon: Building2, bg: 'bg-blue-500/10',        fg: 'text-blue-500' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-content">Terceros</h1>
          <p className="text-content-muted text-sm mt-0.5 font-accent">Clientes, proveedores y vendedores</p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl transition-all hover:opacity-90 hover:shadow-lg active:scale-[0.98] gradient-action"
        >
          <Plus className="w-4 h-4" />
          Nuevo tercero
        </button>
      </div>

      <StatsGrid cards={statCards} isLoading={isLoading} />

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          placeholder="Buscar por nombre o documento..."
          isLoading={isLoading}
          itemCount={items.length}
          total={total}
          onRefresh={refetch}
        />

        {isError && (
          <ErrorState message="Error al cargar los terceros" onRetry={refetch} />
        )}

        {isLoading && (
          <TableSkeleton widths={['w-40', 'w-28', 'w-16', 'w-24']} />
        )}

        {!isLoading && !isError && items.length === 0 && (
          <EmptyState
            icon={Users}
            title={debouncedSearch ? `Sin resultados para "${debouncedSearch}"` : 'No hay terceros registrados'}
            description={debouncedSearch ? 'Prueba con otro término de búsqueda' : 'Crea el primero con el botón "Nuevo tercero"'}
          />
        )}

        {!isLoading && !isError && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border">
                  {['Nombre', 'Tipo', 'Tipo Doc.', 'N° Documento', 'Contacto', 'Roles', 'Acciones'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-5 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-divide">
                {items.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-raised transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 gradient-user">
                          {t.name[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-content">{t.name}</p>
                          {t.email && <p className="text-xs text-content-faint">{t.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                        t.personType === 'natural'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                          : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400'
                      )}>
                        {t.personType === 'natural' ? 'Natural' : 'Jurídica'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs font-medium text-content-muted">{t.documentType}</span>
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs">{t.documentNumber}</td>
                    <td className="px-5 py-3.5 text-content-muted text-xs">{t.phone ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1 flex-wrap">
                        {ROLE_BADGES.filter(({ key }) => t[key as keyof ThirdParty]).map(({ key, label, color }) => (
                          <span key={key} className={cn('px-2 py-0.5 rounded-full text-xs font-medium', color)}>
                            {label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditing(t)}
                          className="p-1.5 rounded-lg text-content-faint hover:text-brand-secondary hover:bg-brand-secondary/10 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleting(t)}
                          className="p-1.5 rounded-lg text-content-faint hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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

      {/* Modals */}
      <ThirdPartyForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={(data) => create(data as Parameters<typeof createThirdParty>[0])}
        isPending={isCreating}
      />
      <ThirdPartyForm
        open={!!editing}
        onClose={() => setEditing(null)}
        onSubmit={(data) => update({ id: editing!.id, payload: data })}
        isPending={isUpdating}
        defaultValues={editing ?? undefined}
      />
      <DeleteConfirmDialog
        thirdParty={deleting}
        onConfirm={() => remove(deleting!.id)}
        onCancel={() => setDeleting(null)}
        isPending={isDeleting}
      />
    </div>
  )
}
