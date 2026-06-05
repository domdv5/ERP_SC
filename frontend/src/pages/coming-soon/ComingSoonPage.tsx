import { useLocation } from 'react-router-dom'
import { Construction } from 'lucide-react'

const labels: Record<string, string> = {
  '/products':            'Productos',
  '/warehouses':          'Bodegas',
  '/documents':           'Documentos',
  '/accounts-receivable': 'Cuentas por Cobrar',
  '/accounts-payable':    'Cuentas por Pagar',
}

export default function ComingSoonPage() {
  const { pathname } = useLocation()
  const module = labels[pathname] ?? 'Módulo'

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4 text-center px-6">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
        style={{ background: 'linear-gradient(135deg, rgba(7,188,52,0.15), rgba(7,188,52,0.05))', border: '1px solid rgba(7,188,52,0.2)' }}
      >
        <Construction className="w-7 h-7" style={{ color: '#07bc34' }} />
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-1">{module}</h2>
        <p className="text-gray-400 text-sm max-w-xs">
          Este módulo está en desarrollo. Estará disponible próximamente.
        </p>
      </div>
    </div>
  )
}
