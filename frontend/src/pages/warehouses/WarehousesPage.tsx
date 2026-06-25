import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Warehouse, Store, Plus, Pencil, Trash2, Package,
  FolderOpen, MoreHorizontal, ChevronRight, ChevronDown,
} from 'lucide-react'
import { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from '@/services/warehouses.service'
import { usePermission } from '@/hooks/usePermission'
import { WarehouseForm } from './components/WarehouseForm'
import type { WarehouseFormValues } from './components/WarehouseForm'
import { DeleteWarehouseDialog } from './components/DeleteWarehouseDialog'
import { DetailPanel } from './components/DetailPanel'
import { cn } from '@/lib/utils'
import type { Warehouse as WarehouseType, Zone, Bin } from '@/types'
import type { Selection } from './warehouse-tree.types'

// ─── KebabMenu ────────────────────────────────────────────────────────────────
function KebabMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'p-1 rounded-md transition-colors',
          open ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/70 hover:bg-white/10',
        )}
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-brand-surface border border-white/10 rounded-xl shadow-2xl py-1 min-w-[120px]">
          <button
            onClick={() => { onEdit(); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Pencil className="w-3 h-3 shrink-0" />
            Editar
          </button>
          <button
            onClick={() => { onDelete(); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-3 h-3 shrink-0" />
            Eliminar
          </button>
        </div>
      )}
    </div>
  )
}

// ─── BinTreeItem ──────────────────────────────────────────────────────────────
interface BinTreeItemProps {
  bin: Bin
  isSelected: boolean
  onSelect: () => void
  onEdit: (bin: Bin) => void
  onDelete: (bin: Bin) => void
}
function BinTreeItem({ bin, isSelected, onSelect, onEdit, onDelete }: BinTreeItemProps) {
  return (
    <div
      role="button"
      onClick={onSelect}
      className={cn(
        'group flex items-center gap-2 pl-10 pr-2 py-1.5 rounded-lg cursor-pointer transition-colors',
        isSelected
          ? 'bg-brand-secondary/20 text-white'
          : 'text-white/50 hover:bg-white/5 hover:text-white/80',
      )}
    >
      <div className={cn(
        'w-4 h-4 rounded flex items-center justify-center shrink-0',
        isSelected ? 'bg-brand-secondary/30' : 'bg-white/5',
      )}>
        <Package className="w-2.5 h-2.5" />
      </div>
      <span className="flex-1 text-xs truncate">{bin.name}</span>
      <KebabMenu onEdit={() => onEdit(bin)} onDelete={() => onDelete(bin)} />
    </div>
  )
}

