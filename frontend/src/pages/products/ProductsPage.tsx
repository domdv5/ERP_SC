import { useEffect, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Package, Search, RefreshCw, BarChart2, CheckCircle2 } from 'lucide-react'
import { getProducts } from '@/services/products.service'
import { cn } from '@/lib/utils'
import type { Product } from '@/types'

const formatCOP = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)

export default function ProductsPage() {
  const [search, setSearch]             = useState('')
  const [debouncedSearch, setDebounced] = useState('')
  const [page, setPage]                 = useState(1)

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['products', debouncedSearch, page],
    queryFn: () => getProducts({ search: debouncedSearch || undefined, page, limit: 20 }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })

  const totalPages = data?.meta.totalPages ?? 1
  const items      = data?.items ?? []
  const total      = data?.meta.total ?? 0

  const statCards = [
    { label: 'Total',      value: total,                                        icon: Package,      bg: 'bg-brand-primary/10',   fg: 'text-brand-primary' },
    { label: 'Activos',    value: items.filter((p) => p.active).length,         icon: CheckCircle2, bg: 'bg-brand-secondary/10', fg: 'text-brand-secondary' },
    { label: 'Con stock',  value: items.filter((p) => p.stockCache > 0).length, icon: BarChart2,    bg: 'bg-blue-500/10',        fg: 'text-blue-500' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-gray-900">Productos</h1>
          <p className="text-gray-500 text-sm mt-0.5 font-accent">Catálogo de artículos</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {statCards.map(({ label, value, icon: Icon, bg, fg }) => (
          <div key={label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
              <Icon className={`w-5 h-5 ${fg}`} />
            </div>
            <div>
              <p className="text-2xl text-gray-900">{isLoading ? '—' : value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código o descripción..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all"
            />
          </div>
          <span className="text-xs text-gray-400 ml-auto">{isLoading ? '...' : `${items.length} de ${total} registros`}</span>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Recargar"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>
        </div>

        {/* Error */}
        {isError && (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <p className="text-red-500 text-sm font-medium">Error al cargar los productos</p>
            <button onClick={() => refetch()} className="text-xs text-gray-400 underline">Reintentar</button>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="w-8 h-8 rounded-lg bg-gray-100 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-100 rounded w-32" />
                  <div className="h-2.5 bg-gray-100 rounded w-48" />
                </div>
                <div className="h-5 bg-gray-100 rounded-full w-20" />
                <div className="h-3 bg-gray-100 rounded w-16" />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 gradient-dark">
              <Package className="w-7 h-7 text-white/60" />
            </div>
            <p className="text-gray-500 text-sm font-medium">
              {debouncedSearch ? `Sin resultados para "${debouncedSearch}"` : 'No hay productos registrados'}
            </p>
            <p className="text-gray-400 text-xs mt-1 font-accent">
              {debouncedSearch ? 'Prueba con otro término de búsqueda' : 'Los productos aparecerán aquí una vez ingresados'}
            </p>
          </div>
        )}

        {/* Data table */}
        {!isLoading && !isError && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Código', 'Descripción', 'Marca', 'Género', 'Categoría', 'Precio Venta', 'Stock'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((p: Product) => (
                  <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 gradient-action">
                          <Package className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-mono text-xs font-medium text-gray-900">{p.code}</p>
                          {p.legacyCode && <p className="text-xs text-gray-400">{p.legacyCode}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 max-w-[240px]">
                      <p className="text-gray-800 truncate">{p.description}</p>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs">{p.brand.name}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs">{p.gender.name}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs">{p.category.name}</td>
                    <td className="px-5 py-3.5 text-gray-700 font-medium text-xs">{formatCOP(p.salePrice)}</td>
                    <td className="px-5 py-3.5">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        p.stockCache > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      )}>
                        {p.stockCache}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && !isError && totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Página {page} de {totalPages} &mdash; {total} registros
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={page === 1}
                className="px-2 py-1 text-xs rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">«</button>
              <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}
                className="px-2 py-1 text-xs rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                .reduce<(number | '...')[]>((acc, n, idx, arr) => {
                  if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('...')
                  acc.push(n)
                  return acc
                }, [])
                .map((n, i) =>
                  n === '...' ? (
                    <span key={`e-${i}`} className="px-2 py-1 text-xs text-gray-400">…</span>
                  ) : (
                    <button key={n} onClick={() => setPage(n as number)}
                      className={cn('px-2.5 py-1 text-xs rounded-lg font-medium transition-colors',
                        page === n ? 'text-white gradient-action' : 'text-gray-500 hover:bg-gray-100')}>
                      {n}
                    </button>
                  )
                )}
              <button onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}
                className="px-2 py-1 text-xs rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">›</button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                className="px-2 py-1 text-xs rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
