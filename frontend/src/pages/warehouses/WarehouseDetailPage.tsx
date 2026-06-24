import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Pencil, Trash2,
  ChevronDown, Package, FolderOpen, Warehouse, Store, MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WarehouseDetail, Zone, Bin } from '@/types'

// ─── Placeholder data — reemplazar con useQuery (TASK 8) ─────────────────────
const PLACEHOLDER_WAREHOUSE: WarehouseDetail = {
  id: '1',
  name: 'Bodega Principal',
  type: 'warehouse',
  active: true,
  createdAt: new Date().toISOString(),
  zones: [
    {
      id: 'z1', warehouseId: '1', name: 'Zona A', active: true, createdAt: new Date().toISOString(),
      bins: [
        { id: 'b1', zoneId: 'z1', name: 'Bolsa 01', active: true, createdAt: new Date().toISOString() },
        { id: 'b2', zoneId: 'z1', name: 'Bolsa 02', active: true, createdAt: new Date().toISOString() },
        { id: 'b3', zoneId: 'z1', name: 'Bolsa 03', active: true, createdAt: new Date().toISOString() },
      ],
    },
    {
      id: 'z2', warehouseId: '1', name: 'Zona B', active: true, createdAt: new Date().toISOString(),
      bins: [
        { id: 'b4', zoneId: 'z2', name: 'Bolsa 01', active: true, createdAt: new Date().toISOString() },
      ],
    },
    {
      id: 'z3', warehouseId: '1', name: 'Zona C', active: true, createdAt: new Date().toISOString(),
      bins: [],
    },
  ],
}
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  store:     { label: 'Almacén', Icon: Store,     badgeClass: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
  warehouse: { label: 'Bodega',  Icon: Warehouse, badgeClass: 'bg-blue-100  text-blue-700  dark:bg-blue-500/20  dark:text-blue-400'  },
} as const

// ─── KebabMenu ───────────────────────────────────────────────────────────────
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
          'p-1.5 rounded-lg transition-colors',
          open
            ? 'bg-surface-hover text-content'
            : 'text-content-faint hover:text-content hover:bg-surface-hover',
        )}
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-surface border border-ui-border rounded-xl shadow-lg py-1 min-w-[130px]">
          <button
            onClick={() => { onEdit(); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-content-secondary hover:bg-surface-hover transition-colors"
          >
            <Pencil className="w-3 h-3 shrink-0" />
            Editar
          </button>
          <button
            onClick={() => { onDelete(); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-3 h-3 shrink-0" />
            Eliminar
          </button>
        </div>
      )}
    </div>
  )
}

// ─── BinRow ───────────────────────────────────────────────────────────────────
function BinRow({ bin, onEdit, onDelete }: {
  bin: Bin
  onEdit: (bin: Bin) => void
  onDelete: (bin: Bin) => void
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-hover transition-colors">
      <div className="w-6 h-6 rounded-md flex items-center justify-center bg-brand-secondary/10 shrink-0">
        <Package className="w-3 h-3 text-brand-secondary" />
      </div>
      <span className="flex-1 text-sm text-content-secondary">{bin.name}</span>
      <KebabMenu onEdit={() => onEdit(bin)} onDelete={() => onDelete(bin)} />
    </div>
  )
}

