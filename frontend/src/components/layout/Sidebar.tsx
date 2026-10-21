import { useRef, useState, useEffect } from 'react'
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Warehouse, Store, ChevronRight, LogOut, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import { getRoleLabel } from '@/services/users.service'
import { getWarehouses } from '@/services/warehouses.service'
import {
  navGroups,
  REM_NEW_PATH,
  DVV_NEW_PATH,
  CMO_NEW_PATH,
  type NavItem,
} from '@/config/navigation'

function getNavLinkClass(isActive: boolean) {
  return cn(
    'flex items-center gap-3 px-3 py-2.5 rounded-md border-2 text-sm font-medium transition-colors duration-100',
    isActive
      ? 'nav-active'
      : 'border-transparent text-content-secondary hover:text-content hover:bg-surface-hover hover:border-ui-border-medium',
  )
}

// Ruta del ítem "Nueva remisión" del grupo Ventas. Al calcular si el enlace está
// activo, NavLink ignora la parte de "?type=REM", así que hay que compararla a mano.
function isRemNewActive(pathname: string, search: string) {
  return pathname === '/documents/new' && new URLSearchParams(search).get('type') === 'REM'
}

// Ruta del ítem "Nueva devolución" del grupo Ventas. Mismo motivo que la remisión: NavLink
// no distingue el "?type=DVV", así que se compara a mano.
function isDvvNewActive(pathname: string, search: string) {
  return pathname === '/documents/new' && new URLSearchParams(search).get('type') === 'DVV'
}

// Ruta del ítem "Nueva compra oficial". Mismo motivo: NavLink no distingue el "?type=CMO".
function isCmoNewActive(pathname: string, search: string) {
  return pathname === '/documents/new' && new URLSearchParams(search).get('type') === 'CMO'
}

// Excluye checkout POS y remisión: ambas empiezan con "/documents" y marcarían "Operaciones" activo por error.
function isDocumentsActive(pathname: string, search: string) {
  return (
    pathname.startsWith('/documents') &&
    !pathname.startsWith('/documents/pos') &&
    !isRemNewActive(pathname, search) &&
    !isDvvNewActive(pathname, search) &&
    !isCmoNewActive(pathname, search)
  )
}

