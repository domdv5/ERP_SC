import { useLocation } from 'react-router-dom'
import { Construction } from 'lucide-react'

const labels: Record<string, string> = {
  '/products': 'Productos',
  '/warehouses': 'Bodegas',
  '/documents': 'Documentos',
  '/accounts-receivable': 'Cuentas por Cobrar',
}

export default function ComingSoonPage() {
  const { pathname } = useLocation()
  const module = labels[pathname] ?? 'Módulo'

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4 text-center px-6">
      <div className="card-hard w-16 h-16 flex items-center justify-center">
        <Construction className="w-7 h-7 text-brand-secondary" />
      </div>
      <div>
        <h2 className="text-xl text-content mb-1">{module}</h2>
        <p className="text-content-muted text-sm max-w-xs">
          Este módulo está en desarrollo. Estará disponible próximamente.
        </p>
      </div>
    </div>
  )
}
