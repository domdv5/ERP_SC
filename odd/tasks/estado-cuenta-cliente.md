# Estado de cuenta del cliente

Contraparte de clientes del estado de cuenta del proveedor (`GET /accounts-payable/suppliers/:supplierId/statement` + `AccountsPayableSupplierStatementPage`). Rama `feat/recibido-por` (sin commits, preferencia del usuario: commitear solo cuando lo pida).

## Specs
- S1 — Endpoint `GET /accounts-receivable/clients/:clientId/statement`, permiso `ar.read`, declarado antes de `GET /:id`. 404 `Cliente no encontrado` si no existe el `Customer`.
- S2 — Respuesta: `{ client: { id, name }, totals: { totalDebt, totalPaid, totalBalance, availableCredit }, receivables: [...todas sus CxC, no solo abiertas, mismo shape que los items de GET /accounts-receivable (con balance)...], credits: [...todos sus CustomerCredit, disponibles y usados, con sourceDocument { id, type, number, date } y applications { id, amount, appliedAt, saleDocument { id, type, number, date } }...] }`. `totalDebt = Σ totalAmount`, `totalPaid = Σ paidAmount`, `totalBalance = totalDebt − totalPaid`, `availableCredit = Σ balance` de créditos `available`. Orden `createdAt desc`.
- S3 — Pantalla "Estado de cuenta del cliente" en `/accounts-receivable/clients/:clientId`, mismo diseño que la del proveedor: tarjetas de totales, tabla de CxC (clic abre el detalle de la CxC), sección de saldos a favor con sus aplicaciones (a qué venta se aplicaron).
- S4 — El nombre del cliente queda en verde y clicable hacia su estado de cuenta en: listado de CxC (como el proveedor en CxP), detalle de la CxC (enlace "Ver estado de cuenta del cliente", como en CxP) y gráfico "¿Quién nos debe más?" de Informes (como el de proveedores).
- S5 — Usuario: "pero cuando me referia a igualar no quiero que sea el mismo icno sino algo que lso represente" / "¿Armamos también el estado de cuenta del cliente?" → "si porfa".

## Tasks
- [x] T1 — Backend: endpoint + service + spec + backend/CLAUDE.md (S1, S2). Route: nestjs-code-crafter.
- [x] T2 — Frontend: tipos, servicio, página, ruta, enlaces en listado/detalle/Informes, frontend/CLAUDE.md (S3, S4). Route: react-code-crafter.
- [x] T3 — Verificación: tests + build backend, tsc frontend, prueba de la API real. Route: inline.

## Log
- L1 (usuario, 2026-10-17): "como que no hay estado de cuneta?" → tras explicar que solo existe para proveedores: "si porfa".
- L2 (evidencia T3, 2026-10-17): backend 169/169 tests, build OK; frontend tsc -b OK. API real: 3 clientes con 200, receivables coinciden con el listado de CxC, totales correctos, credits con applications y saleDocument; id inexistente → 404 "Cliente no encontrado". Customer.id = ThirdParty.id (1:1), así que el enlace desde Informes usa el id correcto. No probado en navegador. Assess RDD: sin evaluación nativa (archivos sin seguimiento), sin review requerido.
- L3 (RDD, 2026-10-17): review-f0e153dfae92c6cd sobre todos los cambios sin commit (45 archivos, lentes risk + reliability) aprobado y acknowledged. Avisos no bloqueantes: receptor inactivo aceptado en CM (cm-effect.strategy.ts:116); cambio de receptor por PATCH sin prueba (documents.service.ts:590); clientId sin validar formato en el controller (respuesta real: 400 "Formato de datos inválido", igual que proveedores); spec del estado de cuenta solo cubre 404 y totales; dos avisos de UI en ThirdPartiesPage.tsx:280 y ThirdPartyForm.tsx:388.
