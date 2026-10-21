import {
  Package,
  Users,
  Warehouse,
  FileText,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Activity,
  Clock,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { usePermission } from '@/hooks/usePermission'
import { getThirdParties } from '@/services/third-parties.service'
import { getProducts } from '@/services/products.service'
import { getWarehouses } from '@/services/warehouses.service'
import { getDocuments } from '@/services/documents.service'

// Clases literales para que Tailwind las detecte; el primer KPI es el tile grande y cada fila (2 cols en móvil, 5 en lg) queda completa.
const OPERATIONAL_TILE_SPANS: Record<number, string[]> = {
  1: ['col-span-2 lg:col-span-5'],
  2: ['col-span-1 lg:col-span-3', 'col-span-1 lg:col-span-2'],
  3: ['col-span-2 lg:col-span-3', 'col-span-1 lg:col-span-1', 'col-span-1 lg:col-span-1'],
  4: [
    'col-span-2 lg:col-span-2',
    'col-span-1 lg:col-span-1',
    'col-span-1 lg:col-span-1',
    'col-span-2 lg:col-span-1',
  ],
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const canManageWarehouses = usePermission('warehouse.manage')
  const canReadThirdParties = usePermission('thirdparty.read')
  const canReadDocuments = usePermission('document.read')
  const canReadReceivable = usePermission('ar.read')
  const canReadPayable = usePermission('ap.read')

  const { data: thirdPartiesData, isLoading: loadingThirdParties } = useQuery({
    queryKey: ['third-parties-count'],
    queryFn: () => getThirdParties({ limit: 1 }),
    staleTime: 5 * 60 * 1000,
    // GET /third-parties exige thirdparty.read; sin el permiso ni se dispara.
    enabled: canReadThirdParties,
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
    // GET /warehouses ahora exige warehouse.manage; sin el permiso ni se dispara.
    enabled: canManageWarehouses,
  })

  const { data: documentsData, isLoading: loadingDocuments } = useQuery({
    queryKey: ['documents-count'],
    queryFn: () => getDocuments({ limit: 1 }),
    staleTime: 5 * 60 * 1000,
    // GET /documents exige document.read; sin el permiso ni se dispara.
    enabled: canReadDocuments,
  })

  const dateLabel = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const financialCards = [
    ...(canReadReceivable
      ? [
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
        ]
      : []),
    ...(canReadPayable
      ? [
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
      : []),
  ]

  const operationalCards = [
    ...(canReadDocuments
      ? [
          {
            label: 'Documentos',
            value: loadingDocuments ? null : String(documentsData?.meta.total ?? '—'),
            icon: FileText,
            iconBg: 'bg-teal-500/10',
            iconColor: 'text-teal-600 dark:text-teal-400',
            path: '/documents',
          },
        ]
      : []),
    {
      label: 'Productos',
      value: loadingProducts ? null : String(productsData?.meta.total ?? '—'),
      icon: Package,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-600 dark:text-amber-400',
      path: '/products',
    },
    ...(canReadThirdParties
      ? [
          {
            label: 'Terceros',
            value: loadingThirdParties ? null : String(thirdPartiesData?.meta.total ?? '—'),
            icon: Users,
            iconBg: 'bg-blue-500/10',
            iconColor: 'text-blue-600 dark:text-blue-400',
            path: '/third-parties',
          },
        ]
      : []),
    ...(canManageWarehouses
      ? [
          {
            label: 'Bodegas',
            value: loadingWarehouses ? null : String(warehousesData?.length ?? '—'),
            icon: Warehouse,
            iconBg: 'bg-violet-500/10',
            iconColor: 'text-violet-600 dark:text-violet-400',
            path: '/warehouses',
          },
        ]
      : []),
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
        <div className="flex items-center gap-2 pill-stamp text-xs text-content-faint bg-surface-raised px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-secondary animate-pulse" />
          Sistema activo
        </div>
      </div>

      {/* Bento grid: los KPI con cifras reales son los tiles grandes; los módulos en desarrollo van compactos */}
      <div className="grid grid-cols-2 lg:grid-cols-5 lg:auto-rows-[minmax(6.5rem,auto)] gap-4">
        {operationalCards.map(({ label, value, icon: Icon, iconBg, iconColor, path }, index) => {
          const isLead = index === 0
          return (
            <div
              key={label}
              onClick={() => navigate(path)}
              className={`card-hard press ${isLead ? 'p-6' : 'p-4'} group cursor-pointer flex flex-col justify-between ${OPERATIONAL_TILE_SPANS[operationalCards.length][index]}`}
            >
              <div className="flex items-start justify-between">
                <div
                  className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}
                >
                  <Icon className={`w-4 h-4 ${iconColor}`} />
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-content-faint group-hover:text-content-muted transition-colors shrink-0" />
              </div>
              <div className="min-w-0">
                {value === null ? (
                  <div
                    className={`bg-surface-hover rounded animate-pulse mb-1 ${isLead ? 'h-12 w-24' : 'h-9 w-16'}`}
                  />
                ) : (
                  <p
                    className={`font-display font-black leading-none text-content tabular-nums ${isLead ? 'text-6xl' : 'text-4xl'}`}
                  >
                    {value}
                  </p>
                )}
                <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-content-muted truncate">
                  {label}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {financialCards.length > 0 && (
        <div
          className={`grid grid-cols-1 gap-4 ${financialCards.length === 2 ? 'md:grid-cols-2' : ''}`}
        >
          {financialCards.map(
            ({ label, subtitle, icon: Icon, iconBg, iconColor, dotColor, path, context }) => (
              <div
                key={label}
                onClick={() => navigate(path)}
                className={`card-hard press p-4 group cursor-pointer flex items-center gap-4`}
              >
                <div
                  className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}
                >
                  <Icon className={`w-4 h-4 ${iconColor}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-content-secondary truncate">{label}</p>
                  <p className="text-xs text-content-faint font-accent truncate">{subtitle}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                  <span className="hidden sm:inline font-mono text-[11px] uppercase tracking-wider text-content-faint">
                    {context}
                  </span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-content-faint group-hover:text-content-muted transition-colors shrink-0" />
              </div>
            ),
          )}
        </div>
      )}

      {/* Activity */}
      <div className="card-hard">
        <div className="px-5 py-4 border-b-2 border-ui-border flex items-center justify-between">
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
          <div className="w-10 h-10 rounded-md flex items-center justify-center mb-3 gradient-dark">
            <Activity className="w-5 h-5 text-white/50" />
          </div>
          <p className="text-content-muted text-sm">No hay actividad reciente</p>
          <p className="text-content-faint text-xs mt-1 font-accent">
            Los movimientos aparecerán aquí
          </p>
        </div>
      </div>
    </div>
  )
}
