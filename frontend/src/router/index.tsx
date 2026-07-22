import { createBrowserRouter, Navigate } from 'react-router-dom'
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
const UsersPage = lazy(() => import('@/pages/users/UsersPage'))
const AccountsPayableListPage = lazy(() => import('@/pages/accounts-payable/AccountsPayableListPage'))
const AccountsPayableDetailPage = lazy(() => import('@/pages/accounts-payable/AccountsPayableDetailPage'))

// Fallback de Suspense con delay de 200ms antes de mostrar el loader de
// pantalla completa. Los chunks lazy que ya están en caché del navegador o
// que cargan rápido en dev nunca llegan a los 200ms, así que la navegación
// se siente instantánea en vez de parpadear el spinner en cada click.
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

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Lazy><LoginPage /></Lazy>,
  },
  {
    path: '/',
    element: <AuthGuard><AppLayout /></AuthGuard>,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        element: <Lazy><DashboardPage /></Lazy>,
      },
      {
        path: 'third-parties',
        element: <Lazy><ThirdPartiesPage /></Lazy>,
      },
      { path: 'products',              element: <Lazy><ProductsPage /></Lazy> },
      { path: 'warehouses',            element: <Lazy><WarehousesPage /></Lazy> },
      { path: 'documents',             element: <Lazy><DocumentsPage /></Lazy> },
      { path: 'documents/new',         element: <Lazy><DocumentFormPage /></Lazy> },
      { path: 'documents/:id',         element: <Lazy><DocumentDetailPage /></Lazy> },
      { path: 'documents/:id/edit',    element: <Lazy><DocumentFormPage /></Lazy> },
      { path: 'accounts-receivable',   element: <Lazy><ComingSoonPage /></Lazy> },
      { path: 'accounts-payable',      element: <Lazy><AccountsPayableListPage /></Lazy> },
      { path: 'accounts-payable/:id',  element: <Lazy><AccountsPayableDetailPage /></Lazy> },
      { path: 'users',                 element: <Lazy><PermissionGuard permission="user.manage"><UsersPage /></PermissionGuard></Lazy> },
    ],
  },
])
