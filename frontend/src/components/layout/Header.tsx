import { useRef, useState } from 'react'
import { Bell, Search, LogOut, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'

export function Header() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
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

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 shadow-sm shrink-0">
      <div className="flex items-center gap-3 w-80">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-secondary" />
        </button>

        {/* User dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={toggleMenu}
            className={cn(
              'flex items-center gap-3 pl-3 pr-2 py-1.5 rounded-xl transition-all duration-200',
              menuOpen ? 'bg-gray-100' : 'hover:bg-gray-50',
            )}
          >
            <div className="text-right">
              <p className="text-sm font-medium text-gray-800 leading-tight">{user?.name ?? 'Usuario'}</p>
              <p className="text-xs text-gray-400">{user?.username}</p>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 gradient-user">
              {user?.name?.[0]?.toUpperCase() ?? 'U'}
            </div>
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-gray-100 shadow-xl bg-white overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 gradient-user">
                    {user?.name?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{user?.name}</p>
                    <p className="text-xs text-gray-400 truncate">{user?.username}</p>
                  </div>
                </div>
              </div>
              <div className="p-1">
                <button
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors cursor-default"
                  disabled
                >
                  <User className="w-4 h-4 shrink-0" />
                  <span>Mi perfil</span>
                  <span className="ml-auto text-xs text-gray-300">Próximamente</span>
                </button>
                <div className="my-1 border-t border-gray-100" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors"
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
