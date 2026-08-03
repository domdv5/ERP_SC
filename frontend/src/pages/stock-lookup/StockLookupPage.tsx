import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ScanLine, MapPinned } from 'lucide-react'
import { getProductLocationsByCode } from '@/services/products.service'
import { ErrorState } from '@/components/shared'
import { cn } from '@/lib/utils'
import { ProductSummaryCard } from './components/ProductSummaryCard'
import { LocationsTable } from './components/LocationsTable'

function getErrorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null)?.response?.status
}

export default function StockLookupPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [submittedCode, setSubmittedCode] = useState('')

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['product-locations', submittedCode],
    queryFn: () => getProductLocationsByCode(submittedCode),
    enabled: !!submittedCode,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const status = isError ? getErrorStatus(error) : undefined
  const is404 = status === 404

  // Un código no encontrado no es un error de página (no amerita ErrorState con retry) —
  // solo un aviso puntual; volvemos al estado inicial para que el operador escanee otro código.
  useEffect(() => {
    if (!is404) return
    toast.error('Código no encontrado')
    setSubmittedCode('')
    if (inputRef.current) inputRef.current.value = ''
    inputRef.current?.focus()
  }, [is404])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const code = inputRef.current?.value.trim() ?? ''
    if (!code) return
    setSubmittedCode(code)
  }

  const showGenericError = isError && !is404
  const showResult = !!submittedCode && !isLoading && !isError && !!data

  let content: React.ReactNode
  if (isLoading) {
    content = (
      <div className="space-y-4 animate-pulse">
        <div className="bg-surface rounded-2xl border border-ui-border p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-surface-hover shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 bg-surface-hover rounded" />
            <div className="h-4 w-56 bg-surface-hover rounded" />
          </div>
        </div>
        <div className="bg-surface rounded-2xl border border-ui-border overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-ui-divide last:border-0">
              <div className="h-3 w-24 bg-surface-hover rounded" />
              <div className="h-3 w-20 bg-surface-hover rounded" />
              <div className="h-3 w-14 bg-surface-hover rounded" />
              <div className="h-3 w-12 bg-surface-hover rounded ml-auto" />
            </div>
          ))}
        </div>
      </div>
    )
  } else if (showGenericError) {
    content = <ErrorState message="Error al buscar el producto" onRetry={refetch} />
  } else if (showResult && data) {
    content = (
      <div className="space-y-4">
        <ProductSummaryCard product={data.product} totalBinQuantity={data.totalBinQuantity} />
        <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
          <LocationsTable locations={data.locations} />
        </div>
      </div>
    )
  } else {
    content = (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-surface rounded-2xl border border-ui-border shadow-sm">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 gradient-dark">
          <MapPinned className="w-7 h-7 text-white/60" />
        </div>
        <p className="text-content-muted text-sm font-medium">Escanea o ingresa un código de producto</p>
        <p className="text-content-faint text-xs mt-1 font-accent">
          Verás en qué bodega, zona y bulto está ubicado
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl text-content">Ubicación de stock</h1>
        <p className="text-content-muted text-sm mt-0.5 font-accent">
          Consulta la ubicación física de un producto por código
        </p>
      </div>

      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm p-5">
        <label className="block text-xs font-semibold text-content-faint uppercase tracking-wider mb-1.5">
          Código de producto
        </label>
        <div className="relative max-w-sm">
          <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            defaultValue=""
            onKeyDown={handleKeyDown}
            placeholder="Escanear o escribir código..."
            autoComplete="off"
            className={cn(
              'w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-surface-raised text-content placeholder:text-content-faint',
              'focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all',
              'border-ui-border-medium',
            )}
          />
        </div>
      </div>

      {content}
    </div>
  )
}
