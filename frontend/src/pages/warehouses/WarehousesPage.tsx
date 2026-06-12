import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Warehouse, Store, Plus, Pencil, Trash2 } from 'lucide-react'
import { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from '@/services/warehouses.service'
import { WarehouseForm } from './components/WarehouseForm'
import type { WarehouseFormValues } from './components/WarehouseForm'
import { DeleteWarehouseDialog } from './components/DeleteWarehouseDialog'
import { StatsGrid, TableSkeleton, EmptyState, ErrorState } from '@/components/shared'
import { cn } from '@/lib/utils'
import type { Warehouse as WarehouseType } from '@/types'

const TYPE_LABELS: Record<string, { label: string; className: string }> = {
  store:     { label: 'Almacén', className: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
  warehouse: { label: 'Bodega',  className: 'bg-blue-100  text-blue-700  dark:bg-blue-500/20  dark:text-blue-400'  },
}

export default function WarehousesPage() {
  const queryClient = useQueryClient()

  const [formOpen, setFormOpen]   = useState(false)
  const [editing, setEditing]     = useState<WarehouseType | null>(null)
  const [deleting, setDeleting]   = useState<WarehouseType | null>(null)

  const { data: items = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => getWarehouses(),
    staleTime: 5 * 60 * 1000,
  })

  const total          = items.length
  const storeCount     = items.filter((w) => w.type === 'store').length
  const warehouseCount = items.filter((w) => w.type === 'warehouse').length

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['warehouses'] })

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: (payload: WarehouseFormValues) =>
      createWarehouse({ name: payload.name, type: payload.type }),
    onSuccess: () => { invalidate(); setFormOpen(false); toast.success('Bodega creada correctamente') },
    onError:   () => toast.error('Error al crear la bodega'),
  })

  const { mutate: update, isPending: isUpdating } = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: WarehouseFormValues }) =>
      updateWarehouse(id, { name: payload.name, type: payload.type, active: payload.active }),
    onSuccess: () => { invalidate(); setEditing(null); toast.success('Bodega actualizada correctamente') },
    onError:   () => toast.error('Error al actualizar la bodega'),
  })

  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => deleteWarehouse(id),
    onSuccess: () => { invalidate(); setDeleting(null); toast.success('Bodega desactivada correctamente') },
    onError:   () => toast.error('Error al desactivar la bodega'),
  })

  const statCards = [
    { label: 'Total',     value: total,          icon: Warehouse, bg: 'bg-brand-primary/10',   fg: 'text-brand-primary dark:text-content' },
    { label: 'Almacenes', value: storeCount,     icon: Store,     bg: 'bg-brand-secondary/10', fg: 'text-brand-secondary' },
    { label: 'Bodegas',   value: warehouseCount, icon: Warehouse, bg: 'bg-blue-500/10',        fg: 'text-blue-500' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-content">Bodegas</h1>
          <p className="text-content-muted text-sm mt-0.5 font-accent">Gestión de bodegas y almacenes</p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl transition-all hover:opacity-90 hover:shadow-lg active:scale-[0.98] gradient-action"
        >
          <Plus className="w-4 h-4" />
          Nueva bodega
        </button>
      </div>

      <StatsGrid cards={statCards} isLoading={isLoading} />

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
        {/* Toolbar — count + refresh only, no search */}
        <div className="px-5 py-4 border-b border-ui-border flex items-center justify-between">
          <p className="text-xs text-content-faint">
            {isLoading ? '...' : `${items.length} registros`}
          </p>
          <button
            onClick={() => refetch()}
            className="text-xs text-content-faint hover:text-content-muted underline transition-colors"
          >
            Actualizar
          </button>
        </div>

        {isError && (
          <ErrorState message="Error al cargar las bodegas" onRetry={refetch} />
        )}

        {isLoading && (
          <TableSkeleton widths={['w-40', 'w-20', 'w-16', 'w-16']} />
        )}

        {!isLoading && !isError && items.length === 0 && (
          <EmptyState
            icon={Warehouse}
            title="No hay bodegas registradas"
            description={'Crea la primera con el botón "Nueva bodega"'}
          />
        )}

        {!isLoading && !isError && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border">
                  {['Nombre', 'Tipo', 'Zonas', 'Estado', 'Acciones'].map((h) => (
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
                {items.map((w) => {
                  const typeInfo = TYPE_LABELS[w.type] ?? TYPE_LABELS.warehouse
                  return (
                    <tr
                      key={w.id}
                      onClick={() => setEditing(w)}
                      className="hover:bg-surface-raised transition-colors group cursor-pointer"
                    >
                      {/* Name */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 gradient-dark">
                            <Warehouse className="w-4 h-4 text-white/70" />
                          </div>
                          <p className="font-medium text-content">{w.name}</p>
                        </div>
                      </td>

                      {/* Type badge */}
                      <td className="px-5 py-3.5">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', typeInfo.className)}>
                          {typeInfo.label}
                        </span>
                      </td>

                      {/* Zone count */}
                      <td className="px-5 py-3.5">
                        <span className="text-content-muted text-xs">
                          {w._count.zones} {w._count.zones === 1 ? 'zona' : 'zonas'}
                        </span>
                      </td>

                      {/* Active badge */}
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium',
                            w.active
                              ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                              : 'bg-gray-100 text-gray-500 dark:bg-gray-500/20 dark:text-gray-400',
                          )}
                        >
                          {w.active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditing(w) }}
                            className="p-1.5 rounded-lg text-content-faint hover:text-brand-secondary hover:bg-brand-secondary/10 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleting(w) }}
                            className="p-1.5 rounded-lg text-content-faint hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <WarehouseForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={(data) => create(data)}
        isPending={isCreating}
      />
      <WarehouseForm
        open={!!editing}
        onClose={() => setEditing(null)}
        onSubmit={(data) => update({ id: editing!.id, payload: data })}
        isPending={isUpdating}
        defaultValues={editing ?? undefined}
      />
      <DeleteWarehouseDialog
        warehouse={deleting}
        onConfirm={() => remove(deleting!.id)}
        onCancel={() => setDeleting(null)}
        isPending={isDeleting}
      />
    </div>
  )
}
