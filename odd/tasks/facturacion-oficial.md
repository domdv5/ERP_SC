# Facturación oficial / no oficial (Compra oficial, POS oficial, libro de control oficial)

## Objetivo

Separar las operaciones oficiales (que luego irán a Tributo/DIAN) del flujo físico, con un libro de control oficial por producto (compras oficiales − POS oficiales = saldo), sin tocar el inventario físico ni crear una contabilidad paralela.

## Problema / por qué

Hoy la empresa registra en SAE, de forma independiente: Compras registra todas las compras (entrada física); Administración registra aparte solo las compras oficiales. Las ventas oficiales no dependen del stock físico, y una mercancía comprada no oficialmente puede venderse oficialmente. Se necesita trazabilidad de las operaciones oficiales y su saldo, sin que ese saldo se interprete como existencia física.

## Decisiones confirmadas con el usuario (2026-10-05)

1. Inventario físico intacto: `CM`, `POS` no oficial y demás tipos siguen igual.
2. Libro de control oficial: saldo por producto (sin bodega) = Σ cantidades de compras oficiales confirmadas − Σ cantidades de POS oficiales confirmados. Puede quedar negativo (= venta oficial respaldada por compra no oficial). Nunca bloquea. Derivado en vivo de los documentos, sin tabla de saldos.
3. Venta oficial = solo POS oficial. No mueve stock, no valida stock, no aplica saldos a favor, no crea CxC/CxP. Mantiene cliente, vendedor, forma de pago y piso de precio.
4. Compra oficial: documento propio con consecutivo propio, registrado por Administración. No mueve stock ni crea CxP. Enlace opcional a una `CM` (prefill editable). Se puede crear sin `CM`.
5. `CM`: nuevo flag "Compra oficial (con factura)" + número de factura del proveedor (obligatorio si el flag está activo). Compras sabe si es oficial al registrar. Ningún otro cambio de comportamiento.
6. Bandeja de Administración: `CM` confirmadas marcadas oficiales que aún no tienen compra oficial activa (no anulada) enlazada.
7. IVA: en compra oficial y POS oficial se digita el valor SIN IVA; el sistema guarda aparte el IVA = 19% del subtotal por línea y en el documento; total = subtotal + IVA. La `CM` mantiene el IVA implícito en el subtotal; el 19% del PDF de la CM es informativo y NO se cambia.
8. Permisos: crear compra oficial → `accounts_admin`, `accounts_assistant`, `admin`. POS oficial → mismos roles que POS hoy (`billing`, `admin`). Consultar libro oficial + bandeja → `accounts_admin`, `accounts_assistant`, `admin`.
9. Safety Rules autorizadas explícitamente por el usuario: migración de schema y seed RBAC.

## Modelado

- Nuevos `DocumentType`: `CMO` (compra oficial) y `POSO` (POS oficial) — consecutivo propio gratis por `@@unique([type, number])` + `Sequence` por tipo; permisos `document.create.CMO`/`document.create.POSO` por el mecanismo dinámico existente.
- `CMO` enlaza la `CM` vía `Document.sourceDocumentId` existente.
- Campos IVA en `DocumentItem` y `Document` (nullable, solo los usan CMO/POSO).
- Campos `CM`: flag oficial + número de factura del proveedor.

## Tareas

