import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { ReadOnlyBanner } from './ReadOnlyBanner'
import { useThemeStore } from '@/stores/theme.store'
import { useSystemStatus } from '@/hooks/useSystemStatus'

export function AppLayout() {
  const theme = useThemeStore((s) => s.theme)
  const { data: systemStatus } = useSystemStatus()

  useEffect(() => {
    // Debe aplicarse de forma síncrona respecto al cambio de `theme`: el toggle
    // de tema en Header.tsx envuelve la actualización de estado en flushSync
    // precisamente para que esta clase .dark ya esté puesta antes de que
    // startViewTransition capture el snapshot del nuevo estado.
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div className="flex h-screen bg-page overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        {systemStatus?.readOnlyMode && (
          <ReadOnlyBanner activatedBy={systemStatus.activatedBy} activatedAt={systemStatus.activatedAt} />
        )}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
