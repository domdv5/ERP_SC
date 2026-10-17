# Recibido por (rol "Recibe mercancía")

Nuevo rol de tercero para registrar quién recibió la mercancía de una compra (`CM`). Branch `feat/recibido-por`.
Migración aditiva y permiso nuevo en el seed RBAC autorizados por el usuario (2026-10-17).

## Specs
- S1 — Rol de tercero nuevo, etiqueta en pantalla **"Recibe mercancía"** (casilla en "Roles del tercero", junto a Cliente/Proveedor/Vendedor). Sin datos propios: es solo el rol, igual que vendedor (`ThirdParty.isReceiver`, columna `is_receiver`, default `false`).
- S2 — Permiso nuevo `thirdparty.role.receiver`, sembrado y asignado a los mismos roles que hoy tienen `thirdparty.role.seller`. Marcar/editar un tercero con este rol sigue la regla de `missingThirdPartyRoles` (igual que los otros tres roles). Un tercero puede tener solo este rol (cuenta como rol válido para "al menos un rol").
- S3 — Compra (`CM`): selector **obligatorio "Recibido por"** que solo lista terceros con el rol. Campo `Document.receiverId` (columna `receiver_id`, nullable, FK a `third_parties`). Usuario: "deberia ser obligatori a la hora de ahcer una comra que aparezca un selector donde peuda eleigir esa eprosna".
- S4 — Backend valida en `validateCreate` y de nuevo en `confirm` (editar un borrador no revalida): sin `receiverId` → 400 `La compra requiere indicar quién recibió la mercancía`; tercero inexistente o sin el rol → 400 `La persona que recibió la mercancía no es válida`. Solo `CM` lo exige; los demás tipos no lo envían ni lo guardan.
- S5 — Compras existentes quedan con `receiverId` nulo y siguen siendo válidas (no se reconfirman).
- S6 — `receiverId` entra en la firma de idempotencia (`isSameDocumentRequest`).
- S7 — "Recibido por" se muestra en el detalle de la compra y en el PDF de la compra.

## Tasks
- T1 — Schema + migración manual aditiva + seed de permiso (S1, S2, S5). Route: inline. Commit: 9e01bc8 ✅
- T2 — Backend: DTOs/filtros de terceros, service, helper de permisos, validación CM, idempotencia, includes de detalle/print, PDF CM, specs, backend/CLAUDE.md (S2–S7). Route: nestjs-code-crafter. Commit: 2b62f90 ✅
- T3 — Frontend: casilla en ThirdPartyForm + filtro, selector en DocumentFormPage para CM, detalle, tipos, helper de permisos, frontend/CLAUDE.md (S1, S3, S7). Route: react-code-crafter. Commit: bf871c2 ✅
- T4 — Verificación: `pnpm test` + build backend, `tsc` frontend, prueba de la API contra la BD de desarrollo. Route: inline. Commit: — (sin código) ✅

## Log
- L1 (usuario, 2026-10-17): "voy a necesitar otro rol de tercero y es que en la empresa se necesita saber quien reicibio al mercancia, pero no se como lalmar ese rol y dberia ser obligatori a la hora de ahcer una comra que aparezca un selector donde peuda eleigir esa eprosna, no tiene algun dato propio o ams bien difernete mas alla del rol como tal"
- L2 (usuario, 2026-10-17): alcance "Solo compras (CM)"; "Sí, autorizo la migración"; nombre "Recibe mercancía".
- L3 (usuario, 2026-10-17): permiso `thirdparty.role.receiver` "Sí, mismos roles que vendedor".
- L4 (evidencia T4, 2026-10-17): backend `pnpm test` 167/167, `pnpm run build` OK, frontend `tsc -b` OK. API real (BD dev): tercero solo-receptor 201; filtro isReceiver OK; CM sin receptor 400 / receptor no válido 400 con los mensajes exactos; CM válida 201 con receiver en detalle; confirmar 201; borrador CM con receiver_id nulo → confirm 400 y sigue draft; EAI con receiverId guarda null; PDF CM muestra "Recibido por: Prueba Recibe". RDD assess (base ccaa817): medium, reviewDue false. Slice: 460 líneas en 4 commits (supera ~400 por poco; un solo PR). No probado en navegador.
- L5 (RDD, 2026-10-17): review-44a52758d3f9efbc (lentes risk + reliability) aprobado y acknowledged (authority burned). Avisos no bloqueantes: se acepta un receptor inactivo (isActive=false) en CM; payload de isReceiver en ThirdPartyForm sin prueba; cambio de receptor por PATCH sin prueba.
- L6 (2026-10-17): fix aviso R1 del review: receptor desactivado → 400 "La persona que recibió la mercancía no es válida" (RED 1 falla → GREEN 7/7; suite 170/170; API real 400).