- [x] T1. Schema + migración manual + seed RBAC (tipos `CMO`/`POSO`, flag/factura en CM, campos IVA, permisos). Ruta: delegado (`nestjs-code-crafter`, writer trigger 2+ archivos). Migración `20261005120000_facturacion_oficial` aplicada; seed corrido (idempotente).
- [x] T2. CM: validación flag + número de factura (validateCreate y confirm). Ruta: delegado (mismo writer backend).
- [x] T3. Estrategia `CMO` + cálculo IVA + bandeja `GET /documents/official-purchases/pending`. Ruta: delegado (mismo writer backend). Usuario confirmó mantener la bandeja.
- [x] T4. Estrategia `POSO` + cálculo IVA (validación compartida movida a `BaseEffectStrategy.validateCashSale`). Ruta: delegado (mismo writer backend).
- [x] T5. `OfficialLedgerModule`: `GET /official-ledger` + `GET /official-ledger/products/:productId`. Ruta: delegado (mismo writer backend).
- [x] T6. Frontend: campos CM, formulario CMO con IVA, bandeja, toggle Oficial en POS checkout, página del libro, navegación. Ruta: delegado (`react-code-crafter`). Commit `e9593ce` (build OK; sin prueba en navegador aún).
- [x] T7. Documentación `backend/CLAUDE.md` + `frontend/CLAUDE.md` (va con cada tarea).
- [x] T10. IVA: `salePrice`/`minSalePrice` y costos de CM traen IVA (confirmado por el usuario 2026-10-06). CMO precarga costo ÷1,19; POSO precarga precio ÷1,19 hacia arriba y el piso se compara sin IVA en backend y frontend. Commits `283cd9a`, `6ba5815`. Ruta: inline (piezas de regla de negocio).
- [x] T11. Hallazgos code-review: CMO borrador suelta la CM al cambiar proveedor (`null` en PATCH); aviso de preventa se re-chequea al apagar "Oficial". En `e9593ce`.
- [ ] T12. Prueba en navegador del flujo completo (CM oficial → bandeja → CMO; POS oficial; libro). Pendiente.
- [ ] T13. Renombrar pastilla/casilla "Compra oficial" de la CM a "Con factura" + enlace a su CMO. Propuesto, pendiente de OK del usuario.

RDD 2026-10-06: revisión `review-0358902ea15eb7b5` (base `bfbb44b`..`e214e48`) aprobada y reconocida; hallazgos R3-001 (redondeo prefill vs piso) y R3-002 (RepeatableRead) corregidos en `6ba5815` (assess: under_budget, 18 líneas, pendiente en el slice). Próxima base revisada: `e214e48`.

## Futuro: cierre mensual del libro oficial (anotado 2026-10-06, sin implementar)

Motivo: el libro suma desde el primer documento de la historia; con volumen mayorista (~1M líneas/año estimado) la consulta crece cada año. Hoy es suficiente (índices `document(type,status)`, `document_item(documentId)`).

Idea acordada con el usuario: tarea programada (`@nestjs/schedule`) a fin de mes en la madrugada que guarda el saldo por producto en una tabla de cierres; el informe parte del último cierre y solo suma lo posterior (no recalcular desde el principio).

Cosas a resolver antes de implementarlo:
1. Documentos con fecha de un mes ya cerrado (confirmar/anular POSO/CMO de octubre en noviembre) desactualizan el cierre → **bloquear periodos cerrados** (recomendado) o recalcular ese mes y los siguientes. **Pendiente: preguntar si en la tienda se anulan/registran ventas con fecha del mes anterior.**
2. Si la tarea no corre (servidor apagado), el informe debe partir del último cierre existente, no asumir el mes anterior; la tarea debe ser repetible sin duplicar (upsert por producto+mes).
3. Con varios servidores la tarea correría en cada uno → prever un candado (hoy hay un solo servidor).

Relacionado: `InventorySnapshot` (tabla sin uso, candidata para cierres).

## Criterios de aceptación

- Confirmar CMO/POSO no crea `InventoryMovement` ni toca `Inventory`/`BinStock`, ni CxP/CxC.
- IVA = round(subtotal × 0.19) por línea; totales de documento coherentes.
- CM oficial sin número de factura → 400.
- Bandeja lista solo CM confirmadas oficiales sin CMO activa.
- Libro: saldo = compras − ventas por producto, filtrable por fechas, con negativos visibles.
- Anular CMO/POSO las saca del libro.

## Verificación

- `pnpm run build` (backend) y `pnpm run build` / lint (frontend).
- Prueba funcional en vivo vía API (backend dev corre `dist/` — rebuild + restart para probar).
- Sin tests automatizados (baseline del repo: 0 `.spec.ts`; no crear archivos de test).

## TDD

Desactivado — baseline del repo sin tests; verificación funcional en vivo.

## Entrega

Estrategia `ask-on-risk`. Pronóstico > 400 líneas (backend ~600–900, frontend ~800+). **Decisión del usuario (2026-10-05): un solo PR** (`single-pr`, mismo criterio que Recibos de Caja), con commits por unidad de trabajo dentro de la rama.

## Progreso

