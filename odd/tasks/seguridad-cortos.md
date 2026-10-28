# Seguridad: arreglos cortos (S1, S2, S4, S5)

Hallazgos cortos de `odd/backlog/auditoria-2026-10-27.md`. Un PR por hallazgo, cada uno en su rama desde `main`.

## Specs
- S1 — "Estricto + excepción para Cuentas": `GET /documents/:id` y `GET /documents/:id/print` solo devuelven documentos cuyo tipo es visible para el rol (los mismos de `document.create.{T}`/`document.void.{T}` que usa el listado); si no, 403. Quien tiene `ar.read`, `ap.read` u `official.read` ve cualquier tipo. Las llamadas internas a `findOne` (después de confirmar, liberar, convertir, anular) no cambian.
- S2 — Actualizar las dependencias de runtime del backend con DoS (`body-parser`, `multer`, `qs` vía `@nestjs/platform-express`) y volver a correr `pnpm audit --prod`.
- S4 — El backend no arranca si `JWT_SECRET` falta, tiene menos de 32 caracteres o es el valor de `.env.example`. No cambia el payload ni la duración del token. Safety Rule (AuthModule) autorizada por el usuario ("vale").
- S5 — Contraseña nueva: mínimo 8 caracteres, con al menos una letra y un número, al crear usuario, editarlo y cambiar la propia. Las contraseñas actuales siguen sirviendo para entrar (login sin cambios). "en fronted que avise visualmente como es la regla para la contra": los formularios muestran la regla y marcan en vivo qué parte se cumple.

## Tasks
- [x] T1 — S4 — Validar `JWT_SECRET` al arrancar. Rama `fix/jwt-secret-check`, commit `01720bf`, PR #55. Route: inline.
- [x] T2 — S5 — Regla de contraseña en DTOs (backend) + aviso visual en `UserForm` y `ChangePasswordDialog`. Rama `fix/password-rule`, commit `dd54e16`, PR #56. Route: regla inline + UI react-code-crafter.
- [x] T3 — S1 — Filtro por tipo visible en detalle y PDF. Rama `fix/document-visibility`, commit `25e285f`, PR #57. Route: inline.
- [x] T4 — S2 — Actualizar dependencias. Rama `fix/backend-deps`, commit `c2eb0ea`, PR #58 (se cerró al borrar la rama antes del merge; se recreó y reabrió). Route: inline.
- [x] T6 — S1, L4 — Ocultar en `DocumentDetailPage` los enlaces a documentos de tipos que el rol no ve. Rama `fix/hide-forbidden-document-links`, commit `cfc30d1`, PR #59. Incluye el tipo de la venta en las aplicaciones de saldo a favor (`DETAIL_INCLUDE`). Route: regla inline + UI react-code-crafter.
- [x] T5 — Marcar S1/S2/S4/S5 en el backlog, PRs y merge. Route: inline.

## Evidence
- gentle-ai-verify: S1, S4, S5 cumplen; S2 cumple (audit sin body-parser/multer/qs). Backend 421/419/430 por rama, frontend 109. Aviso: enlaces del detalle a tipos no visibles dan 403 (→ T6).

## Log
- L1 (2026-10-28, usuario): "vale en fronted que avise visauelmente como es la regla para la contra" (respuesta a "¿Los hago los cuatro, cada uno en su PR?").
- L2 (2026-10-28, usuario): S1 → "Estricto + excepción para Cuentas".
- L3 (2026-10-28, usuario): merge de los 4 PRs → "Sí, mergear los 4".
- L4 (2026-10-28, usuario): enlaces del detalle a documentos de tipos que el rol no ve → "Ocultarlos" (se ve el número sin enlace).
