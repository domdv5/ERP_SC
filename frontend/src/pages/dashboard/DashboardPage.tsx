import { Package, Users, Warehouse, FileText, TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { getThirdParties } from '@/services/third-parties.service'

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const { data: thirdPartiesData, isLoading: loadingThirdParties } = useQuery({
    queryKey: ['third-parties-count'],
    queryFn: () => getThirdParties({ limit: 1 }),
    staleTime: 5 * 60 * 1000,
  })

  const stats = [
    { label: 'Productos',       value: '—',   icon: Package,       path: '/products' },
    { label: 'Terceros',        value: loadingThirdParties ? null : String(thirdPartiesData?.meta.total ?? '—'), icon: Users, path: '/third-parties' },
    { label: 'Bodegas',         value: '—',   icon: Warehouse,     path: '/warehouses' },
    { label: 'Documentos',      value: '—',   icon: FileText,      path: '/documents' },
    { label: 'Cuentas x Cobrar', value: '—',  icon: TrendingUp,    path: '/accounts-receivable' },
    { label: 'Cuentas x Pagar', value: '—',   icon: TrendingDown,  path: '/accounts-payable' },
  ]

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Bienvenido de nuevo, <span className="font-medium text-gray-700">{user?.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Sistema activo
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, path }) => (
          <div
            key={label}
            onClick={() => navigate(path)}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow group cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(7,188,52,0.1), rgba(7,188,52,0.05))' }}
              >
                <Icon className="w-5 h-5" style={{ color: '#07bc34' }} />
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            {value === null ? (
              <div className="h-8 w-16 bg-gray-100 rounded-lg animate-pulse mb-1" />
            ) : (
              <p className="text-2xl font-bold text-gray-900">{value}</p>
            )}
            <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Placeholder for recent activity */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Actividad reciente</h2>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: 'linear-gradient(135deg, #141a17, #1f2b24)' }}
          >
            <FileText className="w-6 h-6 text-white/60" />
          </div>
          <p className="text-gray-500 text-sm">No hay actividad reciente</p>
          <p className="text-gray-400 text-xs mt-1">Los movimientos aparecerán aquí</p>
        </div>
      </div>
    </div>
  )
}
