Contrato front/back (A4) — piloto con documentos.
Contract-first: tipos planos en un contrato que backend y frontend cumplen; si un campo cambia, los dos lados dejan de compilar.
Rama: `feature/contrato-documentos`.

## Specs

- S1 — Contrato en `backend/src/contracts/` (dentro de `src` para no mover el `rootDir` del build): solo tipos TypeScript planos, sin importar Prisma, NestJS ni nada fuera de la carpeta. Lo escribe una persona; "Quién decide qué va adentro: lo que la pantalla necesita mostrar, o sea el frontend. El backend se compromete a entregarlo." Cambia solo editando el archivo en un PR.
- S2 — Piloto: `GET /documents` (fila de listado) y `GET /documents/:id` (detalle, que también devuelven confirm/void/convert/duplicate/release vía `findOne`). Punto de partida: `frontend/src/types/document.types.ts`, corregido contra lo que el backend manda de verdad (Decimal y Date viajan como `string`).
- S3 — Backend: "si `findOne()` no arma exactamente esa forma, el backend no compila". Se verifica con un tipo "como viaja en JSON" (`AsJson<…>`: Decimal→string, Date→string, recursivo) aplicado a lo que devuelve el service, comparado contra el contrato. Debe existir una prueba de tipos que demuestre que un campo faltante o con tipo equivocado no compila.
- S4 — Frontend: "si la pantalla usa un campo que no está en el contrato, el frontend no compila". Importa los tipos de documentos desde el contrato (`import type`, alias `@contracts/*`), sin copia propia; corrige los usos que el compilador marque (p. ej. `total` string → `Number(...)`), sin cambiar lo que se ve en pantalla.
- S5 — "El CI tiene que compilar también el frontend": `.github/workflows/ci.yml` suma el chequeo de tipos (`tsc`) y las pruebas (`vitest`) del frontend, para que GitHub frene un PR que rompa el contrato.
- S6 — Docs: regla del contrato en `CLAUDE.md` raíz (transversal), `backend/CLAUDE.md` y `frontend/CLAUDE.md`; backlog A4 marcado como piloto hecho.

## Tasks

- T1 — S1, S2, S3 — nestjs-code-crafter — contrato + `AsJson` + chequeo en `DocumentsQueryService` + prueba de tipos — commit: pendiente
- T2 — S4 — react-code-crafter — frontend importa del contrato y corrige usos — commit: pendiente
- T3 — S5 — inline — job de frontend en CI — commit: pendiente
- T4 — S6 — inline — docs y backlog — commit: pendiente

## Log

- L1 — Usuario (2026-10-29): "sigamogs con lo del bakclogg" → A4. Tras discutir acoplamiento: "pero entonces empeizo a ganr acoplameinto porque ay el fornted depende del vkac exclusivamente" → se descarta importar tipos de Prisma; se elige contract-first. "momento quein da al forma del contrato?" → lo escribe una persona; lo decide lo que la pantalla necesita. "entocnces si existe algun cambio de algun campo ambos se vana enterar antes de compliar porque suane se contrato?" → sí, con 4 condiciones (ambos usan el contrato, campos de más no se detectan, AsJson para Decimal/Date, CI compila el frontend). "dale" a: documentos como prueba, incluyendo el chequeo del frontend en el CI.
