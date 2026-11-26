import {
  Contact,
  Package,
  Warehouse,
  MapPinned,
  FileText,
  Banknote,
  Truck,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Landmark,
  Wallet,
  ShieldCheck,
  FileCheck2,
  Inbox,
  BookOpen,
  ChartColumnBig,
  ClipboardCheck,
  PiggyBank,
  type LucideIcon,
} from 'lucide-react'

// Fuente de verdad de la ruta del ítem "Nueva remisión". El "?type=REM" hace que
// DrawerLink/NavLink no puedan calcular solos si está activo — ver Sidebar.tsx.
export const REM_NEW_PATH = '/documents/new?type=REM'

// Ruta del ítem "Nueva devolución" (grupo Ventas). Mismo problema del "?type=" que REM.
export const DVV_NEW_PATH = '/documents/new?type=DVV'

// Ruta del ítem "Nueva compra oficial" (grupo Facturación oficial). Mismo problema del "?type=" que REM.
export const CMO_NEW_PATH = '/documents/new?type=CMO'

// Marcador para ítems que el Sidebar renderiza con un componente propio en vez
// de un NavLink plano (hoy solo el acordeón de bodegas).
export type NavItemComponent = 'warehouses-accordion'

// Insignia numérica que el Sidebar pinta junto al ítem.
export type NavItemBadge = 'inventory-cases-open'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  // Sin permiso: visible siempre. String: exige ese permiso. Array: basta con
  // tener alguno (OR), misma semántica que PermissionGuard.
  permission?: string | string[]
  component?: NavItemComponent
  badge?: NavItemBadge
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

// Estructura completa del menú lateral como dato. El Sidebar solo la recorre y
// filtra por permiso; no debe haber booleanos `can*` sueltos para navegación.
export const navGroups: NavGroup[] = [
  {
    label: 'Maestros',
    items: [
      { to: '/third-parties', label: 'Terceros', icon: Contact, permission: 'thirdparty.read' },
      { to: '/products', label: 'Productos', icon: Package },
      {
        to: '/warehouses',
        label: 'Bodegas',
        icon: Warehouse,
        permission: 'warehouse.manage',
        component: 'warehouses-accordion',
      },
      {
        to: '/stock-lookup',
        label: 'Ubicación de stock',
        icon: MapPinned,
        permission: 'inventory.manage',
      },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { to: '/documents', label: 'Operaciones', icon: FileText, permission: 'document.read' },
      {
        to: '/inventory-cases',
        label: 'Diferencias de inventario',
        icon: ClipboardCheck,
        permission: 'inventory_case.read',
        badge: 'inventory-cases-open',
      },
    ],
  },
  {
    label: 'Ventas',
    items: [
      {
        to: '/documents/pos/new',
        label: 'Nueva venta',
        icon: Banknote,
        permission: ['document.create.POS', 'document.create.COT'],
      },
      { to: REM_NEW_PATH, label: 'Nueva remisión', icon: Truck, permission: 'document.create.REM' },
      {
        to: DVV_NEW_PATH,
        label: 'Nueva devolución',
        icon: RotateCcw,
        permission: 'document.create.DVV',
      },
    ],
  },
  {
    label: 'Tesorería',
    items: [
      {
        to: '/supplier-payments',
        label: 'Egresos',
        icon: Landmark,
        permission: 'supplier_payment.read',
      },
      {
        to: '/customer-payments',
        label: 'Recibos de caja',
        icon: Wallet,
        permission: 'customer_payment.read',
      },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      {
        to: '/accounts-receivable',
        label: 'Cuentas × Cobrar',
        icon: TrendingUp,
        permission: 'ar.read',
      },
      {
        to: '/accounts-payable',
        label: 'Cuentas × Pagar',
        icon: TrendingDown,
        permission: 'ap.read',
      },
      {
        to: '/saldos-a-favor',
        label: 'Saldos a favor',
        icon: PiggyBank,
        permission: ['ar.read', 'ap.read'],
      },
    ],
  },
  {
    label: 'Facturas',
    items: [
      // La bandeja exige document.create.CMO en el backend (no official.read): el gate espeja ese permiso.
      {
        to: '/official-purchases',
        label: 'Compras pendientes',
        icon: Inbox,
        permission: 'document.create.CMO',
      },
      {
        to: CMO_NEW_PATH,
        label: 'Nueva factura de compra',
        icon: FileCheck2,
        permission: 'document.create.CMO',
      },
      {
        to: '/official-ledger',
        label: 'Libro de facturas',
        icon: BookOpen,
        permission: 'official.read',
      },
    ],
  },
  {
    label: 'Análisis',
    items: [{ to: '/reports', label: 'Informes', icon: ChartColumnBig, permission: 'report.read' }],
  },
  {
    label: 'Administración',
    items: [{ to: '/users', label: 'Usuarios', icon: ShieldCheck, permission: 'user.manage' }],
  },
]

// Pantalla de entrada tras el login: la primera de la lista cuyo permiso tiene; Productos no pide permiso
const HOME_PATHS: { to: string; permission?: string }[] = [
  { to: '/reports', permission: 'report.read' },
  { to: '/documents', permission: 'document.read' },
  { to: '/products' },
]

export function findHomePath(permissions: string[]): string {
  const home = HOME_PATHS.find(
    (candidate) => !candidate.permission || permissions.includes(candidate.permission),
  )
  return home!.to
}
