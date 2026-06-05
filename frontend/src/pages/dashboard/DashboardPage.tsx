import { Package, Users, Warehouse, FileText, TrendingUp, TrendingDown, ArrowUpRight, Activity, Clock } from 'lucide-react'
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

  const dateLabel = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const financialCards = [
    {
      label: 'Cuentas por Cobrar',
      subtitle: 'Cartera pendiente de clientes',
      icon: TrendingUp,
      iconBg: 'bg-brand-secondary/10',
      iconColor: 'text-brand-secondary',
      dotColor: 'bg-brand-secondary',
      path: '/accounts-receivable',
      context: 'Módulo en desarrollo',
    },
    {
      label: 'Cuentas por Pagar',
      subtitle: 'Obligaciones con proveedores',
      icon: TrendingDown,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      dotColor: 'bg-blue-500',
      path: '/accounts-payable',
      context: 'Módulo en desarrollo',
    },
  ]

  const operationalCards = [
    { label: 'Productos',   value: '—',    icon: Package,   path: '/products' },
    {
      label: 'Terceros',
      value: loadingThirdParties ? null : String(thirdPartiesData?.meta.total ?? '—'),
      icon: Users,
      path: '/third-parties',
    },
    { label: 'Bodegas',    value: '—',    icon: Warehouse, path: '/warehouses' },
    { label: 'Documentos', value: '—',    icon: FileText,  path: '/documents' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-gray-900">
            Bienvenido, <span className="capitalize">{user?.name?.split(' ')[0]}</span>
          </h1>
          <p className="text-gray-500 text-sm mt-0.5 capitalize font-accent">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-secondary animate-pulse" />
          Sistema activo
        </div>
      </div>

      {/* Financial zone — primary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {financialCards.map(({ label, subtitle, icon: Icon, iconBg, iconColor, dotColor, path, context }) => (
          <div
            key={label}
            onClick={() => navigate(path)}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all group cursor-pointer"
          >
            <div className="flex items-start justify-between mb-5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <p className="text-3xl text-gray-900 mb-1">—</p>
            <p className="text-sm font-medium text-gray-700">{label}</p>
            <p className={`text-xs text-gray-400 mt-0.5 font-accent`}>{subtitle}</p>
            <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
              <span className="text-xs text-gray-400">{context}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Operational zone — secondary */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {operationalCards.map(({ label, value, icon: Icon, path }) => (
          <div
            key={label}
            onClick={() => navigate(path)}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all group cursor-pointer flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-brand-secondary/10">
              <Icon className="w-4 h-4 text-brand-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              {value === null ? (
                <div className="h-5 w-10 bg-gray-100 rounded animate-pulse mb-0.5" />
              ) : (
                <p className="text-lg text-gray-900 leading-none">{value}</p>
              )}
              <p className="text-xs text-gray-400 mt-0.5 truncate">{label}</p>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-gray-200 group-hover:text-gray-400 transition-colors shrink-0" />
          </div>
        ))}
      </div>

      {/* Activity */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm text-gray-800">Actividad reciente</h2>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            <span>Hoy</span>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3 gradient-dark">
            <Activity className="w-5 h-5 text-white/50" />
          </div>
          <p className="text-gray-500 text-sm">No hay actividad reciente</p>
          <p className="text-gray-400 text-xs mt-1 font-accent">Los movimientos aparecerán aquí</p>
        </div>
      </div>
    </div>
  )
}
