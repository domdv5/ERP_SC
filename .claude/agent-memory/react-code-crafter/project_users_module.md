---
name: project-users-module
description: Users module — CRUD de usuarios y roles via /auth endpoints, ruta /users, grupo Administración en sidebar
metadata:
  type: project
---

El módulo de Usuarios gestiona los accesos al sistema (crear, editar, eliminar usuarios y asignar roles).

**Endpoints** (todos requieren permiso `user.manage`):
- `GET /auth` — lista usuarios con userRoles anidados
- `GET /auth/roles` — lista roles activos con sus permisos
- `POST /auth` — crea usuario; body: `{ name, username, password, roleIds: string[], active? }`
- `PATCH /auth/:id` — actualiza; todos los campos opcionales; password vacío se descarta en frontend
- `DELETE /auth/:id` — elimina permanentemente (no soft-delete)

**Archivos creados:**
- `frontend/src/services/users.service.ts` — `getUsers`, `getRoles`, `createUser`, `updateUser`, `deleteUser`; tipos `AppUser`, `Role`, `CreateUserPayload`, `UpdateUserPayload`
- `frontend/src/pages/users/UsersPage.tsx` — page con stats (Total / Activos / Admins), tabla con avatar de iniciales (`gradient-user`), sin paginación (lista plana)
- `frontend/src/pages/users/components/UserForm.tsx` — crea/edita; password opcional en edición (se descarta si vacío); roles via checkboxes con `Controller`; query `['roles']` con `enabled: open`
- `frontend/src/pages/users/components/DeleteUserDialog.tsx` — confirm dialog; elimina permanentemente

**Router:** ruta `/users` agregada en `router/index.tsx`

**Sidebar:** grupo "Administración" con icono `ShieldCheck` y ruta `/users`

**Patrón especial — password en edición:** el `editSchema` usa `.optional().or(z.literal(''))` para la password. En `handleFormSubmit`, si `isEdit && !data.password`, se hace destructuring y se omite el campo antes de llamar a `onSubmit`. En la página, `handleUpdate` también omite `password` del payload si está vacío.

**Why:** El backend hace `PartialType(CreateAuthDto)` — si se envía `password: ""` intenta hashear string vacío. Mejor no enviarlo.

**How to apply:** Siempre que haya un formulario de edición con campo de contraseña opcional, usar este patrón de strip-on-empty.

[[project-documents-module]]
