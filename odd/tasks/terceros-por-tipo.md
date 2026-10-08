# Terceros por tipo (billing solo clientes)

## Objective
Que `billing` solo pueda crear y editar terceros clientes, siguiendo la convención de permisos por tipo (`document.{acción}.{TIPO}`).

## Problem / Why
Hoy `billing` tiene `thirdparty.create`/`update` sin restricción de tipo: puede crear proveedores/vendedores o marcar "proveedor" a un cliente. Decisión del usuario 2026-10-08.

## Decisions (usuario, 2026-10-08)
- Permisos nuevos `thirdparty.role.customer`, `thirdparty.role.supplier`, `thirdparty.role.seller` (no chequeo por nombre/ID de rol: usuarios con varios roles).
- Crear: cada casilla marcada exige su permiso.
- Editar (PATCH datos y renombrar marca): exige el permiso de cada tipo que el tercero YA tiene, y de cada casilla que el PATCH cambie → billing solo edita clientes puros.
- Cliente+proveedor: billing lo crea como cliente; otro rol con permiso marca proveedor después.
- Seed: admin, purchasing, accounts_admin, accounts_assistant reciben los 3; billing solo `customer`. Requiere `pnpm seed` + re-login (Safety Rule RBAC seed, confirmada por el usuario).

## Tasks
- [x] T1 — Helper puro `backend/src/third-parties/helpers/third-party-permissions.ts` + spec (test-first). Route: inline (punto de decisión de negocio, regla TODO(human)).
- [x] T2 — Backend: controller pasa `req.user`; service valida en create/update/renameBrand; seed de permisos y role-permissions; backend/CLAUDE.md. Route: delegated (nestjs-code-crafter).
- [ ] T3 — Frontend: ocultar casillas proveedor/vendedor sin permiso, cliente marcado por defecto, ocultar Editar en terceros fuera de los permisos; frontend/CLAUDE.md. Route: delegated (react-code-crafter).
- [ ] T4 — Verificación: `pnpm test` + build backend, `tsc -b` frontend. Route: gentle-ai-verify.

## Delivery
Branch: feature/terceros-por-tipo. Un commit por tarea; PR a main solo cuando el usuario lo pida.

## Progress / Evidence
- T1: RED 5/10 con stub vacío → GREEN 10/10 (`jest third-party-permissions`).
- T2: controller/service/seed/backend CLAUDE.md (nestjs-code-crafter); `pnpm test` 101/101, `pnpm run build` OK (writer); diff revisado por el padre.

## Next step
T3.