function WarehousesSidebarItem() {
  const location = useLocation()
  const isActive = location.pathname.startsWith('/warehouses')
  const currentId = new URLSearchParams(location.search).get('id')
  const [open, setOpen] = useState(isActive)

  useEffect(() => {
    if (isActive) setOpen(true)
  }, [isActive])

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn('group w-full', getNavLinkClass(isActive))}
      >
        <Warehouse className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-left">Bodegas</span>
        <ChevronRight
          className={cn('w-3 h-3 transition-transform duration-200', open && 'rotate-90')}
        />
      </button>

      <div
        className="overflow-hidden transition-all ease-in-out"
        style={{ maxHeight: open ? '300px' : '0px', transitionDuration: '200ms' }}
      >
        <div className="ml-3 mt-0.5 mb-1 border-l border-ui-border-medium pl-2 space-y-0.5">
          {warehouses.map((w) => {
            const WIcon = w.type === 'store' ? Store : Warehouse
            // Link + isActive manual: NavLink ignora query params y marcaría todos los sub-items activos a la vez.
            const isItemActive = currentId === w.id
            return (
              <Link
                key={w.id}
                to={`/warehouses?id=${w.id}`}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-md border-2 text-xs font-medium transition-colors duration-100',
                  isItemActive
                    ? 'nav-active'
                    : 'border-transparent text-content-muted hover:text-content hover:bg-surface-hover hover:border-ui-border-medium',
                )}
              >
                <WIcon className="w-3 h-3 shrink-0" />
                <span className="truncate">{w.name}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// "/documents" y "Nueva remisión" no pueden delegar a NavLink (coincide de más por prefijo / ignora "?type=REM").
function navLinkClassFor(item: NavItem, pathname: string, search: string) {
  if (item.to === '/documents') {
    return () => getNavLinkClass(isDocumentsActive(pathname, search))
  }
  if (item.to === REM_NEW_PATH) {
    return () => getNavLinkClass(isRemNewActive(pathname, search))
  }
  if (item.to === DVV_NEW_PATH) {
    return () => getNavLinkClass(isDvvNewActive(pathname, search))
  }
  if (item.to === CMO_NEW_PATH) {
    return () => getNavLinkClass(isCmoNewActive(pathname, search))
  }
  return ({ isActive }: { isActive: boolean }) => getNavLinkClass(isActive)
}

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const hasPermission = useAuthStore((s) => s.hasPermission)

  // La estructura del menú vive en config/navigation.ts; acá solo se filtra por
  // permiso. Sin permiso declarado el ítem se ve siempre; un array es OR.
  const canSee = (item: NavItem) => {
    if (!item.permission) return true
    if (typeof item.permission === 'string') return hasPermission(item.permission)
    return item.permission.some(hasPermission)
  }

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleLogout = () => {
    setMenuOpen(false)
    logout()
    toast.info('Sesión cerrada correctamente')
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    if (!menuOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const toggleMenu = () => setMenuOpen((prev) => !prev)

  return (
    <aside className="w-64 flex flex-col h-full bg-surface dark:bg-brand-primary border-r-2 border-ui-border-medium">
      {/* Logo */}
      <div className="px-5 py-4 border-b-2 border-ui-border-medium">
        <div className="flex items-center gap-3">
          <img src="/Logo.svg" alt="EloSC" className="w-9 h-9 shrink-0" />
          <div>
            <p className="text-content dark:text-white font-display font-black text-base leading-tight tracking-wide">
              EloSC
            </p>
            <p className="text-content-muted dark:text-white/40 text-xs font-accent">
              Surtidora de Comerciantes
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
        {navGroups.map((group, groupIdx) => {
          const visibleItems = group.items.filter(canSee)
          if (visibleItems.length === 0) return null

          return (
            <div key={group.label ?? `group-${groupIdx}`} className="space-y-0.5">
              {group.label && (
                <p className="text-content-muted dark:text-white/40 font-mono text-[10px] font-semibold uppercase tracking-widest px-3 pb-1">
                  {group.label}
                </p>
              )}
              {visibleItems.map((item) => {
                if (item.component === 'warehouses-accordion') {
                  return <WarehousesSidebarItem key={item.to} />
                }
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={navLinkClassFor(item, location.pathname, location.search)}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Footer — user dropdown */}
      <div className="px-3 py-4 border-t-2 border-ui-border-medium relative" ref={menuRef}>
        {menuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 rounded-md border-2 border-ui-border-medium shadow-md overflow-hidden bg-surface dark:bg-brand-surface">
            <div className="px-4 py-3 bg-surface-raised dark:bg-transparent border-b-2 border-ui-border-medium">
              <p className="text-content dark:text-white text-xs font-semibold truncate">
                {user?.name ?? 'Usuario'}
              </p>
              <p className="text-content-muted dark:text-white/40 text-xs truncate">
                {user?.username}
              </p>
              {user?.roles && user.roles.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {user.roles.map((r) => (
                    <span
                      key={r}
                      className="pill-stamp text-content-secondary dark:text-white/70 bg-brand-secondary/15"
                    >
                      {getRoleLabel(r)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="p-1">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-content-secondary dark:text-white/60 hover:text-red-500 hover:bg-red-500/10 transition-colors duration-100"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>
        )}
        <button
          onClick={toggleMenu}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md border-2 transition-colors duration-100',
            menuOpen
              ? 'bg-surface-hover border-ui-border-medium'
              : 'border-transparent hover:bg-surface-hover hover:border-ui-border-medium',
          )}
        >
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-black shrink-0 selected-ink">
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-content dark:text-white text-xs font-medium truncate">
              {user?.name ?? 'Usuario'}
            </p>
            <p className="text-content-muted dark:text-white/40 text-xs truncate">
              {user?.roles?.map(getRoleLabel).join(', ') ?? user?.username ?? 'Sesión activa'}
            </p>
          </div>
          <ChevronUp
            className={cn(
              'w-3 h-3 text-content-faint dark:text-white/30 transition-transform duration-200',
              menuOpen ? 'rotate-0' : 'rotate-180',
            )}
          />
        </button>
      </div>
    </aside>
  )
}
