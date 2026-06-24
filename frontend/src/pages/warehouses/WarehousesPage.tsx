import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Warehouse, Store, Plus, Pencil, Trash2, Package,
  FolderOpen, MoreHorizontal, ChevronRight, ChevronDown,
  RefreshCw, Boxes,
} from 'lucide-react'
import { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from '@/services/warehouses.service'
import { usePermission } from '@/hooks/usePermission'
import { WarehouseForm } from './components/WarehouseForm'
import type { WarehouseFormValues } from './components/WarehouseForm'
import { DeleteWarehouseDialog } from './components/DeleteWarehouseDialog'
import { cn } from '@/lib/utils'
import type { Warehouse as WarehouseType, Zone, Bin } from '@/types'

// ─── Placeholder hierarchy data — reemplazar con useQuery en TASK 8 ───────────
const PLACEHOLDER_TREE: Record<string, { zones: Zone[] }> = {
  '1': {
    zones: [
      {
        id: 'z1', warehouseId: '1', name: 'Zona A', active: true, createdAt: '',
        bins: [
          { id: 'b1', zoneId: 'z1', name: 'Bolsa 01', active: true, createdAt: '' },
          { id: 'b2', zoneId: 'z1', name: 'Bolsa 02', active: true, createdAt: '' },
          { id: 'b3', zoneId: 'z1', name: 'Bolsa 03', active: true, createdAt: '' },
        ],
      },
      {
        id: 'z2', warehouseId: '1', name: 'Zona B', active: true, createdAt: '',
        bins: [
          { id: 'b4', zoneId: 'z2', name: 'Bolsa 01', active: true, createdAt: '' },
          { id: 'b5', zoneId: 'z2', name: 'Bolsa 02', active: true, createdAt: '' },
        ],
      },
      {
        id: 'z3', warehouseId: '1', name: 'Zona C', active: true, createdAt: '',
        bins: [],
      },
    ],
  },
  '2': {
    zones: [
      {
        id: 'z4', warehouseId: '2', name: 'Zona Norte', active: true, createdAt: '',
        bins: [
          { id: 'b6', zoneId: 'z4', name: 'Bolsa 01', active: true, createdAt: '' },
        ],
      },
      {
        id: 'z5', warehouseId: '2', name: 'Zona Sur', active: true, createdAt: '',
        bins: [
          { id: 'b7', zoneId: 'z5', name: 'Bolsa 01', active: true, createdAt: '' },
          { id: 'b8', zoneId: 'z5', name: 'Bolsa 02', active: true, createdAt: '' },
          { id: 'b9', zoneId: 'z5', name: 'Bolsa 03', active: true, createdAt: '' },
        ],
      },
    ],
  },
}

// ─── Selection types ──────────────────────────────────────────────────────────
type SelectionKind = 'warehouse' | 'zone' | 'bin'
interface Selection {
  kind: SelectionKind
  warehouseId: string
  zoneId?: string
  binId?: string
}

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
        {/* Expand toggle */}
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

      {/* Bins */}
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

  // Track which zones are expanded locally
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
      {/* Warehouse row */}
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
        {/* Expand toggle */}
        <button
          onClick={e => { e.stopPropagation(); onSelectWarehouse() }}
          className="w-5 h-5 flex items-center justify-center transition-colors shrink-0 text-white/60 hover:text-white"
        >
          <ChevronDown className={cn(
            'w-4 h-4 transition-transform duration-250',
            isExpanded ? 'rotate-0' : '-rotate-90',
          )} />
        </button>

        {/* Icon */}
        <div className={cn(
          'w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors',
          isWarehouseSelected ? 'bg-brand-secondary/25' : 'gradient-dark',
        )}>
          <TypeIcon className="w-3 h-3 text-white/70" />
        </div>

        {/* Name */}
        <span className="flex-1 text-sm font-medium truncate">{warehouse.name}</span>

        {/* Zone count badge */}
        {warehouse._count.zones > 0 && (
          <span className={cn(
            'text-[10px] font-accent shrink-0 transition-colors',
            isWarehouseSelected ? 'text-white/50' : 'text-white/25',
          )}>
            {warehouse._count.zones}z
          </span>
        )}

        {/* Actions */}
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

      {/* Zones — animated with max-height */}
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

// ─── DetailPanel ──────────────────────────────────────────────────────────────
// Panel derecho — muestra el detalle del ítem seleccionado en el árbol

interface DetailPanelProps {
  selection: Selection | null
  warehouses: WarehouseType[]
}

function DetailPanel({ selection, warehouses }: DetailPanelProps) {
  // TODO (TASK 8): cuando selection cambie, hacer useQuery del detail real
  if (!selection) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
        <div className="w-16 h-16 rounded-2xl gradient-dark flex items-center justify-center">
          <Boxes className="w-8 h-8 text-white/30" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-content">Selecciona una ubicación</p>
          <p className="text-xs text-content-muted font-accent max-w-xs">
            Elige una bodega, zona o bolsa en el árbol de la izquierda para ver su detalle
          </p>
        </div>
      </div>
    )
  }

  if (selection.kind === 'warehouse') {
    const wh = warehouses.find(w => w.id === selection.warehouseId)
    if (!wh) return null
    // TODO (TASK 8): reemplazar con WarehouseDetailPage embedded
    const tree = PLACEHOLDER_TREE[wh.id] ?? { zones: [] }
    const TypeIcon = wh.type === 'store' ? Store : Warehouse
    const totalBins = tree.zones.reduce((acc, z) => acc + z.bins.length, 0)
    const typeBadge = wh.type === 'store'
      ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
      : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
    const typeLabel = wh.type === 'store' ? 'Almacén' : 'Bodega'

    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl gradient-dark flex items-center justify-center shrink-0">
            <TypeIcon className="w-6 h-6 text-white/70" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl text-content">{wh.name}</h1>
              <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0', typeBadge)}>
                {typeLabel}
              </span>
              <span className={cn(
                'px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0',
                wh.active
                  ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                  : 'bg-surface-hover text-content-muted',
              )}>
                {wh.active ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            <p className="text-content-muted text-sm mt-0.5 font-accent">
              Zonas y bolsas de almacenamiento
            </p>
          </div>
        </div>

        {/* Stats strip */}
        <div className="bg-surface rounded-2xl border border-ui-border overflow-hidden">
          <div className="flex divide-x divide-ui-divide">
            {[
              { label: 'Zonas', value: tree.zones.length, Icon: FolderOpen },
              { label: 'Bolsas', value: totalBins, Icon: Package },
              { label: 'Estado', value: wh.active ? 'Activa' : 'Inactiva', Icon: TypeIcon, isText: true },
            ].map(stat => (
              <div key={stat.label} className="flex-1 flex items-center gap-3 px-5 py-4">
                <div className="w-9 h-9 rounded-xl bg-brand-secondary/10 flex items-center justify-center shrink-0">
                  <stat.Icon className="w-4 h-4 text-brand-secondary" />
                </div>
                <div>
                  <p className="text-xs text-content-muted font-accent">{stat.label}</p>
                  {stat.isText
                    ? <p className="text-sm font-medium text-content mt-0.5">{stat.value}</p>
                    : <p className="text-2xl leading-tight font-medium text-content">{stat.value}</p>
                  }
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Zones list */}
        <div className="bg-surface rounded-2xl border border-ui-border overflow-hidden">
          <div className="px-5 py-4 border-b border-ui-border flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-content">Zonas</p>
              <p className="text-xs text-content-faint font-accent mt-0.5">
                {tree.zones.length === 0 ? 'Sin zonas registradas' : `${tree.zones.length} zonas · ${totalBins} bolsas en total`}
              </p>
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white rounded-xl transition-all hover:opacity-90 active:scale-[0.98] gradient-action">
              <Plus className="w-3.5 h-3.5" />
              Nueva zona
            </button>
          </div>
          <div className="p-4 space-y-3">
            {tree.zones.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 rounded-2xl gradient-dark flex items-center justify-center mx-auto mb-3">
                  <FolderOpen className="w-6 h-6 text-white/50" />
                </div>
                <p className="text-sm text-content-muted font-accent">Sin zonas en esta bodega</p>
              </div>
            ) : (
              tree.zones.map(zone => (
                <ZoneSummaryCard key={zone.id} zone={zone} />
              ))
            )}
          </div>
        </div>
      </div>
    )
  }

  if (selection.kind === 'zone') {
    const wh = warehouses.find(w => w.id === selection.warehouseId)
    const tree = PLACEHOLDER_TREE[selection.warehouseId] ?? { zones: [] }
    const zone = tree.zones.find(z => z.id === selection.zoneId)
    if (!zone || !wh) return null

    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-content-faint font-accent">
          <span>{wh.name}</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-content-secondary">{zone.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-secondary/10 flex items-center justify-center shrink-0">
            <FolderOpen className="w-6 h-6 text-brand-secondary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl text-content">{zone.name}</h1>
            <p className="text-content-muted text-sm mt-0.5 font-accent">
              {zone.bins.length === 0 ? 'Sin bolsas' : `${zone.bins.length} ${zone.bins.length === 1 ? 'bolsa' : 'bolsas'}`}
            </p>
          </div>
        </div>

        {/* Bins grid */}
        <div className="bg-surface rounded-2xl border border-ui-border overflow-hidden">
          <div className="px-5 py-4 border-b border-ui-border flex items-center justify-between">
            <p className="text-sm font-medium text-content">Bolsas</p>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white rounded-xl transition-all hover:opacity-90 active:scale-[0.98] gradient-action">
              <Plus className="w-3.5 h-3.5" />
              Nueva bolsa
            </button>
          </div>
          <div className="p-4">
            {zone.bins.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 rounded-2xl gradient-dark flex items-center justify-center mx-auto mb-3">
                  <Package className="w-6 h-6 text-white/50" />
                </div>
                <p className="text-sm text-content-muted font-accent">Sin bolsas en esta zona</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {zone.bins.map(bin => (
                  <BinCard key={bin.id} bin={bin} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (selection.kind === 'bin') {
    const wh = warehouses.find(w => w.id === selection.warehouseId)
    const tree = PLACEHOLDER_TREE[selection.warehouseId] ?? { zones: [] }
    const zone = tree.zones.find(z => z.id === selection.zoneId)
    const bin = zone?.bins.find(b => b.id === selection.binId)
    if (!bin || !zone || !wh) return null

    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-content-faint font-accent">
          <span>{wh.name}</span>
          <ChevronRight className="w-3 h-3" />
          <span>{zone.name}</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-content-secondary">{bin.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-secondary/10 flex items-center justify-center shrink-0">
            <Package className="w-6 h-6 text-brand-secondary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl text-content">{bin.name}</h1>
            <p className="text-content-muted text-sm mt-0.5 font-accent">
              Bolsa de almacenamiento — {zone.name}
            </p>
          </div>
        </div>

        {/* Info card */}
        <div className="bg-surface rounded-2xl border border-ui-border overflow-hidden">
          <div className="px-5 py-4 border-b border-ui-border">
            <p className="text-sm font-medium text-content">Información</p>
          </div>
          <div className="divide-y divide-ui-divide">
            {[
              { label: 'Nombre',  value: bin.name },
              { label: 'Zona',    value: zone.name },
              { label: 'Bodega',  value: wh.name },
              { label: 'Estado',  value: bin.active ? 'Activa' : 'Inactiva' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between px-5 py-3.5">
                <span className="text-xs text-content-muted font-accent">{row.label}</span>
                <span className="text-sm text-content">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* TODO (TASK 8): stock snapshot por bin cuando exista el endpoint */}
      </div>
    )
  }

  return null
}

// ─── ZoneSummaryCard — mini-card usada en el detalle de bodega ─────────────────
function ZoneSummaryCard({ zone }: { zone: Zone }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={cn(
      'rounded-xl border transition-colors duration-200 overflow-hidden',
      expanded ? 'border-brand-secondary/30' : 'border-ui-border',
    )}>
      <button
        onClick={() => setExpanded(v => !v)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors',
          expanded ? 'bg-brand-secondary/5 dark:bg-brand-secondary/10' : 'bg-surface-raised hover:bg-surface-hover',
        )}
      >
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
          expanded ? 'bg-brand-secondary/15 dark:bg-brand-secondary/20' : 'gradient-dark',
        )}>
          <FolderOpen className={cn('w-4 h-4 transition-colors', expanded ? 'text-brand-secondary' : 'text-white/60')} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="font-medium text-sm text-content">{zone.name}</p>
          <p className="text-xs text-content-faint font-accent">
            {zone.bins.length === 0 ? 'Sin bolsas' : `${zone.bins.length} ${zone.bins.length === 1 ? 'bolsa' : 'bolsas'}`}
          </p>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-content-faint transition-transform', expanded ? 'rotate-0' : '-rotate-90')} />
      </button>
      {expanded && zone.bins.length > 0 && (
        <div className="border-t border-ui-divide px-3 py-2 bg-surface space-y-0.5">
          {zone.bins.map(bin => (
            <div key={bin.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-surface-hover transition-colors">
              <div className="w-6 h-6 rounded-md flex items-center justify-center bg-brand-secondary/10 shrink-0">
                <Package className="w-3 h-3 text-brand-secondary" />
              </div>
              <span className="flex-1 text-sm text-content-secondary">{bin.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── BinCard — mini tarjeta en grid de zona ───────────────────────────────────
function BinCard({ bin }: { bin: Bin }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-ui-border bg-surface-raised hover:bg-surface-hover hover:border-brand-secondary/30 transition-all group cursor-pointer">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-brand-secondary/10 shrink-0">
        <Package className="w-3.5 h-3.5 text-brand-secondary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-content truncate">{bin.name}</p>
        <p className={cn(
          'text-[10px] font-accent',
          bin.active ? 'text-brand-secondary' : 'text-content-muted',
        )}>
          {bin.active ? 'Activa' : 'Inactiva'}
        </p>
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

  // Selección basada en ?id= de la URL
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
