import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Users, UserCheck, ShieldCheck, Plus, Pencil, Trash2 } from 'lucide-react'
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getRoleLabel,
} from '@/services/users.service'
import type { AppUser, CreateUserPayload, UpdateUserPayload } from '@/services/users.service'
import { UserForm } from './components/UserForm'
import type { UserFormValues } from './components/UserForm'
import { DeleteUserDialog } from './components/DeleteUserDialog'
import { StatsGrid, TableSkeleton, EmptyState, ErrorState } from '@/components/shared'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRoleNames(user: AppUser): string {
  return user.userRoles.map((ur) => getRoleLabel(ur.role.name)).join(', ') || '—'
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 gradient-user">
      {initials}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function UsersPage() {
  const queryClient = useQueryClient()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing]   = useState<AppUser | null>(null)
  const [deleting, setDeleting] = useState<AppUser | null>(null)

  const { data: items = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    staleTime: 5 * 60 * 1000,
  })

  const total       = items.length
  const activeCount = items.filter((u) => u.active).length
  const adminCount  = items.filter((u) =>
    u.userRoles.some((ur) => ur.role.name === 'admin'),
  ).length

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] })

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(payload),
    onSuccess: () => { invalidate(); setFormOpen(false); toast.success('Usuario creado correctamente') },
    onError:   () => toast.error('Error al crear el usuario'),
  })

  const { mutate: update, isPending: isUpdating } = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) =>
      updateUser(id, payload),
    onSuccess: () => { invalidate(); setEditing(null); toast.success('Usuario actualizado correctamente') },
    onError:   () => toast.error('Error al actualizar el usuario'),
  })

  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => { invalidate(); setDeleting(null); toast.success('Usuario eliminado correctamente') },
    onError:   () => toast.error('Error al eliminar el usuario'),
  })

  const statCards = [
    { label: 'Total',    value: total,       icon: Users,       bg: 'bg-brand-primary/10',   fg: 'text-brand-primary dark:text-content' },
    { label: 'Activos',  value: activeCount, icon: UserCheck,   bg: 'bg-brand-secondary/10', fg: 'text-brand-secondary' },
    { label: 'Admins',   value: adminCount,  icon: ShieldCheck, bg: 'bg-blue-500/10',        fg: 'text-blue-500' },
  ]

  // Map form values to service payload for create
  const handleCreate = (data: UserFormValues) => {
    create({
      name:     data.name,
      username: data.username,
      password: (data as { password: string }).password,
      roleIds:  data.roleIds,
      active:   data.active ?? true,
    })
  }

  // Map form values to service payload for update
  const handleUpdate = (data: UserFormValues) => {
    if (!editing) return
    const payload: UpdateUserPayload = {
      name:     data.name,
      username: data.username,
      roleIds:  data.roleIds,
      active:   data.active,
    }
    const pw = (data as { password?: string }).password
    if (pw) payload.password = pw
    update({ id: editing.id, payload })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-content">Usuarios</h1>
          <p className="text-content-muted text-sm mt-0.5 font-accent">Gestión de accesos y roles del sistema</p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl transition-all hover:opacity-90 hover:shadow-lg active:scale-[0.98] gradient-action"
        >
          <Plus className="w-4 h-4" />
          Nuevo usuario
        </button>
      </div>

      <StatsGrid cards={statCards} isLoading={isLoading} />

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-ui-border flex items-center justify-between">
          <p className="text-xs text-content-faint">
            {isLoading ? '...' : `${items.length} usuarios`}
          </p>
          <button
            onClick={() => refetch()}
            className="text-xs text-content-faint hover:text-content-muted underline transition-colors"
          >
            Actualizar
          </button>
        </div>

        {isError && (
          <ErrorState message="Error al cargar los usuarios" onRetry={refetch} />
        )}

        {isLoading && (
          <TableSkeleton widths={['w-40', 'w-28', 'w-36', 'w-20']} />
        )}

        {!isLoading && !isError && items.length === 0 && (
          <EmptyState
            icon={Users}
            title="No hay usuarios registrados"
            description={'Crea el primero con el botón "Nuevo usuario"'}
          />
        )}

        {!isLoading && !isError && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border">
                  {['Usuario', 'Nombre de usuario', 'Roles', 'Estado', 'Creado', 'Acciones'].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-5 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-divide">
                {items.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setEditing(u)}
                    className="hover:bg-surface-raised transition-colors group cursor-pointer"
                  >
                    {/* Name + avatar */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={u.name} />
                        <p className="font-medium text-content">{u.name}</p>
                      </div>
                    </td>

                    {/* Username */}
                    <td className="px-5 py-3.5">
                      <p className="font-mono text-xs text-content-muted">{u.username}</p>
                    </td>

                    {/* Roles */}
                    <td className="px-5 py-3.5 max-w-[220px]">
                      <p className="text-xs text-content-muted truncate capitalize">{getRoleNames(u)}</p>
                    </td>

                    {/* Active badge */}
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium',
                          u.active
                            ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-500/20 dark:text-gray-400',
                        )}
                      >
                        {u.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>

                    {/* Created date */}
                    <td className="px-5 py-3.5">
                      <p className="text-xs text-content-faint font-accent">{formatDate(u.createdAt)}</p>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditing(u) }}
                          className="p-1.5 rounded-lg text-content-faint hover:text-brand-secondary hover:bg-brand-secondary/10 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleting(u) }}
                          className="p-1.5 rounded-lg text-content-faint hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <UserForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreate}
        isPending={isCreating}
      />
      <UserForm
        open={!!editing}
        onClose={() => setEditing(null)}
        onSubmit={handleUpdate}
        isPending={isUpdating}
        defaultValues={editing ?? undefined}
      />
      <DeleteUserDialog
        user={deleting}
        onConfirm={() => remove(deleting!.id)}
        onCancel={() => setDeleting(null)}
        isPending={isDeleting}
      />
    </div>
  )
}
