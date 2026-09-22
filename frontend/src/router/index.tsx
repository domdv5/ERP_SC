import { createBrowserRouter, Navigate, useSearchParams } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { PermissionGuard } from '@/components/layout/PermissionGuard'
import { PageLoader } from '@/components/shared/PageLoader'

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))
const ThirdPartiesPage = lazy(() => import('@/pages/third-parties/ThirdPartiesPage'))
const ProductsPage = lazy(() => import('@/pages/products/ProductsPage'))
const WarehousesPage = lazy(() => import('@/pages/warehouses/WarehousesPage'))
const ComingSoonPage = lazy(() => import('@/pages/coming-soon/ComingSoonPage'))
const DocumentsPage = lazy(() => import('@/pages/documents/DocumentsPage'))
const DocumentFormPage = lazy(() => import('@/pages/documents/DocumentFormPage'))
const DocumentDetailPage = lazy(() => import('@/pages/documents/DocumentDetailPage'))
const POSCheckoutPage = lazy(() => import('@/pages/documents/POSCheckoutPage'))
const UsersPage = lazy(() => import('@/pages/users/UsersPage'))
const AccountsPayableListPage = lazy(
  () => import('@/pages/accounts-payable/AccountsPayableListPage'),
)
const AccountsPayableDetailPage = lazy(
  () => import('@/pages/accounts-payable/AccountsPayableDetailPage'),
)
const AccountsPayableSupplierStatementPage = lazy(
  () => import('@/pages/accounts-payable/AccountsPayableSupplierStatementPage'),
)
const StockLookupPage = lazy(() => import('@/pages/stock-lookup/StockLookupPage'))
const EgresosListPage = lazy(() => import('@/pages/egresos/EgresosListPage'))
const EgresoDetailPage = lazy(() => import('@/pages/egresos/EgresoDetailPage'))
const EgresoNewPage = lazy(() => import('@/pages/egresos/EgresoNewPage'))
const RecibosCajaListPage = lazy(() => import('@/pages/recibos-caja/RecibosCajaListPage'))
const ReciboCajaDetailPage = lazy(() => import('@/pages/recibos-caja/ReciboCajaDetailPage'))
const RecibosCajaNewPage = lazy(() => import('@/pages/recibos-caja/RecibosCajaNewPage'))

// Delay de 200ms antes del loader de pantalla completa: un chunk ya cacheado no llega a mostrarlo, evita el parpadeo en cada click.
function DelayedPageLoader() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const timeoutId = setTimeout(() => setShow(true), 200)
    return () => clearTimeout(timeoutId)
  }, [])

  if (!show) return null

  return <PageLoader />
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<DelayedPageLoader />}>{children}</Suspense>
}

// key por tipo: /documents/new es la misma ruta para REM/DVV, sin esto no remonta y queda con el tipo anterior.
function NewDocumentForm() {
  const [searchParams] = useSearchParams()
  return <DocumentFormPage key={searchParams.get('type') ?? 'default'} />
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Lazy>
        <LoginPage />
      </Lazy>
    ),
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        element: (
          <Lazy>
            <DashboardPage />
          </Lazy>
        ),
      },
      {
        path: 'third-parties',
        element: (
          <Lazy>
            <PermissionGuard permission="thirdparty.read">
              <ThirdPartiesPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'products',
        element: (
          <Lazy>
            <ProductsPage />
          </Lazy>
        ),
      },
      {
        path: 'warehouses',
        element: (
          <Lazy>
            <PermissionGuard permission="warehouse.manage">
              <WarehousesPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'documents',
        element: (
          <Lazy>
            <PermissionGuard permission="document.read">
              <DocumentsPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'stock-lookup',
        element: (
          <Lazy>
            <PermissionGuard permission="inventory.manage">
              <StockLookupPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'documents/new',
        element: (
          <Lazy>
            <PermissionGuard permission="document.read">
              <NewDocumentForm />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'documents/pos/new',
        element: (
          <Lazy>
            <PermissionGuard permission={['document.create.POS', 'document.create.COT']}>
              <POSCheckoutPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'documents/:id',
        element: (
          <Lazy>
            <PermissionGuard permission="document.read">
              <DocumentDetailPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'documents/:id/edit',
        element: (
          <Lazy>
            <PermissionGuard permission="document.read">
              <DocumentFormPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'accounts-receivable',
        element: (
          <Lazy>
            <PermissionGuard permission="ar.read">
              <ComingSoonPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'accounts-payable',
        element: (
          <Lazy>
            <PermissionGuard permission="ap.read">
              <AccountsPayableListPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'accounts-payable/:id',
        element: (
          <Lazy>
            <PermissionGuard permission="ap.read">
              <AccountsPayableDetailPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'accounts-payable/suppliers/:supplierId',
        element: (
          <Lazy>
            <PermissionGuard permission="ap.read">
              <AccountsPayableSupplierStatementPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'egresos',
        element: (
          <Lazy>
            <PermissionGuard permission="egreso.read">
              <EgresosListPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'egresos/new',
        element: (
          <Lazy>
            <PermissionGuard permission="egreso.create">
              <EgresoNewPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'egresos/:id',
        element: (
          <Lazy>
            <PermissionGuard permission="egreso.read">
              <EgresoDetailPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'recibos-caja',
        element: (
          <Lazy>
            <PermissionGuard permission="recibo.read">
              <RecibosCajaListPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'recibos-caja/new',
        element: (
          <Lazy>
            <PermissionGuard permission="recibo.create">
              <RecibosCajaNewPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'recibos-caja/:id',
        element: (
          <Lazy>
            <PermissionGuard permission="recibo.read">
              <ReciboCajaDetailPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'users',
        element: (
          <Lazy>
            <PermissionGuard permission="user.manage">
              <UsersPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
    ],
  },
])
