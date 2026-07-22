import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Bell, Search, LogOut, User, Sun, Moon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { useThemeStore } from '@/stores/theme.store'

export function Header() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { theme, toggleTheme } = useThemeStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleLogout = () => {
    setMenuOpen(false)
    logout()
    toast.info('Sesión cerrada correctamente')
    navigate('/login', { replace: true })
  }

  const handleClickOutside = (e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setMenuOpen(false)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }

  const toggleMenu = () => {
    setMenuOpen((prev) => {
      if (!prev) document.addEventListener('mousedown', handleClickOutside)
      return !prev
    })
  }

  const handleThemeToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const documentWithViewTransition = document as Document & {
      startViewTransition?: (callback: () => void) => void
    }

    if (typeof documentWithViewTransition.startViewTransition !== 'function') {
      toggleTheme()
      return
    }

    document.documentElement.style.setProperty('--theme-toggle-x', `${e.clientX}px`)
    document.documentElement.style.setProperty('--theme-toggle-y', `${e.clientY}px`)

    documentWithViewTransition.startViewTransition(() => {
      // flushSync obliga a React a aplicar el cambio de tema de forma síncrona
      // (y con él, la clase .dark en <html> vía el useEffect de AppLayout) antes
      // de que el navegador tome la "foto" del nuevo estado para la transición.
      // Sin esto, la captura ocurriría con el tema viejo y el wipe animaría
      // hacia un frame idéntico al anterior.
      flushSync(() => toggleTheme())
    })
  }

  return (
    <header className="h-16 bg-surface border-b border-ui-border flex items-center justify-between px-6 shadow-sm shrink-0">
      <div className="flex items-center gap-3 w-80">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
          <input
            type="text"
            placeholder="Buscar..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-surface-raised border border-ui-border-medium rounded-lg text-content placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={handleThemeToggle}
          title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
          className="p-2 text-content-faint hover:text-content-muted hover:bg-surface-hover rounded-lg transition-colors"
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>

        <button className="relative p-2 text-content-faint hover:text-content-muted hover:bg-surface-hover rounded-lg transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-secondary" />
        </button>

        {/* User dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={toggleMenu}
            className={cn(
              'flex items-center gap-3 pl-3 pr-2 py-1.5 rounded-xl transition-all duration-200',
              menuOpen ? 'bg-surface-hover' : 'hover:bg-surface-raised',
            )}
          >
            <div className="text-right">
              <p className="text-sm font-medium text-content leading-tight">{user?.name ?? 'Usuario'}</p>
              <p className="text-xs text-content-faint">{user?.username}</p>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 gradient-user">
              {user?.name?.[0]?.toUpperCase() ?? 'U'}
            </div>
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-ui-border shadow-xl bg-surface overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-ui-border bg-surface-raised">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 gradient-user">
                    {user?.name?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-content truncate">{user?.name}</p>
                    <p className="text-xs text-content-faint truncate">{user?.username}</p>
                  </div>
                </div>
              </div>
              <div className="p-1">
                <button
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-content-muted hover:text-content-secondary hover:bg-surface-raised transition-colors cursor-default"
                  disabled
                >
                  <User className="w-4 h-4 shrink-0" />
                  <span>Mi perfil</span>
                  <span className="ml-auto text-xs text-content-faint">Próximamente</span>
                </button>
                <div className="my-1 border-t border-ui-border" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
