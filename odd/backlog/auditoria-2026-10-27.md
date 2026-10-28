# Auditoría de seguridad y arquitectura (2026-10-27)

Revisión de solo lectura pedida por el usuario. Nada de esto está corregido todavía; cada punto va en su propio PR cuando se tome.

## Seguridad — nota 8/10

Sin hallazgos críticos ni altos explotables.

| # | Riesgo | Hallazgo | Dónde | Arreglo |
|---|---|---|---|---|
| S1 | Medio | `GET /documents/:id` y el PDF no filtran por los tipos visibles del rol (el listado sí, con `visibleDocumentTypes`). Con el ID se ve un documento de otro tipo. | `backend/src/documents/documents.service.ts` (`findOne`, `getDocumentForPrint`) | Mismo chequeo que `findAll`; 403 si el tipo no es visible. |
| S2 | Medio | Dependencias del servidor con DoS: `body-parser`, `multer`, `qs` (vía `@nestjs/platform-express`). El resto de `pnpm audit` es del CLI de Prisma (no corre en producción). | `backend/package.json` | Actualizar dependencias y volver a correr `pnpm audit --prod`. |
| S3 | Medio | JWT en `localStorage`: si algún día hay XSS, se roba la sesión. Hoy no hay punto de XSS. | `frontend/src/stores/auth.store.ts` | A futuro: cookie `HttpOnly`. Cambio grande, después de S1/S2/S4. |
| S4 | Bajo | `JWT_SECRET` no se valida al arrancar; si en producción queda el valor de `.env.example`, se pueden falsificar tokens. | `backend/src/auth/auth.module.ts` | Fallar al arrancar si falta, es corto o es el valor de ejemplo. |
| S5 | Bajo | Contraseña mínima de 6 caracteres sin complejidad. | `backend/src/auth/dto/create-auth.dto.ts` | Subir a 8+ con letras y números. |
| S6 | Bajo | El SSE de estado manda el token en `?token=` (EventSource no admite headers). Ya se redacta en los logs. | `frontend/src/hooks/useSystemStatus.ts` | Aceptable; se resuelve solo si se pasa a cookies (S3). |

Verificado bien: guards globales (todo protegido salvo login), `tokenVersion`, rate limit en login y cambio de contraseña, sin enumeración de usuarios, `$queryRaw` parametrizado, `ValidationPipe` con whitelist, errores sin stack, logs con secretos redactados, sin `.env` del backend en git (del frontend solo `VITE_API_URL`).

Prioridad antes de producción: S1, S2, S4 (sube a ~9/10).

## Arquitectura y acoplamiento — nota 6.5/10

Fortalezas
- Módulos backend con límites claros: cada uno usa Prisma y sus DTOs, sin llamarse entre servicios.
- Patrón Strategy por tipo de documento (`DocumentEffectsRegistry` + 12 estrategias) bien aplicado; reglas de impuestos, stock, crédito y pagos en helpers con pruebas.
- Invariante `BinStock`/`Inventory` centralizado en helpers de stock; transacciones y `FOR UPDATE` donde hay concurrencia.
- Frontend en capas (páginas → services → api), TanStack Query y react-hook-form consistentes.
- 37 specs en backend (estrategias, helpers, auth, idempotencia, locks, CxC/CxP).

Debilidades

| # | Hallazgo | Evidencia | Recomendación | Tamaño |
|---|---|---|---|---|
| A1 | `documents.service.ts` es una clase dios (create, update, confirm, void, convert, duplicate, stock, impuestos). | 1.649 líneas | Separar por operación (p. ej. conversión y confirmación en servicios propios) sin cambiar comportamiento. | Grande |
| A2 | Quedan 4 `if (type === ...)` en el service que deberían vivir en la estrategia. | `documents.service.ts` | Mover a métodos de la estrategia (regla del repo: reglas por tipo viven en la estrategia). | Mediano |
| A3 | Páginas gigantes en frontend. | `POSCheckoutPage.tsx` 1.240, `DocumentFormPage.tsx` 1.408 líneas | Extraer hooks (pagos, créditos, carrito) y subcomponentes. No fusionar las dos páginas: el POS es distinto a propósito. | Grande |
| A4 | Tipos del contrato front/back escritos a mano. | `frontend/src/types/*.types.ts` | Generar tipos desde el backend (OpenAPI/Swagger + generador) para que un cambio de campo rompa la compilación. | Mediano |
| A5 | Frontend sin pruebas automáticas; backend sin e2e ni pruebas de controllers. | 0 archivos `*.test`/`*.spec` en `frontend/src` | Vitest para helpers puros (`pos-checkout.utils`, `lib/tax`) y un e2e de confirmar/anular venta. | Mediano |

Puntaje de acoplamiento: backend 7/10, frontend 6/10, contrato front/back 4/10 (10 = muy desacoplado).

Orden sugerido: S1 → S2 → S4 → A5 (pruebas frontend de helpers) → A2 → A4 → A1/A3.

### Estado (2026-10-28)

Detalle y evidencia por tarea en `odd/tasks/dividir-archivos-grandes.md`. Mergeado en main: PRs #46–#53.

