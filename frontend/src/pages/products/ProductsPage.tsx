import { useEffect, useState } from 'react'
import { useDebounce } from 'use-debounce'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Package, BarChart2, CheckCircle2, Plus, Pencil, Trash2 } from 'lucide-react'
import { getProducts, createProduct, updateProduct, deleteProduct } from '@/services/products.service'
import type { CreateProductPayload } from '@/services/products.service'
import { ProductForm } from './components/ProductForm'
import type { FormValues } from './components/ProductForm'
import { DeleteProductDialog } from './components/DeleteProductDialog'
import { StatsGrid, TableToolbar, TableSkeleton, EmptyState, ErrorState, TablePagination } from '@/components/shared'
import type { Product } from '@/types'

const formatCOP = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)

export default function ProductsPage() {
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(1)
  const [formOpen, setFormOpen]   = useState(false)
  const [editing, setEditing]     = useState<Product | null>(null)
  const [deleting, setDeleting]   = useState<Product | null>(null)

  const [debouncedSearch] = useDebounce(search, 400)

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['products', debouncedSearch, page],
    queryFn: () => getProducts({ search: debouncedSearch || undefined, page, limit: 20 }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })

  const totalPages  = data?.meta.totalPages ?? 1
  const items       = data?.items ?? []
  const total       = data?.meta.total ?? 0
  const activeCount = data?.meta.activeCount ?? 0
  const inStockCount = data?.meta.inStockCount ?? 0

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['products'] })

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: (payload: CreateProductPayload) => createProduct(payload),
    onSuccess: () => { invalidate(); setFormOpen(false); toast.success('Producto creado correctamente') },
    onError:   () => toast.error('Error al crear el producto'),
  })

  const { mutate: update, isPending: isUpdating } = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateProductPayload> }) =>
      updateProduct(id, payload),
    onSuccess: () => { invalidate(); setEditing(null); toast.success('Producto actualizado correctamente') },
    onError:   () => toast.error('Error al actualizar el producto'),
  })

  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => { invalidate(); setDeleting(null); toast.success('Producto eliminado correctamente') },
    onError:   () => toast.error('Error al eliminar el producto'),
  })

  const statCards = [
    { label: 'Total',     value: total,        icon: Package,      bg: 'bg-brand-primary/10',   fg: 'text-brand-primary dark:text-content' },
    { label: 'Activos',   value: activeCount,  icon: CheckCircle2, bg: 'bg-brand-secondary/10', fg: 'text-brand-secondary' },
    { label: 'Con stock', value: inStockCount, icon: BarChart2,    bg: 'bg-blue-500/10',        fg: 'text-blue-500' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-content">Productos</h1>
          <p className="text-content-muted text-sm mt-0.5 font-accent">Catálogo de artículos</p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl transition-all hover:opacity-90 hover:shadow-lg active:scale-[0.98] gradient-action"
        >
          <Plus className="w-4 h-4" />
          Nuevo producto
        </button>
      </div>

      <StatsGrid cards={statCards} isLoading={isLoading} />

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          placeholder="Buscar por código o descripción..."
          isLoading={isLoading}
          itemCount={items.length}
          total={total}
          onRefresh={refetch}
        />

        {isError && (
          <ErrorState message="Error al cargar los productos" onRetry={refetch} />
        )}

        {isLoading && (
          <TableSkeleton widths={['w-32', 'w-48', 'w-20', 'w-16']} />
        )}

        {!isLoading && !isError && items.length === 0 && (
          <EmptyState
            icon={Package}
            title={debouncedSearch ? `Sin resultados para "${debouncedSearch}"` : 'No hay productos registrados'}
            description={debouncedSearch ? 'Prueba con otro término de búsqueda' : 'Crea el primero con el botón "Nuevo producto"'}
          />
        )}

        {!isLoading && !isError && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border">
                  {['Código', 'Descripción', 'Marca', 'Género', 'Categoría', 'Precio Venta', 'Stock', 'Acciones'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-5 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-divide">
                {items.map((p: Product) => (
                  <tr key={p.id} onClick={() => setEditing(p)} className="hover:bg-surface-raised transition-colors group cursor-pointer">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 gradient-action">
                          <Package className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-mono text-xs font-medium text-content">{p.code}</p>
                          {p.legacyCode && <p className="text-xs text-content-faint">{p.legacyCode}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 max-w-[240px]">
                      <p className="text-content truncate">{p.description}</p>
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs">{p.brand.name}</td>
                    <td className="px-5 py-3.5 text-content-muted text-xs">{p.gender.name}</td>
                    <td className="px-5 py-3.5 text-content-muted text-xs">{p.category.name}</td>
                    <td className="px-5 py-3.5 text-content-secondary font-medium text-xs">{formatCOP(p.salePrice)}</td>
                    <td className="px-5 py-3.5 text-content-faint text-xs">—</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditing(p) }}
                          className="p-1.5 rounded-lg text-content-faint hover:text-brand-secondary hover:bg-brand-secondary/10 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleting(p) }}
                          className="p-1.5 rounded-lg text-content-faint hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isError && (
          <TablePagination
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Modals */}
      <ProductForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={(data: FormValues) => create(data as CreateProductPayload)}
        isPending={isCreating}
      />
      <ProductForm
        open={!!editing}
        onClose={() => setEditing(null)}
        onSubmit={(data: FormValues) => update({ id: editing!.id, payload: data as Partial<CreateProductPayload> })}
        isPending={isUpdating}
        defaultValues={editing ?? undefined}
      />
      <DeleteProductDialog
        product={deleting}
        onConfirm={() => remove(deleting!.id)}
        onCancel={() => setDeleting(null)}
        isPending={isDeleting}
      />
    </div>
  )
}
