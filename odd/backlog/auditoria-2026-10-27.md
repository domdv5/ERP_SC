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
- [x] A2 — sin `if (type === ...)` en los services (8ecfe9b). Desde 2026-10-29 (4debcb2) lo propio de cada tipo al anular vive en el método opcional `undoEffects` de la estrategia (CM/EAI costo, PV/REM reserva); se quitaron los flags `affectsCostOnVoid`/`revertsLastCostOnVoid`.
- [x] A3 — `POSCheckoutPage.tsx` 1.240 → 339 y `DocumentFormPage.tsx` 1.408 → 243 líneas. Ramas `refactor/pos-checkout-split` (eb6e27f) → `refactor/document-form-split` (5ef67bf). Prueba visual del usuario OK.
- [~] A5 — parcial: Vitest en frontend, 100 pruebas de funciones puras (#51, #53) y 68 de anular en backend (#46). Faltan pruebas de pantallas/hooks y un e2e.
- [x] A4 — piloto hecho con documentos (2026-10-29, `odd/tasks/contrato-documentos.md`): contrato contract-first en `backend/src/contracts/`, chequeado en backend y frontend, CI compila el frontend. 2026-11-06: productos, bodegas, ubicaciones, terceros, CxC/CxP, egresos, recibos, libro oficial, reportes y sistema (`odd/tasks/contrato-modulos.md`, PRs #82–#87). Completo salvo auth.

### Resumen de pendientes (actualizado 2026-11-06)

Nota estimada: arquitectura ~7.5/10 (backend 8, frontend 7, contrato front/back 4); seguridad ~9/10 tras S1/S2/S4/S5 (detalle en `odd/tasks/seguridad-cortos.md`).

| Orden | # | Pendiente | Tamaño |
|---|---|---|---|
| ✅ | S1 | `GET /documents/:id` y PDF sin filtrar por tipo visible | Hecho (#57, #59) |
| ✅ | S2 | Actualizar dependencias con DoS (`body-parser`, `multer`, `qs`) | Hecho (#58) |
| ✅ | S4 | Validar `JWT_SECRET` al arrancar | Hecho (#55) |
| ✅ | A4 | Contrato front/back en todos los módulos salvo auth | Hecho (#82–#87) |
| 5 | A5 | Pruebas de pantallas/hooks y e2e | Mediano |
| ✅ | F1 | Costo promedio al anular compra que deja stock 0 | Hecho (opción 2: vuelve a 0) |
| ✅ | S5 | Contraseña 8+ con letras y números | Hecho (#56) |
| 8 | S3/S6 | JWT en cookie `HttpOnly` (resuelve también el token del SSE) | Grande |
| — | Lint | Frontend sin ESLint configurado (`frontend/CLAUDE.md` menciona `pnpm lint`); errores `no-unsafe-*` en specs del backend | Chico |
| — | Pendiente | Quitar el "Descuento (%)" del cliente (`Customer.discount`): ningún cálculo lo usa; 2026-11-06 8 de 18 clientes lo tienen en 0 y ninguno > 0. Migración que borra `customers.discount` + DTO, service, contrato `third-parties.ts` y `ThirdPartyForm`. No tocar `Supplier.discountNotes` (sí se muestra en compras). | Chico |
| ✅ | — | Prueba del hook `useAppliedCredits`: `useAppliedCredits.test.tsx` (jsdom + Testing Library) falla si se quita `toNumericCredits`. | Hecho |
| — | Pendiente | Reportes y libro oficial: el contrato chequea el genérico escrito a mano de `$queryRaw`, no lo que manda Postgres; si alguien quita un `::float8`/`::int` (`reports.service.ts:22`, `official-ledger.service.ts:19-33`), `tsc` no lo ve y los totales viajan como texto. Opción: prueba que verifique los tipos reales o convertir con `Number()` al salir. | Chico |
| ✅ | — | Disponible en ventas: pruebas de `ProductRow` y del carrito del POS (muestran `availableToSell`, no `availableStock`), `findAll` verifica que solo consulta bodegas activas y las props internas se llaman `availableToSell`. Sin probar: el tramo escaneo (`BarcodeScanInput`) → `DocumentItemsTable`. | Hecho |
| — | Pendiente | Formatos de fecha corta distintos: `UsersPage` muestra "06 nov 2026" y `lib/format.ts` "6 nov 2026"; `DocumentsPage.tsx:30` tiene su propio `dd/mm/aaaa`. Decidir un formato y unificar. | Chico |
| — | Pendiente | Pruebas de error de fechas (CxP, CxC, libro oficial) comparan el mensaje pero no que la respuesta siga siendo 400. | Chico |
| — | Limpieza | Ramas locales viejas sin mergear: `master` (2 commits, 2026-06-05), `feature/inventory-ubicacion-stock` (1, 2026-07-28), `feature/ap-ar-filtros-fechas-totales` (1, 2026-09-28); y ya mergeadas sin borrar: `feat/buscar-proveedor-por-marca`, `feat/disponible-uniforme`, `feat/saldo-favor-destino`, `feature/cxc-dias-pago`, `fix/combobox-abre-arriba`, `fix/escaneo-rapido`. Revisar las 3 primeras antes de borrar. | Chico |
| — | Decisión | Revisión automática del harness (RDD): en los PRs #82–#88 quedó rechazada o dio falsos positivos ("falta import" que ya existía) y la autoridad del #88 quedó trabada (`corrupted_or_unverifiable_authority`). Opción: `gentle-ai review mode disable --scope clone`. | — |
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
