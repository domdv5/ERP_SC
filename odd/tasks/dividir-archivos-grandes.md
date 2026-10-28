# Partir archivos gigantes (A1 + A3)

Refactor sin cambio de comportamiento de `documents.service.ts` (backend) y `POSCheckoutPage.tsx`/`DocumentFormPage.tsx` (frontend), según `odd/backlog/auditoria-2026-10-27.md`.
Dos cadenas de PRs apiladas (una rama por pieza), trabajadas en worktrees separados: `.worktrees/backend` y `.worktrees/frontend`.

## Specs
- S1 — "vamos primero por el a1/a3, y vmoas amrcnado una vez esten terminados para deja trazabilidad": cada tarea terminada se marca en este documento y en el backlog con su rama y commit.
- S2 — Regla del plan: "mover código sin cambiar comportamiento (mismos endpoints, permisos y reglas). Un PR por pieza, < ~400 líneas". El controller conserva rutas, permisos y respuestas; solo cambia a qué service llama.
- S3 — Pruebas: "Cambiar solo qué service crean" — las specs existentes pueden cambiar el service que instancian, nunca sus `expect`.
- S4 — Anular: "Sí, moverlo a las estrategias" — lo propio de cada tipo en `void()` pasa a un método `void()` de su estrategia (como `confirm()`), y desaparecen los `if (type === ...)` del service (A2). Antes de mover, pruebas de anular por tipo fijan el efecto actual en stock (BinStock/Inventory), costo, estado y cartera. Safety Rule BinStock autorizada por el usuario para este movimiento.
- S5 — Backend, piezas del plan: `documents.service.ts` (crear, editar, confirmar), `documents-query.service.ts` (listados, detalle, PDF), `document-void.service.ts` (anular), `document-conversion.service.ts` (convertir y duplicar), `helpers/document-amounts.ts` (montos e IVA).
- S6 — Frontend: "Sí, agregar Vitest" — devDependency + script `test`, pruebas de helpers puros (`pos-checkout.utils`, `lib/tax`, `lib/credit-application`) antes de partir las páginas.
- S7 — `POSCheckoutPage.tsx` → página de ~250 líneas que solo arma la pantalla, con `useSaleParties()`, `usePaymentLines(totalToPay)` + `<PaymentLinesField>`, `useAppliedCredits()`, `useSaleDraft()`, `useSaleTotals()`, `useConfirmSale()`, `<SaleCart>`, `<SaleSummary>`. `DocumentFormPage.tsx` igual, por separado. "No fusionar ambas páginas."
- S8 — Entrega: "Una rama por pieza, un PR cada una". Commits en cada rama; push y PR los decide el usuario.

## Tasks
Backend (`.worktrees/backend`, cadena desde `main`):
- [x] T1 — S3,S4 — Specs de anular por tipo (stock, costo, estado, cartera). Rama `refactor/void-tests`, commit `d040528`. Route: nestjs-code-crafter. Evidencia: 68 tests nuevos en 4 suites, jest 359/359; mutación (EAI con costo 0 afectando costo) detectada por 2 tests.
- [x] T2 — S2,S5 — `helpers/document-amounts.ts` (computeAmounts, subtotales, total, campos oficiales). Rama `refactor/document-amounts`, commit `e6e0ad2`. Route: nestjs-code-crafter. Evidencia: service 1649→1561, 20 tests nuevos, jest 379/379, build OK.
- [x] T3 — S2,S3,S5 — `documents-query.service.ts`. Rama `refactor/documents-query-service`, commit `18de722`. Route: nestjs-code-crafter. Evidencia: service 1561→1204, query 363; specs solo cambian instancia/objeto espiado; jest 379/379, build y tsc OK.
- [x] T4 — S2,S3,S5 — `document-conversion.service.ts` (convert, duplicate). Rama `refactor/document-conversion-service`, commit `3396166`. Route: nestjs-code-crafter. Evidencia: service 1204→950, conversión 255, `helpers/document-guards.helpers.ts`; locks.spec solo cambia el objeto que llama; jest 379/379, build y tsc OK.
- [x] T5 — S2,S4,S5 — `document-void.service.ts` + reglas por tipo en la estrategia (L3), sin `if (type === ...)`. Rama `refactor/document-void-service`, commit `8ecfe9b`. Route: nestjs-code-crafter. Evidencia: documents.service 950→506, void 467; `grep "type ==="` vacío en services; +38 tests de flags, jest 417/417, tsc y build OK; mutación (EAI costo >= 0) detectada por 3 tests. gentle-ai-verify: S2-S5 pasan, `void()` idéntico salvo las 2 reglas de tipo, sin diferencias de comportamiento.