// ─── ZoneTreeItem ─────────────────────────────────────────────────────────────
interface ZoneTreeItemProps {
  zone: Zone
  isExpanded: boolean
  isSelected: boolean
  selectedBinId: string | undefined
  onToggle: () => void
  onSelect: () => void
  onEdit: (zone: Zone) => void
  onDelete: (zone: Zone) => void
  onAddBin: (zone: Zone) => void
  onSelectBin: (bin: Bin) => void
  onEditBin: (bin: Bin) => void
  onDeleteBin: (bin: Bin) => void
}
function ZoneTreeItem({
  zone, isExpanded, isSelected, selectedBinId,
  onToggle, onSelect, onEdit, onDelete,
  onAddBin, onSelectBin, onEditBin, onDeleteBin,
}: ZoneTreeItemProps) {
  return (
    <div>
      <div
        role="button"
        onClick={onSelect}
        className={cn(
          'group flex items-center gap-2 pl-5 pr-2 py-1.5 rounded-lg cursor-pointer transition-colors',
          isSelected
            ? 'bg-brand-secondary/15 text-white'
            : 'text-white/60 hover:bg-white/5 hover:text-white/90',
        )}
      >
        <button
          onClick={e => { e.stopPropagation(); onToggle() }}
          className="w-4 h-4 flex items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
        >
          {zone.bins.length > 0
            ? <ChevronRight className={cn('w-3.5 h-3.5 transition-transform duration-150', isExpanded && 'rotate-90')} />
            : <span className="w-3.5 h-3.5" />
          }
        </button>

        <div className={cn(
          'w-4 h-4 rounded flex items-center justify-center shrink-0',
          isSelected ? 'bg-brand-secondary/20' : 'bg-white/5',
        )}>
          <FolderOpen className="w-2.5 h-2.5" />
        </div>

        <span className="flex-1 text-xs truncate">{zone.name}</span>

        {zone.bins.length > 0 && (
          <span className="text-[10px] text-white/25 font-accent shrink-0">{zone.bins.length}</span>
        )}

        <div className="flex items-center gap-0.5">
          <button
            onClick={e => { e.stopPropagation(); onAddBin(zone) }}
            className="p-1 rounded text-white/30 hover:text-brand-secondary hover:bg-brand-secondary/10 transition-colors"
            title="Agregar bolsa"
          >
            <Plus className="w-2.5 h-2.5" />
          </button>
          <KebabMenu onEdit={() => onEdit(zone)} onDelete={() => onDelete(zone)} />
        </div>
      </div>

      {zone.bins.length > 0 && (
        <div
          className="overflow-hidden transition-all ease-in-out"
          style={{ maxHeight: isExpanded ? '400px' : '0px', transitionDuration: '180ms' }}
        >
          <div className="ml-3 mt-0.5 border-l border-white/10 pl-2 space-y-0.5 pb-0.5">
            {zone.bins.map(bin => (
              <BinTreeItem
                key={bin.id}
                bin={bin}
                isSelected={selectedBinId === bin.id}
                onSelect={() => onSelectBin(bin)}
                onEdit={onEditBin}
                onDelete={onDeleteBin}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── WarehouseTreeItem ────────────────────────────────────────────────────────
interface WarehouseTreeItemProps {
  warehouse: WarehouseType
  zones: Zone[]
  isExpanded: boolean
  selection: Selection | null
  onToggle: () => void
  onSelectWarehouse: () => void
  onEdit: (w: WarehouseType) => void
  onDelete: (w: WarehouseType) => void
  onAddZone: (warehouseId: string) => void
  onSelectZone: (zone: Zone) => void
  onEditZone: (zone: Zone) => void
  onDeleteZone: (zone: Zone) => void
  onAddBin: (zone: Zone) => void
  onSelectBin: (bin: Bin) => void
  onEditBin: (bin: Bin) => void
  onDeleteBin: (bin: Bin) => void
}
function WarehouseTreeItem({
  warehouse, zones, isExpanded, selection,
  onToggle, onSelectWarehouse, onEdit, onDelete, onAddZone,
  onSelectZone, onEditZone, onDeleteZone,
  onAddBin, onSelectBin, onEditBin, onDeleteBin,
}: WarehouseTreeItemProps) {
  const isWarehouseSelected = selection?.kind === 'warehouse' && selection.warehouseId === warehouse.id
  const TypeIcon = warehouse.type === 'store' ? Store : Warehouse

  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set())
  const toggleZone = useCallback((zoneId: string) => {
    setExpandedZones(prev => {
      const next = new Set(prev)
      next.has(zoneId) ? next.delete(zoneId) : next.add(zoneId)
      return next
    })
  }, [])

  return (
    <div>
      <div
        role="button"
        onClick={onSelectWarehouse}
        className={cn(
          'group flex items-center gap-2 px-2 py-2 rounded-xl cursor-pointer transition-colors',
          isWarehouseSelected
            ? 'bg-brand-secondary/20 text-white'
            : 'text-white/70 hover:bg-white/5 hover:text-white',
        )}
      >
        <button
          onClick={e => { e.stopPropagation(); onToggle() }}
          className="w-5 h-5 flex items-center justify-center transition-colors shrink-0 text-white/60 hover:text-white"
        >
          <ChevronDown className={cn(
            'w-4 h-4 transition-transform duration-250',
            isExpanded ? 'rotate-0' : '-rotate-90',
          )} />
        </button>

        <div className={cn(
          'w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors',
          isWarehouseSelected ? 'bg-brand-secondary/25' : 'gradient-dark',
        )}>
          <TypeIcon className="w-3 h-3 text-white/70" />
        </div>

        <span className="flex-1 text-sm font-medium truncate">{warehouse.name}</span>

        {warehouse._count.zones > 0 && (
          <span className={cn(
            'text-[10px] font-accent shrink-0 transition-colors',
            isWarehouseSelected ? 'text-white/50' : 'text-white/25',
          )}>
            {warehouse._count.zones}z
          </span>
        )}

        <div className="flex items-center gap-0.5">
          <button
            onClick={e => { e.stopPropagation(); onAddZone(warehouse.id) }}
            className="p-1 rounded text-white/30 hover:text-brand-secondary hover:bg-brand-secondary/10 transition-colors"
            title="Agregar zona"
          >
            <Plus className="w-3 h-3" />
          </button>
          <KebabMenu onEdit={() => onEdit(warehouse)} onDelete={() => onDelete(warehouse)} />
        </div>
      </div>

      <div
        className="overflow-hidden transition-all ease-in-out"
        style={{ maxHeight: isExpanded ? '600px' : '0px', transitionDuration: '220ms' }}
      >
        <div className="ml-3 mt-1 mb-1 border-l border-white/10 pl-2 space-y-0.5">
          {zones.length === 0 ? (
            <div className="py-2 px-2 flex items-center gap-2">
              <FolderOpen className="w-3 h-3 text-white/30 shrink-0" />
              <p className="text-xs text-white/50 font-accent">Sin zonas</p>
            </div>
          ) : (
            zones.map(zone => (
              <ZoneTreeItem
                key={zone.id}
                zone={zone}
                isExpanded={expandedZones.has(zone.id)}
                isSelected={selection?.kind === 'zone' && selection.zoneId === zone.id}
                selectedBinId={selection?.kind === 'bin' ? selection.binId : undefined}
                onToggle={() => toggleZone(zone.id)}
                onSelect={() => onSelectZone(zone)}
                onEdit={onEditZone}
                onDelete={onDeleteZone}
                onAddBin={onAddBin}
                onSelectBin={onSelectBin}
                onEditBin={onEditBin}
                onDeleteBin={onDeleteBin}
              />
            ))
          )}
          <button
            onClick={() => onAddZone(warehouse.id)}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] text-white/40 hover:text-brand-secondary hover:bg-brand-secondary/5 rounded-lg transition-colors"
          >
            <Plus className="w-2.5 h-2.5" />
            Nueva zona
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function WarehousesPage() {
  const [searchParams] = useSearchParams()
  const queryClient   = useQueryClient()
  const canManage     = usePermission('warehouse.manage')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing]   = useState<WarehouseType | null>(null)
  const [deleting, setDeleting] = useState<WarehouseType | null>(null)

  // Zone / bin modal stubs — conectar en TASK 8
  const [addingZoneTo, setAddingZoneTo] = useState<string | null>(null)
  const [editingZone, setEditingZone]   = useState<Zone | null>(null)
  const [deletingZone, setDeletingZone] = useState<Zone | null>(null)
  const [addingBinTo, setAddingBinTo]   = useState<Zone | null>(null)
  const [editingBin, setEditingBin]     = useState<Bin | null>(null)
  const [deletingBin, setDeletingBin]   = useState<Bin | null>(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
    staleTime: 5 * 60 * 1000,
  })

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

  const warehouseId = searchParams.get('id')
  const selection: Selection | null = warehouseId
    ? { kind: 'warehouse', warehouseId }
    : null

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
      <DetailPanel selection={selection} warehouses={items} />

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
      {false && JSON.stringify({ addingZoneTo, editingZone, deletingZone, addingBinTo, editingBin, deletingBin })}
    </div>
  )
}