// ─── ZoneRow ──────────────────────────────────────────────────────────────────
function ZoneRow({ zone, onEditZone, onDeleteZone, onAddBin, onEditBin, onDeleteBin }: {
  zone: Zone
  onEditZone: (zone: Zone) => void
  onDeleteZone: (zone: Zone) => void
  onAddBin: (zone: Zone) => void
  onEditBin: (bin: Bin) => void
  onDeleteBin: (bin: Bin) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={cn(
      'rounded-xl border transition-colors duration-200 overflow-hidden',
      expanded ? 'border-brand-secondary/30' : 'border-ui-border',
    )}>
      {/* Zone header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors',
          expanded
            ? 'bg-brand-secondary/5 dark:bg-brand-secondary/10'
            : 'bg-surface-raised hover:bg-surface-hover',
        )}
      >
        {/* Icon — green when open, dark when closed */}
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-200',
          expanded ? 'bg-brand-secondary/15 dark:bg-brand-secondary/20' : 'gradient-dark',
        )}>
          <FolderOpen className={cn(
            'w-4 h-4 transition-colors duration-200',
            expanded ? 'text-brand-secondary' : 'text-white/60',
          )} />
        </div>

        {/* Name + bin count */}
        <div className="flex-1 min-w-0 text-left">
          <p className="font-medium text-sm text-content">{zone.name}</p>
          <p className="text-xs text-content-faint font-accent">
            {zone.bins.length === 0
              ? 'Sin bolsas'
              : `${zone.bins.length} ${zone.bins.length === 1 ? 'bolsa' : 'bolsas'}`}
          </p>
        </div>

        {/* Kebab menu */}
        <KebabMenu onEdit={() => onEditZone(zone)} onDelete={() => onDeleteZone(zone)} />

        {/* Chevron */}
        <ChevronDown className={cn(
          'w-4 h-4 text-content-faint transition-transform duration-200 shrink-0',
          expanded ? 'rotate-0' : '-rotate-90',
        )} />
      </button>

      {/* Bins list */}
      {expanded && (
        <div className="border-t border-ui-divide bg-surface">
          {zone.bins.length === 0 ? (
            <div className="py-8 flex flex-col items-center gap-2">
              <Package className="w-7 h-7 text-content-faint" />
              <p className="text-sm text-content-muted font-accent">
                Esta zona no tiene bolsas todavía
              </p>
            </div>
          ) : (
            <div className="px-3 py-2 space-y-0.5">
              {zone.bins.map(bin => (
                <BinRow
                  key={bin.id}
                  bin={bin}
                  onEdit={onEditBin}
                  onDelete={onDeleteBin}
                />
              ))}
            </div>
          )}

          <div className="px-4 py-3 border-t border-ui-divide">
            <button
              onClick={() => onAddBin(zone)}
              className="flex items-center gap-1.5 text-xs font-medium text-brand-secondary hover:opacity-75 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar bolsa
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-xl bg-surface-hover" />
        <div className="space-y-1.5">
          <div className="h-7 w-52 rounded-xl bg-surface-hover" />
          <div className="h-4 w-32 rounded-lg bg-surface-hover" />
        </div>
      </div>
      <div className="h-20 rounded-2xl bg-surface-hover" />
      <div className="h-16 rounded-2xl bg-surface-hover" />
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 rounded-xl bg-surface-hover" />
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function WarehouseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // TODO (TASK 8): reemplazar con useQuery
  const warehouse = PLACEHOLDER_WAREHOUSE
  const isLoading = false

  // Estados de modales — conectar mutaciones en TASK 8
  const [addingZone, setAddingZone]           = useState(false)
  const [editingZone, setEditingZone]         = useState<Zone | null>(null)
  const [deletingZone, setDeletingZone]       = useState<Zone | null>(null)
  const [addingBinToZone, setAddingBinToZone] = useState<Zone | null>(null)
  const [editingBin, setEditingBin]           = useState<Bin | null>(null)
  const [deletingBin, setDeletingBin]         = useState<Bin | null>(null)

  // Handlers stub — reemplazar con useMutation en TASK 8
  const handleAddZone    = ()          => setAddingZone(true)
  const handleEditZone   = (z: Zone)  => setEditingZone(z)
  const handleDeleteZone = (z: Zone)  => setDeletingZone(z)
  const handleAddBin     = (z: Zone)  => setAddingBinToZone(z)
  const handleEditBin    = (b: Bin)   => setEditingBin(b)
  const handleDeleteBin  = (b: Bin)   => setDeletingBin(b)

  if (isLoading) return <DetailSkeleton />

  const typeConfig = TYPE_CONFIG[warehouse.type] ?? TYPE_CONFIG.warehouse
  const TypeIcon   = typeConfig.Icon
  const totalBins  = warehouse.zones.reduce((acc, z) => acc + z.bins.length, 0)

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate('/warehouses')}
          className="mt-1 p-2 rounded-xl text-content-faint hover:text-content hover:bg-surface-hover transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl text-content">{warehouse.name}</h1>
            <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0', typeConfig.badgeClass)}>
              {typeConfig.label}
            </span>
            <span className={cn(
              'px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0',
              warehouse.active
                ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                : 'bg-gray-100  text-gray-500  dark:bg-gray-500/20  dark:text-gray-400',
            )}>
              {warehouse.active ? 'Activa' : 'Inactiva'}
            </span>
          </div>
          <p className="text-content-muted text-sm mt-0.5 font-accent">
            Zonas y bolsas de almacenamiento
          </p>
        </div>
      </div>

      {/* ── Stats strip — un solo card con 3 secciones ── */}
      <div className="bg-surface rounded-2xl border border-ui-border overflow-hidden">
        <div className="flex divide-x divide-ui-divide">
          {([
            { label: 'Estado',  icon: TypeIcon,    isText: true,  value: warehouse.active ? 'Activa' : 'Inactiva',
              valueClass: warehouse.active ? 'text-brand-secondary' : 'text-content-muted' },
            { label: 'Zonas',   icon: FolderOpen,  isText: false, value: warehouse.zones.length, valueClass: 'text-content' },
            { label: 'Bolsas',  icon: Package,     isText: false, value: totalBins,              valueClass: 'text-content' },
          ] as const).map(stat => (
            <div key={stat.label} className="flex-1 flex items-center gap-3 px-5 py-4">
              <div className="w-9 h-9 rounded-xl bg-brand-secondary/10 flex items-center justify-center shrink-0">
                <stat.icon className="w-4 h-4 text-brand-secondary" />
              </div>
              <div>
                <p className="text-xs text-content-muted font-accent">{stat.label}</p>
                {stat.isText
                  ? <p className={cn('text-sm font-medium mt-0.5', stat.valueClass)}>{stat.value}</p>
                  : <p className={cn('text-2xl leading-tight font-medium', stat.valueClass)}>{stat.value}</p>
                }
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Zones section ── */}
      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-ui-border flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-content">Zonas</p>
            <p className="text-xs text-content-faint font-accent mt-0.5">
              {warehouse.zones.length === 0
                ? 'Sin zonas registradas'
                : `${warehouse.zones.length} ${warehouse.zones.length === 1 ? 'zona' : 'zonas'} · ${totalBins} ${totalBins === 1 ? 'bolsa' : 'bolsas'} en total`}
            </p>
          </div>
          <button
            onClick={handleAddZone}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white rounded-xl transition-all hover:opacity-90 active:scale-[0.98] gradient-action"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva zona
          </button>
        </div>

        {/* List */}
        <div className="p-4 space-y-3">
          {warehouse.zones.length === 0 ? (
            <div className="text-center py-14">
              <div className="w-12 h-12 rounded-2xl gradient-dark flex items-center justify-center mx-auto mb-3">
                <FolderOpen className="w-6 h-6 text-white/50" />
              </div>
              <p className="text-sm font-medium text-content">Sin zonas</p>
              <p className="text-xs text-content-muted font-accent mt-1 max-w-xs mx-auto">
                Las zonas organizan físicamente la bodega. Crea la primera con el botón de arriba.
              </p>
            </div>
          ) : (
            warehouse.zones.map(zone => (
              <ZoneRow
                key={zone.id}
                zone={zone}
                onEditZone={handleEditZone}
                onDeleteZone={handleDeleteZone}
                onAddBin={handleAddBin}
                onEditBin={handleEditBin}
                onDeleteBin={handleDeleteBin}
              />
            ))
          )}
        </div>
      </div>

      {/* Dummy consumption of modal states to avoid TS unused-var warnings */}
      {/* Remover en TASK 8 cuando se conecten los modales reales */}
      {false && JSON.stringify({ addingZone, editingZone, deletingZone, addingBinToZone, editingBin, deletingBin })}
    </div>
  )
}