- [x] A1 — `documents.service.ts` 1.649 → 506 líneas, repartido en `documents-query.service.ts`, `document-conversion.service.ts`, `document-void.service.ts`, `helpers/document-amounts.ts` y `helpers/document-guards.helpers.ts`. Ramas `refactor/void-tests` (d040528) → `refactor/document-amounts` (e6e0ad2) → `refactor/documents-query-service` (18de722) → `refactor/document-conversion-service` (3396166) → `refactor/document-void-service` (8ecfe9b).
- [x] A2 — sin `if (type === ...)` en los services: `tracksReceiver`, `affectsCostOnVoid(unitCost)` y `revertsLastCostOnVoid` en la estrategia (8ecfe9b).
- [x] A3 — `POSCheckoutPage.tsx` 1.240 → 339 y `DocumentFormPage.tsx` 1.408 → 243 líneas. Ramas `refactor/pos-checkout-split` (eb6e27f) → `refactor/document-form-split` (5ef67bf). Prueba visual del usuario OK.
- [~] A5 — parcial: Vitest en frontend, 100 pruebas de funciones puras (#51, #53) y 68 de anular en backend (#46). Faltan pruebas de pantallas/hooks y un e2e.
- [ ] A4 — tipos front/back siguen a mano (sin empezar).

### Resumen de pendientes (2026-10-28)

Nota estimada tras el split: arquitectura ~7.5/10 (backend 8, frontend 7, contrato front/back 4); seguridad sigue 8/10.

| Orden | # | Pendiente | Tamaño |
|---|---|---|---|
| 1 | S1 | `GET /documents/:id` y PDF sin filtrar por tipo visible | Chico |
| 2 | S2 | Actualizar dependencias con DoS (`body-parser`, `multer`, `qs`) | Chico |
| 3 | S4 | Validar `JWT_SECRET` al arrancar | Chico |
| 4 | A4 | Generar tipos del frontend desde el backend | Mediano |
| 5 | A5 | Pruebas de pantallas/hooks y e2e | Mediano |
| 6 | F1 | Costo promedio al anular compra que deja stock 0 | Chico |
| 7 | S5 | Contraseña 8+ con letras y números | Chico |
| 8 | S3/S6 | JWT en cookie `HttpOnly` (resuelve también el token del SSE) | Grande |
| — | Lint | Frontend sin ESLint configurado (`frontend/CLAUDE.md` menciona `pnpm lint`); errores `no-unsafe-*` en specs del backend | Chico |
| — | Idea | Venta mixta contado+crédito = COT por el total + recibo de caja automático | Por definir |

## Plan para partir los archivos gigantes (A1 + A3)

Regla: mover código sin cambiar comportamiento (mismos endpoints, permisos y reglas). Un PR por pieza, < ~400 líneas, y las pruebas existentes deben pasar sin tocarlas.

Backend — `documents.service.ts` (1.649 líneas; `void()` solo ~420):
- `documents.service.ts`: crear, editar, confirmar (~450).
- `documents-query.service.ts`: listados, detalle, PDF (~200).
- `document-void.service.ts`: anular (~150); lo propio de cada tipo pasa a un `void()` en su estrategia, igual que `confirm()`, y desaparecen los `if (type === ...)` (A2).
- `document-conversion.service.ts`: convertir y duplicar (~250).
- `helpers/document-amounts.ts`: montos e IVA (~90).
- El controller sigue igual; solo cambia a qué service llama.

Frontend — `POSCheckoutPage.tsx` (1.240 líneas) → página de ~250 que solo arma la pantalla:
- `useSaleParties()` cliente, vendedora, sucursal.
- `usePaymentLines(totalToPay)` + `<PaymentLinesField>` formas de pago.
- `useAppliedCredits()` saldos a favor.
- `useSaleDraft()` borrador retomado y conversión.
- `useSaleTotals()` totales, IVA y lista de faltantes.
- `useConfirmSale()` guardar/confirmar con errores de stock y cupo.
- `<SaleCart>` y `<SaleSummary>`.
- `DocumentFormPage.tsx` igual, por separado. No fusionar ambas páginas.

Orden: 1) pruebas primero (anular por tipo en backend; helpers puros en frontend) → 2) montos → consultas → conversión → anular con estrategias → 3) frontend hook por hook. Estimado: 8–10 PRs chicos.

## Pendientes a futuro

| # | Hallazgo | Evidencia | Opciones | Tamaño |
|---|---|---|---|---|
| F1 | Al anular una compra que deja el stock en 0, el costo promedio se queda con el costo de esa compra (el último costo sí vuelve a 0). Reportado por el usuario 2026-10-28: PRD-1007, CM 000049 (300 u a $14.000) anulada → promedio $14.000 con stock 0. Comportamiento previo al refactor, fijado a propósito en `stock.helpers.spec.ts:105`. No afecta compras futuras (con stock 0 el promedio toma el costo de la compra), solo lo que se muestra. | `calculateAvgCostAfterVoid` en `backend/src/documents/helpers/stock.helpers.ts` (`if (denominator <= 0) return currentAvgCost`) | 1) guardar el promedio anterior en cada movimiento y restaurarlo (migración); 2) poner 0 cuando el stock queda en 0 (recomendada, sin migración); 3) dejarlo. | Chico (opción 2) |
