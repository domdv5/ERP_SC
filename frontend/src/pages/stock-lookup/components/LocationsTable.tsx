import { MapPin } from 'lucide-react'
import { EmptyState } from '@/components/shared'
import type { ProductLocation } from '@/types/product.types'

interface LocationsTableProps {
  locations: ProductLocation[]
}

export function LocationsTable({ locations }: LocationsTableProps) {
  if (locations.length === 0) {
    return (
      <EmptyState
        icon={MapPin}
        title="Sin bultos asignados"
        description="Este producto no tiene stock ubicado en ningún bulto todavía"
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ui-border">
            {[
              { label: 'Bodega', align: 'text-left' },
              { label: 'Zona', align: 'text-left' },
              { label: 'Bulto', align: 'text-left' },
              { label: 'Cantidad', align: 'text-right' },
            ].map((h) => (
              <th
                key={h.label}
                className={`${h.align} text-xs font-semibold text-content-faint uppercase tracking-wider px-5 py-3`}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ui-divide">
          {locations.map((loc) => (
            <tr key={`${loc.warehouseId}-${loc.zoneName}-${loc.binCode}`} className="hover:bg-surface-raised transition-colors">
              <td className="px-5 py-3.5 text-content">{loc.warehouseName}</td>
              <td className="px-5 py-3.5 text-content-muted text-xs">{loc.zoneName}</td>
              <td className="px-5 py-3.5 text-content-muted text-xs font-mono">#{loc.binCode}</td>
              <td className="px-5 py-3.5 text-right text-content font-medium text-xs">
                {loc.quantity.toLocaleString('es-CO')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
