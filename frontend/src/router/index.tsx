import { createBrowserRouter, useSearchParams } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { PermissionGuard } from '@/components/layout/PermissionGuard'
import { PageLoader } from '@/components/shared/PageLoader'
import { ErrorPage } from '@/components/shared/ErrorPage'
import { HomeRedirect } from '@/components/layout/HomeRedirect'

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const ThirdPartiesPage = lazy(() => import('@/pages/third-parties/ThirdPartiesPage'))
const ProductsPage = lazy(() => import('@/pages/products/ProductsPage'))
const WarehousesPage = lazy(() => import('@/pages/warehouses/WarehousesPage'))
const DocumentsPage = lazy(() => import('@/pages/documents/DocumentsPage'))
const DocumentFormPage = lazy(() => import('@/pages/documents/DocumentFormPage'))
const DocumentDetailPage = lazy(() => import('@/pages/documents/DocumentDetailPage'))
const POSCheckoutPage = lazy(() => import('@/pages/documents/POSCheckoutPage'))
const UsersPage = lazy(() => import('@/pages/users/UsersPage'))
const AccountsReceivableListPage = lazy(
  () => import('@/pages/accounts-receivable/AccountsReceivableListPage'),
)
const AccountsReceivableClientStatementPage = lazy(
  () => import('@/pages/accounts-receivable/AccountsReceivableClientStatementPage'),
)
const AccountsReceivableDetailPage = lazy(
  () => import('@/pages/accounts-receivable/AccountsReceivableDetailPage'),
)
const AccountsPayableListPage = lazy(
  () => import('@/pages/accounts-payable/AccountsPayableListPage'),
)
const AccountsPayableDetailPage = lazy(
  () => import('@/pages/accounts-payable/AccountsPayableDetailPage'),
)
const AccountsPayableSupplierStatementPage = lazy(
  () => import('@/pages/accounts-payable/AccountsPayableSupplierStatementPage'),
)
const CreditsListPage = lazy(() => import('@/pages/credits/CreditsListPage'))
const CreditsDetailPage = lazy(() => import('@/pages/credits/CreditsDetailPage'))
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage'))
const StockLookupPage = lazy(() => import('@/pages/stock-lookup/StockLookupPage'))
const SupplierPaymentsListPage = lazy(
  () => import('@/pages/supplier-payments/SupplierPaymentsListPage'),
)
const SupplierPaymentDetailPage = lazy(
  () => import('@/pages/supplier-payments/SupplierPaymentDetailPage'),
)
const SupplierPaymentNewPage = lazy(
  () => import('@/pages/supplier-payments/SupplierPaymentNewPage'),
)
const CustomerPaymentsListPage = lazy(
  () => import('@/pages/customer-payments/CustomerPaymentsListPage'),
)
const CustomerPaymentDetailPage = lazy(
  () => import('@/pages/customer-payments/CustomerPaymentDetailPage'),
)
const CustomerPaymentNewPage = lazy(
  () => import('@/pages/customer-payments/CustomerPaymentNewPage'),
)
const ExcessesPage = lazy(() => import('@/pages/excesses/ExcessesPage'))
const OfficialPurchasesPendingPage = lazy(
  () => import('@/pages/official-purchases/OfficialPurchasesPendingPage'),
)
const OfficialLedgerPage = lazy(() => import('@/pages/official-ledger/OfficialLedgerPage'))
const OfficialLedgerProductPage = lazy(
  () => import('@/pages/official-ledger/OfficialLedgerProductPage'),
)
const InventoryCasesPage = lazy(() => import('@/pages/inventory-cases/InventoryCasesPage'))
const InventoryCasesReportPage = lazy(
  () => import('@/pages/inventory-cases/InventoryCasesReportPage'),
)
const InventoryCaseDetailPage = lazy(
  () => import('@/pages/inventory-cases/InventoryCaseDetailPage'),
)

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
      { index: true, element: <HomeRedirect /> },
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
              <AccountsReceivableListPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'accounts-receivable/clients/:clientId',
        element: (
          <Lazy>
            <PermissionGuard permission="ar.read">
              <AccountsReceivableClientStatementPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'accounts-receivable/:id',
        element: (
          <Lazy>
            <PermissionGuard permission="ar.read">
              <AccountsReceivableDetailPage />
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
        path: 'saldos-a-favor',
        element: (
          <Lazy>
            <PermissionGuard permission={['ar.read', 'ap.read']}>
              <CreditsListPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'saldos-a-favor/clientes/:id',
        element: (
          <Lazy>
            <PermissionGuard permission="ar.read">
              <CreditsDetailPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'saldos-a-favor/proveedores/:id',
        element: (
          <Lazy>
            <PermissionGuard permission="ap.read">
              <CreditsDetailPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'supplier-payments',
        element: (
          <Lazy>
            <PermissionGuard permission="supplier_payment.read">
              <SupplierPaymentsListPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'supplier-payments/new',
        element: (
          <Lazy>
            <PermissionGuard permission="supplier_payment.create">
              <SupplierPaymentNewPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'supplier-payments/:id',
        element: (
          <Lazy>
            <PermissionGuard permission="supplier_payment.read">
              <SupplierPaymentDetailPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'customer-payments',
        element: (
          <Lazy>
            <PermissionGuard permission="customer_payment.read">
              <CustomerPaymentsListPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'customer-payments/new',
        element: (
          <Lazy>
            <PermissionGuard permission="customer_payment.create">
              <CustomerPaymentNewPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'customer-payments/:id',
        element: (
          <Lazy>
            <PermissionGuard permission="customer_payment.read">
              <CustomerPaymentDetailPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'excesses',
        element: (
          <Lazy>
            <PermissionGuard permission="excedente.create">
              <ExcessesPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'official-purchases',
        element: (
          <Lazy>
            <PermissionGuard permission="document.create.CMO">
              <OfficialPurchasesPendingPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'official-ledger',
        element: (
          <Lazy>
            <PermissionGuard permission="official.read">
              <OfficialLedgerPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'official-ledger/products/:productId',
        element: (
          <Lazy>
            <PermissionGuard permission="official.read">
              <OfficialLedgerProductPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'inventory-cases',
        element: (
          <Lazy>
            <PermissionGuard permission="inventory_case.read">
              <InventoryCasesPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'inventory-cases/report',
        element: (
          <Lazy>
            <PermissionGuard permission="inventory_case.read">
              <InventoryCasesReportPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'inventory-cases/:id',
        element: (
          <Lazy>
            <PermissionGuard permission="inventory_case.read">
              <InventoryCaseDetailPage />
            </PermissionGuard>
          </Lazy>
        ),
      },
      {
        path: 'reports',
        element: (
          <Lazy>
            <PermissionGuard permission="report.read">
              <ReportsPage />
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
      { path: '*', element: <ErrorPage variant="not-found" /> },
    ],
  },
])