Frontend (`.worktrees/frontend`, cadena desde `main`):
- [x] T6 — S6 — Vitest + pruebas de helpers puros. Rama `test/frontend-vitest`, commit `3cbbc68`. Route: react-code-crafter. Evidencia: vitest 5.0.5, 95/95 tests, build OK.
- [x] T7 — S2,S7 — Partir `POSCheckoutPage.tsx` en hooks y componentes. Rama `refactor/pos-checkout-split`, commit `eb6e27f` (página 1240→339, 16 archivos en `pos-checkout/`; test 95/95, build OK). gentle-ai-verify: S2 pasa, S7 pasa (339 vs ~250 líneas), sin diferencias de comportamiento. Pendiente: prueba visual del usuario. Route: react-code-crafter.
- [x] T8 — S2,S7 — Partir `DocumentFormPage.tsx`. Rama `refactor/document-form-split`, commit `5ef67bf` (página 1408→243, 18 archivos en `document-form/`, + `findMissingItems.test.ts`; test 100/100, build OK). gentle-ai-verify: S2 y S7 pasan, sin diferencias de comportamiento (tsc y 100/100). Pendiente: prueba visual del usuario. Route: react-code-crafter.

- [x] T9 — S1 — Marcar A1/A2/A3 en el backlog y verificación final (jest, build, tsc). Route: inline. Evidencia: backlog marcado; backend jest 417/417, tsc y build OK; frontend vitest 100/100, build OK.

## Log
- L1 (2026-10-28, usuario): "vamos primero por el a1/a3, y vmoas amrcnado una vez esten terminados para deja trazabilidad"
- L2 (2026-10-28, usuario): anular → "Sí, moverlo a las estrategias"; pruebas → "Cambiar solo qué service crean"; frontend → "Sí, agregar Vitest"; entrega → "Una rama por pieza, un PR cada una".
- L3 (2026-10-28, decisión técnica del orquestador al leer `void()`): lo genérico de anular (movimientos, cartera, saldos a favor, reservas vía `isReservationStrategy`) no depende del tipo; lo único propio de cada tipo son 4 reglas. En vez de un `void()` completo por estrategia (duplicaría la lógica en 12 clases), se agregan a la estrategia flags/métodos como los ya existentes `tracksCustomerBranch`/`usesTodayDate`: `tracksReceiver` (CM), `affectsCostOnVoid(unitCost)` (CM siempre, EAI con costo > 0) y `revertsLastCostOnVoid` (CM). Cumple S4: desaparecen los `if (type === ...)` y lo propio del tipo vive en la estrategia.

## Estado final (2026-10-28)
- Todas las tareas hechas y verificadas. Ninguna rama está pusheada.
- Cadena backend: `refactor/void-tests` d040528 → `refactor/document-amounts` e6e0ad2 → `refactor/documents-query-service` 18de722 → `refactor/document-conversion-service` 3396166 → `refactor/document-void-service` 8ecfe9b.
- Cadena frontend: `test/frontend-vitest` 3cbbc68 → `refactor/pos-checkout-split` eb6e27f → `refactor/document-form-split` 5ef67bf.
- PRs apilados: el primero de cada cadena apunta a `main`, cada siguiente a la rama anterior.
- Worktrees `.worktrees/backend` y `.worktrees/frontend` se dejan para la prueba visual; quitarlos con `git worktree remove` (las ramas quedan).
- Pendiente del usuario: prueba visual del POS (retomar borrador con pagos y saldos a favor, convertir con error de cupo) y del formulario genérico (CM oficial, traslado, EAI/SAJ, DVV, CMO), push y PRs.
- Opcional: pruebas puras de `document-form/buildDocumentPayload.ts` y `documentTypeFlags.ts`; pre-commit con `pnpm test` del frontend.
