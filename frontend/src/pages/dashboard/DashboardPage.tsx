import { Package, Users, Warehouse, FileText, TrendingUp, TrendingDown, ArrowUpRight, Activity, Clock } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { getThirdParties } from '@/services/third-parties.service'
import { getProducts } from '@/services/products.service'
import { getWarehouses } from '@/services/warehouses.service'
import { getDocuments } from '@/services/documents.service'

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const { data: thirdPartiesData, isLoading: loadingThirdParties } = useQuery({
    queryKey: ['third-parties-count'],
    queryFn: () => getThirdParties({ limit: 1 }),
    staleTime: 5 * 60 * 1000,
  })

  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ['products-count'],
    queryFn: () => getProducts({ limit: 1 }),
    staleTime: 5 * 60 * 1000,
  })

  const { data: warehousesData, isLoading: loadingWarehouses } = useQuery({
    queryKey: ['warehouses-count'],
    queryFn: () => getWarehouses(),
    staleTime: 5 * 60 * 1000,
  })

  const { data: documentsData, isLoading: loadingDocuments } = useQuery({
    queryKey: ['documents-count'],
    queryFn: () => getDocuments({ limit: 1 }),
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
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-500 dark:text-amber-400',
      dotColor: 'bg-amber-500',
      path: '/accounts-payable',
      context: 'Módulo en desarrollo',
    },
  ]

  const operationalCards = [
    {
      label: 'Productos',
      value: loadingProducts ? null : String(productsData?.meta.total ?? '—'),
      icon: Package,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-600 dark:text-amber-400',
      path: '/products',
    },
    {
      label: 'Terceros',
      value: loadingThirdParties ? null : String(thirdPartiesData?.meta.total ?? '—'),
      icon: Users,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-600 dark:text-blue-400',
      path: '/third-parties',
    },
    {
      label: 'Bodegas',
      value: loadingWarehouses ? null : String(warehousesData?.length ?? '—'),
      icon: Warehouse,
      iconBg: 'bg-violet-500/10',
      iconColor: 'text-violet-600 dark:text-violet-400',
      path: '/warehouses',
    },
    {
      label: 'Documentos',
      value: loadingDocuments ? null : String(documentsData?.meta.total ?? '—'),
      icon: FileText,
      iconBg: 'bg-teal-500/10',
      iconColor: 'text-teal-600 dark:text-teal-400',
      path: '/documents',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-content">
            Bienvenido, <span className="capitalize">{user?.name?.split(' ')[0]}</span>
          </h1>
          <p className="text-content-muted text-sm mt-0.5 capitalize font-accent">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-content-faint bg-surface-raised px-3 py-1.5 rounded-lg border border-ui-border">
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
            className="bg-surface rounded-2xl p-6 border border-ui-border shadow-sm hover:shadow-md transition-all group cursor-pointer"
          >
            <div className="flex items-start justify-between mb-5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>
              <ArrowUpRight className="w-4 h-4 text-content-faint group-hover:text-content-muted group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <p className="text-3xl text-content mb-1">—</p>
            <p className="text-sm font-medium text-content-secondary">{label}</p>
            <p className="text-xs text-content-faint mt-0.5 font-accent">{subtitle}</p>
            <div className="mt-4 pt-4 border-t border-ui-border flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
              <span className="text-xs text-content-faint">{context}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Operational zone — secondary */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {operationalCards.map(({ label, value, icon: Icon, iconBg, iconColor, path }) => (
          <div
            key={label}
            onClick={() => navigate(path)}
            className="bg-surface rounded-2xl p-4 border border-ui-border shadow-sm hover:shadow-md transition-all group cursor-pointer flex items-center gap-3"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
              <Icon className={`w-4 h-4 ${iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              {value === null ? (
                <div className="h-5 w-10 bg-surface-hover rounded animate-pulse mb-0.5" />
              ) : (
                <p className="text-lg text-content leading-none">{value}</p>
              )}
              <p className="text-xs text-content-faint mt-0.5 truncate">{label}</p>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-content-faint group-hover:text-content-muted transition-colors shrink-0" />
          </div>
        ))}
      </div>

      {/* Activity */}
      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm">
        <div className="px-5 py-4 border-b border-ui-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-content-faint" />
            <h2 className="text-sm text-content">Actividad reciente</h2>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-content-faint">
            <Clock className="w-3 h-3" />
            <span>Hoy</span>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3 gradient-dark">
            <Activity className="w-5 h-5 text-white/50" />
          </div>
          <p className="text-content-muted text-sm">No hay actividad reciente</p>
          <p className="text-content-faint text-xs mt-1 font-accent">Los movimientos aparecerán aquí</p>
        </div>
      </div>
    </div>
  )
}
