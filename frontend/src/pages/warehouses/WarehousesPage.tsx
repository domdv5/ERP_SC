import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import {
  getWarehouses, getWarehouse,
  createWarehouse, updateWarehouse, deleteWarehouse,
  createZone, updateZone, createBin, updateBin,
} from '@/services/warehouses.service'
import { usePermission } from '@/hooks/usePermission'
import { WarehouseForm } from './components/WarehouseForm'
import type { WarehouseFormValues } from './components/WarehouseForm'
import { DeleteWarehouseDialog } from './components/DeleteWarehouseDialog'
import { DetailPanel } from './components/DetailPanel'
import { ZoneForm } from './components/ZoneForm'
import type { ZoneFormValues } from './components/ZoneForm'
import { BinForm } from './components/BinForm'
import type { BinFormValues } from './components/BinForm'
import type { Warehouse as WarehouseType, Zone, Bin } from '@/types'
import type { Selection } from './warehouse-tree.types'

type ZoneModalState =
  | { mode: 'create'; warehouseId: string }
  | { mode: 'edit'; warehouseId: string; zone: Zone }

type BinModalState =
  | { mode: 'create'; zone: Zone }
  | { mode: 'edit'; zone: Zone; bin: Bin }

export default function WarehousesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient   = useQueryClient()
  const canManage     = usePermission('warehouse.manage')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing]   = useState<WarehouseType | null>(null)
  const [deleting, setDeleting] = useState<WarehouseType | null>(null)

  const [zoneModal, setZoneModal] = useState<ZoneModalState | null>(null)
  const [binModal, setBinModal]   = useState<BinModalState | null>(null)

  const warehouseId = searchParams.get('id')
  const zoneId       = searchParams.get('zone')
  const binId        = searchParams.get('bin')

  const selection: Selection | null = warehouseId
    ? {
        kind: binId ? 'bin' : zoneId ? 'zone' : 'warehouse',
        warehouseId,
        zoneId: zoneId ?? undefined,
        binId: binId ?? undefined,
      }
    : null

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
    staleTime: 5 * 60 * 1000,
  })

  const {
    data: warehouseDetail,
    isLoading: isDetailLoading,
    isError: isDetailError,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: ['warehouses', warehouseId],
    queryFn: () => getWarehouse(warehouseId as string),
    enabled: !!warehouseId,
    staleTime: 5 * 60 * 1000,
  })

  const invalidateList = () => queryClient.invalidateQueries({ queryKey: ['warehouses'] })
  const invalidateDetail = () => {
    if (warehouseId) queryClient.invalidateQueries({ queryKey: ['warehouses', warehouseId] })
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  const handleSelect = useCallback((next: Selection | null) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (!next) {
        params.delete('id')
        params.delete('zone')
        params.delete('bin')
        return params
      }
      params.set('id', next.warehouseId)
      if (next.zoneId) params.set('zone', next.zoneId); else params.delete('zone')
      if (next.binId) params.set('bin', next.binId); else params.delete('bin')
      return params
    })
  }, [setSearchParams])

  // ── Warehouse mutations ──────────────────────────────────────────────────
  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: (payload: WarehouseFormValues) =>
      createWarehouse({ name: payload.name, type: payload.type }),
    onSuccess: () => { invalidateList(); setFormOpen(false); toast.success('Bodega creada correctamente') },
    onError:   () => toast.error('Error al crear la bodega'),
  })

  const { mutate: update, isPending: isUpdating } = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: WarehouseFormValues }) =>
      updateWarehouse(id, { name: payload.name, type: payload.type, active: payload.active }),
    onSuccess: () => { invalidateList(); invalidateDetail(); setEditing(null); toast.success('Bodega actualizada correctamente') },
    onError:   () => toast.error('Error al actualizar la bodega'),
  })

  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => deleteWarehouse(id),
    onSuccess: () => { invalidateList(); setDeleting(null); toast.success('Bodega desactivada correctamente') },
    onError:   () => toast.error('Error al desactivar la bodega'),
  })

  // ── Zone mutations ───────────────────────────────────────────────────────
  const { mutate: createZoneMutate, isPending: isCreatingZone } = useMutation({
    mutationFn: ({ warehouseId, payload }: { warehouseId: string; payload: ZoneFormValues }) =>
      createZone(warehouseId, { name: payload.name }),
    onSuccess: () => { invalidateDetail(); invalidateList(); setZoneModal(null); toast.success('Zona creada correctamente') },
    onError:   () => toast.error('Error al crear la zona'),
  })

  const { mutate: updateZoneMutate, isPending: isUpdatingZone } = useMutation({
    mutationFn: ({ warehouseId, zoneId, payload }: { warehouseId: string; zoneId: string; payload: ZoneFormValues }) =>
      updateZone(warehouseId, zoneId, payload),
    onSuccess: () => { invalidateDetail(); setZoneModal(null); toast.success('Zona actualizada correctamente') },
    onError:   () => toast.error('Error al actualizar la zona'),
  })

  // ── Bin mutations ────────────────────────────────────────────────────────
  const { mutate: createBinMutate, isPending: isCreatingBin } = useMutation({
    mutationFn: ({ warehouseId, zoneId, payload }: { warehouseId: string; zoneId: string; payload: BinFormValues }) =>
      createBin(warehouseId, zoneId, { code: payload.code }),
    onSuccess: () => { invalidateDetail(); setBinModal(null); toast.success('Bolsa creada correctamente') },
    onError:   () => toast.error('Error al crear la bolsa'),
  })

  const { mutate: updateBinMutate, isPending: isUpdatingBin } = useMutation({
    mutationFn: ({ warehouseId, zoneId, binId, payload }: { warehouseId: string; zoneId: string; binId: string; payload: BinFormValues }) =>
      updateBin(warehouseId, zoneId, binId, payload),
    onSuccess: () => { invalidateDetail(); setBinModal(null); toast.success('Bolsa actualizada correctamente') },
    onError:   () => toast.error('Error al actualizar la bolsa'),
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl text-content">Bodegas</h1>
          <p className="text-sm text-content-muted font-accent mt-0.5">
            {isLoading ? '...' : `${items.length} ${items.length === 1 ? 'ubicación' : 'ubicaciones'}`}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl gradient-action hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            Nueva bodega
          </button>
        )}
      </div>

      {/* Detalle o estado vacío */}
      <DetailPanel
        selection={selection}
        warehouseDetail={warehouseDetail}
        isLoading={isDetailLoading}
        isError={isDetailError}
        onRetry={() => refetchDetail()}
        canManage={canManage}
        onSelect={handleSelect}
        onEditWarehouse={() => setEditing(items.find(w => w.id === warehouseId) ?? null)}
        onDeleteWarehouse={() => setDeleting(items.find(w => w.id === warehouseId) ?? null)}
        onAddZone={() => warehouseId && setZoneModal({ mode: 'create', warehouseId })}
        onEditZone={(zone) => setZoneModal({ mode: 'edit', warehouseId: zone.warehouseId, zone })}
        onAddBin={(zone) => setBinModal({ mode: 'create', zone })}
        onEditBin={(bin, zone) => setBinModal({ mode: 'edit', zone, bin })}
      />

      {/* Warehouse modals */}
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

      {/* Zone modal */}
      <ZoneForm
        open={!!zoneModal}
        onClose={() => setZoneModal(null)}
        isPending={zoneModal?.mode === 'edit' ? isUpdatingZone : isCreatingZone}
        defaultValues={zoneModal?.mode === 'edit' ? zoneModal.zone : undefined}
        onSubmit={(data) => {
          if (!zoneModal) return
          if (zoneModal.mode === 'edit') {
            updateZoneMutate({ warehouseId: zoneModal.warehouseId, zoneId: zoneModal.zone.id, payload: data })
          } else {
            createZoneMutate({ warehouseId: zoneModal.warehouseId, payload: data })
          }
        }}
      />

      {/* Bin modal */}
      <BinForm
        open={!!binModal}
        onClose={() => setBinModal(null)}
        isPending={binModal?.mode === 'edit' ? isUpdatingBin : isCreatingBin}
        zone={binModal?.zone}
        defaultValues={binModal?.mode === 'edit' ? binModal.bin : undefined}
        onSubmit={(data) => {
          if (!binModal) return
          if (binModal.mode === 'edit') {
            updateBinMutate({
              warehouseId: binModal.zone.warehouseId,
              zoneId: binModal.zone.id,
              binId: binModal.bin.id,
              payload: data,
            })
          } else {
            createBinMutate({
              warehouseId: binModal.zone.warehouseId,
              zoneId: binModal.zone.id,
              payload: data,
            })
          }
        }}
      />
    </div>
  )
}
