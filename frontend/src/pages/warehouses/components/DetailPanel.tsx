import {
  Warehouse, Store, Plus, Package,
  FolderOpen, ChevronRight, Boxes,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState, ErrorState } from '@/components/shared'
import { KebabMenu } from './KebabMenu'
import type { WarehouseDetail, Zone, Bin } from '@/types'
import type { Selection } from '@/pages/warehouses/warehouse-tree.types'

// ─── Skeleton ───────────────────────────────────────────────────────────────
function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-surface-hover shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-6 w-48 rounded bg-surface-hover" />
          <div className="h-4 w-64 rounded bg-surface-hover" />
        </div>
      </div>
      <div className="h-20 rounded-2xl bg-surface-hover" />
      <div className="h-56 rounded-2xl bg-surface-hover" />
    </div>
  )
}

// ─── ZoneSummaryCard ────────────────────────────────────────────────────────
function ZoneSummaryCard({
  zone, canManage, onSelect, onEdit, onAddBin,
}: {
  zone: Zone
  canManage: boolean
  onSelect: () => void
  onEdit: () => void
  onAddBin: () => void
}) {
  return (
    <div
      role="button"
      onClick={onSelect}
      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-ui-border bg-surface-raised hover:bg-surface-hover hover:border-brand-secondary/30 transition-all cursor-pointer group"
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 gradient-dark">
        <FolderOpen className="w-4 h-4 text-white/70" />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm text-content truncate">{zone.name}</p>
          {!zone.active && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-hover text-content-muted shrink-0">
              Inactiva
            </span>
          )}
        </div>
        <p className="text-xs text-content-faint font-accent">
          {zone.bins.length === 0 ? 'Sin bolsas' : `${zone.bins.length} ${zone.bins.length === 1 ? 'bolsa' : 'bolsas'}`}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-content-faint shrink-0" />
      {canManage && (
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onAddBin}
            title="Agregar bolsa"
            className="p-1.5 rounded-lg text-content-faint hover:text-brand-secondary hover:bg-brand-secondary/10 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <KebabMenu onEdit={onEdit} deleteDisabled />
        </div>
      )}
    </div>
  )
}

// ─── BinCard ────────────────────────────────────────────────────────────────
function BinCard({
  bin, canManage, onSelect, onEdit,
}: {
  bin: Bin
  canManage: boolean
  onSelect: () => void
  onEdit: () => void
}) {
  return (
    <div
      role="button"
      onClick={onSelect}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-ui-border bg-surface-raised hover:bg-surface-hover hover:border-brand-secondary/30 transition-all group cursor-pointer"
    >
      <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-brand-secondary/10 shrink-0">
        <Package className="w-3.5 h-3.5 text-brand-secondary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-content truncate">Bolsa {bin.code}</p>
        <p className={cn(
          'text-[10px] font-accent',
          bin.active ? 'text-brand-secondary' : 'text-content-muted',
        )}>
          {bin.active ? 'Activa' : 'Inactiva'}
        </p>
      </div>
      {canManage && (
        <div onClick={(e) => e.stopPropagation()}>
          <KebabMenu onEdit={onEdit} deleteDisabled />
        </div>
      )}
    </div>
  )
}

// ─── Props ──────────────────────────────────────────────────────────────────
interface DetailPanelProps {
  selection: Selection | null
  warehouseDetail?: WarehouseDetail
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  canManage: boolean
  onSelect: (next: Selection | null) => void
  onEditWarehouse: () => void
  onDeleteWarehouse: () => void
  onAddZone: () => void
  onEditZone: (zone: Zone) => void
  onAddBin: (zone: Zone) => void
  onEditBin: (bin: Bin, zone: Zone) => void
}

