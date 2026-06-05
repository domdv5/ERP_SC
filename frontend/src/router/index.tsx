import { createBrowserRouter, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { PageLoader } from '@/components/shared/PageLoader'

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))
const ThirdPartiesPage = lazy(() => import('@/pages/third-parties/ThirdPartiesPage'))
const ComingSoonPage = lazy(() => import('@/pages/coming-soon/ComingSoonPage'))

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
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
      { path: 'products',            element: <Lazy><ComingSoonPage /></Lazy> },
      { path: 'warehouses',          element: <Lazy><ComingSoonPage /></Lazy> },
      { path: 'documents',           element: <Lazy><ComingSoonPage /></Lazy> },
      { path: 'accounts-receivable', element: <Lazy><ComingSoonPage /></Lazy> },
      { path: 'accounts-payable',    element: <Lazy><ComingSoonPage /></Lazy> },
    ],
  },
])
