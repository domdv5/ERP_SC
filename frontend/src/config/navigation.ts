import {
  LayoutDashboard,
  Contact,
  Package,
  Warehouse,
  MapPinned,
  FileText,
  Banknote,
  Truck,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

// Fuente de verdad de la ruta del ítem "Nueva remisión". El "?type=REM" hace que
// DrawerLink/NavLink no puedan calcular solos si está activo — ver Sidebar.tsx.
export const REM_NEW_PATH = '/documents/new?type=REM'

// Marcador para ítems que el Sidebar renderiza con un componente propio en vez
// de un NavLink plano (hoy solo el acordeón de bodegas).
export type NavItemComponent = 'warehouses-accordion'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  // Sin permiso: visible siempre. String: exige ese permiso. Array: basta con
  // tener alguno (OR), misma semántica que PermissionGuard.
  permission?: string | string[]
  component?: NavItemComponent
}

export interface NavGroup {
  // Sin label: grupo sin encabezado (Dashboard).
  label?: string
  items: NavItem[]
}

// Estructura completa del menú lateral como dato. El Sidebar solo la recorre y
// filtra por permiso; no debe haber booleanos `can*` sueltos para navegación.
export const navGroups: NavGroup[] = [
  {
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
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
      { to: '/stock-lookup', label: 'Ubicación de stock', icon: MapPinned, permission: 'inventory.manage' },
    ],
  },
  {
    label: 'Operaciones',
    items: [{ to: '/documents', label: 'Operaciones', icon: FileText, permission: 'document.read' }],
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
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { to: '/accounts-receivable', label: 'Cuentas × Cobrar', icon: TrendingUp, permission: 'ar.read' },
      { to: '/accounts-payable', label: 'Cuentas × Pagar', icon: TrendingDown, permission: 'ap.read' },
    ],
  },
  {
    label: 'Administración',
    items: [{ to: '/users', label: 'Usuarios', icon: ShieldCheck, permission: 'user.manage' }],
  },
]