// ─── Component ──────────────────────────────────────────────────────────────
export function DetailPanel({
  selection, warehouseDetail, isLoading, isError, onRetry, canManage,
  onSelect, onEditWarehouse, onDeleteWarehouse, onAddZone, onEditZone, onAddBin, onEditBin,
}: DetailPanelProps) {
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

  if (isError) {
    return <ErrorState message="Error al cargar la bodega" onRetry={onRetry} />
  }

  if (isLoading || !warehouseDetail) {
    return <DetailSkeleton />
  }

  const wh = warehouseDetail

  if (selection.kind === 'warehouse') {
    const TypeIcon = wh.type === 'store' ? Store : Warehouse
    const totalBins = wh.zones.reduce((acc, z) => acc + z.bins.length, 0)
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
          {canManage && (
            <KebabMenu onEdit={onEditWarehouse} onDelete={onDeleteWarehouse} />
          )}
        </div>

        {/* Stats strip */}
        <div className="bg-surface rounded-2xl border border-ui-border overflow-hidden">
          <div className="flex divide-x divide-ui-divide">
            {[
              { label: 'Zonas',  value: wh.zones.length, Icon: FolderOpen, isText: false },
              { label: 'Bolsas', value: totalBins, Icon: Package, isText: false },
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
                {wh.zones.length === 0
                  ? 'Sin zonas registradas'
                  : `${wh.zones.length} zonas · ${totalBins} bolsas en total`}
              </p>
            </div>
            {canManage && (
              <button
                onClick={onAddZone}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white rounded-xl transition-all hover:opacity-90 active:scale-[0.98] gradient-action"
              >
                <Plus className="w-3.5 h-3.5" />
                Nueva zona
              </button>
            )}
          </div>
          <div className="p-4 space-y-3">
            {wh.zones.length === 0 ? (
              <EmptyState
                icon={FolderOpen}
                title="Sin zonas en esta bodega"
                description="Crea la primera zona para empezar a organizar el almacenamiento"
              />
            ) : (
              wh.zones.map(zone => (
                <ZoneSummaryCard
                  key={zone.id}
                  zone={zone}
                  canManage={canManage}
                  onSelect={() => onSelect({ kind: 'zone', warehouseId: wh.id, zoneId: zone.id })}
                  onEdit={() => onEditZone(zone)}
                  onAddBin={() => onAddBin(zone)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    )
  }

  if (selection.kind === 'zone') {
    const zone = wh.zones.find(z => z.id === selection.zoneId)
    if (!zone) {
      return (
        <EmptyState
          icon={FolderOpen}
          title="Zona no encontrada"
          description="Es posible que haya sido eliminada o que el enlace sea incorrecto"
        />
      )
    }

    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-content-faint font-accent">
          <button
            onClick={() => onSelect({ kind: 'warehouse', warehouseId: wh.id })}
            className="hover:text-content-secondary transition-colors"
          >
            {wh.name}
          </button>
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
          {canManage && (
            <KebabMenu onEdit={() => onEditZone(zone)} deleteDisabled />
          )}
        </div>

        {/* Bins grid */}
        <div className="bg-surface rounded-2xl border border-ui-border overflow-hidden">
          <div className="px-5 py-4 border-b border-ui-border flex items-center justify-between">
            <p className="text-sm font-medium text-content">Bolsas</p>
            {canManage && (
              <button
                onClick={() => onAddBin(zone)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white rounded-xl transition-all hover:opacity-90 active:scale-[0.98] gradient-action"
              >
                <Plus className="w-3.5 h-3.5" />
                Nueva bolsa
              </button>
            )}
          </div>
          <div className="p-4">
            {zone.bins.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Sin bolsas en esta zona"
                description="Crea la primera bolsa para asignar ubicaciones de stock"
              />
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {zone.bins.map(bin => (
                  <BinCard
                    key={bin.id}
                    bin={bin}
                    canManage={canManage}
                    onSelect={() => onSelect({ kind: 'bin', warehouseId: wh.id, zoneId: zone.id, binId: bin.id })}
                    onEdit={() => onEditBin(bin, zone)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (selection.kind === 'bin') {
    const zone = wh.zones.find(z => z.id === selection.zoneId)
    const bin  = zone?.bins.find(b => b.id === selection.binId)

    if (!zone || !bin) {
      return (
        <EmptyState
          icon={Package}
          title="Bolsa no encontrada"
          description="Es posible que haya sido eliminada o que el enlace sea incorrecto"
        />
      )
    }

    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-content-faint font-accent">
          <button
            onClick={() => onSelect({ kind: 'warehouse', warehouseId: wh.id })}
            className="hover:text-content-secondary transition-colors"
          >
            {wh.name}
          </button>
          <ChevronRight className="w-3 h-3" />
          <button
            onClick={() => onSelect({ kind: 'zone', warehouseId: wh.id, zoneId: zone.id })}
            className="hover:text-content-secondary transition-colors"
          >
            {zone.name}
          </button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-content-secondary">Bolsa {bin.code}</span>
        </div>

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-secondary/10 flex items-center justify-center shrink-0">
            <Package className="w-6 h-6 text-brand-secondary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl text-content">Bolsa {bin.code}</h1>
            <p className="text-content-muted text-sm mt-0.5 font-accent">
              Bolsa de almacenamiento — {zone.name}
            </p>
          </div>
          {canManage && (
            <KebabMenu onEdit={() => onEditBin(bin, zone)} deleteDisabled />
          )}
        </div>

        {/* Info card */}
        <div className="bg-surface rounded-2xl border border-ui-border overflow-hidden">
          <div className="px-5 py-4 border-b border-ui-border">
            <p className="text-sm font-medium text-content">Información</p>
          </div>
          <div className="divide-y divide-ui-divide">
            {[
              { label: 'Número', value: String(bin.code) },
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