- Rama `feature/facturacion-oficial` creada desde `main` (d989c30).
- RDD: on (global).
- 2026-10-05: backend revisado archivo por archivo por el usuario antes del commit (primer commit `b534b65` se deshizo a pedido del usuario para revisarlo en VS Code). Commit + push del backend autorizados por el usuario.

## Pendiente para mañana (2026-10-06)

0. **Primero (aprobado por el usuario 2026-10-05): corregir hallazgos 1 y 2 de la revisión RDD** (ruta: delegado `nestjs-code-crafter`, mostrar diff antes del commit):
   - T8. Regla "una CMO activa por CM" debe contar solo CMO **confirmadas** (no borradores), en `validateCreate`/`confirm` y en la bandeja; mantener el `FOR UPDATE` de la CM origen en confirm para serializar confirms concurrentes.
   - T9. `findProductMovements` del libro: correr movimientos + saldo inicial dentro de una sola `$transaction` (como `findAll`).
   - **T8 + T9 implementados 2026-10-05** (delegado `nestjs-code-crafter`; build OK; prueba en vivo: 2 borradores CMO sobre la misma CM se crean, la CM sigue en bandeja, confirmar el 1º OK y sale de bandeja, el 2º → 409; detalle del libro coherente). Revisión RDD aprobada y reconocida (`review-463de5f9f82cd196`); hallazgos solo de falta de tests (no se crean tests, preferencia del usuario). Commit pendiente del OK del usuario.
1. **T6 frontend** (`react-code-crafter`, cargar `vercel-react-best-practices` + `typescript-advanced-types` y pedírselo en el prompt): casilla "Compra oficial (con factura)" + número de factura en el form de CM; formulario de Compra oficial (CMO) con columnas IVA y prefill desde la bandeja; página de bandeja (`GET /documents/official-purchases/pending`); interruptor "Oficial" en `POSCheckoutPage` que cambia el tipo a POSO (sin saldos a favor, sin chequeo de stock); página del libro (`GET /official-ledger` + detalle `GET /official-ledger/products/:productId`); navegación y `isPriceBasedType` del frontend incluyendo POSO.
2. **T7** `frontend/CLAUDE.md`.
3. **Mostrar al usuario archivos y líneas tocadas antes de cada commit** y esperar su OK (feedback 2026-10-05).
4. ~~Revisión RDD del backend~~ **hecha 2026-10-05**: riesgo medio, consentimiento otorgado por el usuario, 1 lente (reliability) → **aprobada** y reconocida (`review-f1b90bbc0e385193`, authority burned). Próxima base revisada: `bfbb44b`. Hallazgos no bloqueantes (decidir con el usuario si se atienden):
   - WARNING `cmo-effect.strategy.ts:77-85`: dos borradores CMO de la misma CM (creación concurrente, o un borrador abandonado) se bloquean mutuamente con 409 al confirmar y ocultan la CM de la bandeja hasta borrar uno.
   - SUGGESTION `official-ledger.service.ts:133-163`: el detalle por producto corre sus consultas en paralelo sin transacción; un confirm/void entre ellas puede dar saldo inicial y acumulado inconsistentes en esa respuesta.
   - WARNING: sin tests automatizados (IVA, libro). Baseline del repo sin tests; el usuario no quiere archivos de test salvo que los pida.
5. Usuarios deben volver a iniciar sesión para ver los permisos nuevos (seed ya corrido en BD local).
6. PR único (`single-pr`) cuando el frontend esté listo — crear PR solo si el usuario lo pide.
7. Ignorar `.atl/skill-registry.*` (cambios del `gentle-ai sync`, no son del proyecto; no comitear).
- Backend T1–T5 verificado por el writer: `pnpm run build` OK (spot check del parent OK); pruebas en vivo en instancia temporal :3999 todas pasan (CM oficial sin factura 400, CMO IVA 10000+1900, segundo CMO misma CM 409, CMO/POSO sin cambios en inventory/bin_stock/movements/AP/AR, POSO con customerCredits 400, convert→POSO 400, bandeja, libro con saldo negativo, void saca del libro). Lint: 2 errores preexistentes en `documents.service.ts` (no introducidos). Datos de prueba anulados: CM `FV-TEST-001`, CMO 000001, POSO 000001.
