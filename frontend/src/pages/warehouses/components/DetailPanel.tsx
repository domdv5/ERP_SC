import { useState } from 'react'
import {
  Warehouse, Store, Plus, Package,
  FolderOpen, ChevronRight, ChevronDown, Boxes,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Warehouse as WarehouseType, Zone, Bin } from '@/types'
import type { Selection } from '../warehouse-tree.types'

// Placeholder — reemplazar con useQuery en TASK 8
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

interface DetailPanelProps {
  selection: Selection | null
  warehouses: WarehouseType[]
}

export function DetailPanel({ selection, warehouses }: DetailPanelProps) {
  if (!selection) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8 py-20">
        <div className="w-16 h-16 rounded-2xl gradient-dark flex items-center justify-center">
          <Boxes className="w-8 h-8 text-white/30" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-content">Selecciona una ubicación</p>
          <p className="text-xs text-content-muted font-accent max-w-xs">
            Elige una bodega en el menú lateral para ver su detalle
          </p>
        </div>
      </div>
    )
  }

  if (selection.kind === 'warehouse') {
    const wh = warehouses.find(w => w.id === selection.warehouseId)
    if (!wh) return null
    const tree = PLACEHOLDER_TREE[wh.id] ?? { zones: [] }
    const TypeIcon = wh.type === 'store' ? Store : Warehouse
    const totalBins = tree.zones.reduce((acc, z) => acc + z.bins.length, 0)
    const typeBadge = wh.type === 'store'
      ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
      : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
    const typeLabel = wh.type === 'store' ? 'Almacén' : 'Bodega'

    return (
      <div className="space-y-6">
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
              { label: 'Zonas',  value: tree.zones.length, Icon: FolderOpen },
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
                {tree.zones.length === 0
                  ? 'Sin zonas registradas'
                  : `${tree.zones.length} zonas · ${totalBins} bolsas en total`}
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
              tree.zones.map(zone => <ZoneSummaryCard key={zone.id} zone={zone} />)
            )}
          </div>
        </div>
      </div>
    )
  }

  if (selection.kind === 'zone') {
    const wh   = warehouses.find(w => w.id === selection.warehouseId)
    const tree = PLACEHOLDER_TREE[selection.warehouseId] ?? { zones: [] }
    const zone = tree.zones.find(z => z.id === selection.zoneId)
    if (!zone || !wh) return null

    return (
      <div className="space-y-6">
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
                {zone.bins.map(bin => <BinCard key={bin.id} bin={bin} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (selection.kind === 'bin') {
    const wh   = warehouses.find(w => w.id === selection.warehouseId)
    const tree = PLACEHOLDER_TREE[selection.warehouseId] ?? { zones: [] }
    const zone = tree.zones.find(z => z.id === selection.zoneId)
    const bin  = zone?.bins.find(b => b.id === selection.binId)
    if (!bin || !zone || !wh) return null

    return (
      <div className="space-y-6">
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
              { label: 'Nombre', value: bin.name },
              { label: 'Zona',   value: zone.name },
              { label: 'Bodega', value: wh.name },
              { label: 'Estado', value: bin.active ? 'Activa' : 'Inactiva' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between px-5 py-3.5">
                <span className="text-xs text-content-muted font-accent">{row.label}</span>
                <span className="text-sm text-content">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return null
}
