# Correcciones de la reunión (2026-10-22)

Bugs y ajustes encontrados por el usuario en una reunión. Se arreglan en la rama `fix/meeting-bugs`; los commits se deciden con el usuario al final.

## Specs

- S1 — "cuando se crea una factura con negativos no arpece inmediante en el lsitado sino que se tiene que recargar"
- S2 — "necesito es que en la remision la fecha seleccioanda sea la del dia actual y no se puda modificar!" Decisiones: bloqueo en frontend y backend; un borrador viejo queda con la fecha del día en que se confirma; aplica a REM y a las ventas POS/COT. Incluye el bug de `TODAY` calculado en UTC (después de las 7 p. m. hora Bogotá queda el día siguiente).
- S3 — "MOSTRAR LA FECHA LA HORA, MINURTOS,SEGUNDO DE CUANDO FUE PISTOLEADO EL PRODUCTOS" / "es en cada producto que se agrega ... no una sola fecha en general sino por cada producto". Decisiones: se ve en el carrito; POS, POSO, COT, REM, DVV; si se pistolea de nuevo, la última vez; agregado a mano también lleva hora; columna NOT NULL (BD de desarrollo); se guarda el instante (`TIMESTAMPTZ`) y el frontend lo formatea; la regla vive en la clase abstracta de las estrategias.
- S4 — refactor: pasar `BRANCH_TYPES` (y la regla de fecha fija) a la estrategia, como la hora del pistoleo.
- S5 — "todos los documentos actualmente en el listado deben tener la persona que lo creó, que lo confirmó, que lo editó si el caso lo permite, y la fecha con la hora, ya que actualmente solo está la fecha". Decisiones: una columna Historial apilada; la columna Fecha queda igual; también quién anuló; documentos viejos rellenados con updatedAt.

## Tasks

- T1 — S1: invalidar el listado cuando la confirmación del POS falla (el borrador ya existe). Route: inline. Commit: 391fc31
- T2 — S2 backend: fecha de REM/POS/COT forzada a hoy Bogotá al crear, editar y confirmar. Route: inline. Commit: 22f78aa ✅ (221 tests, build, API dev)
- T3 — S2 frontend: fecha de REM de solo lectura; "hoy" en hora Bogotá en todos los formularios. Route: inline. Commit: (commit de frontend) ✅ (tsc; sin prueba en navegador)
- T4 — S3 backend: columna `added_at` + `resolveItemAddedAt` en `BaseEffectStrategy`. Route: inline. Commit: e1b2b07 (migración) + 22f78aa ✅ (236 tests, build, API dev)
- T5 — S4 backend: `tracksCustomerBranch`/`usesTodayDate` en las estrategias; arregla la clave contra duplicados con fecha fija. Route: inline. Commit: 22f78aa ✅
- T6 — S3 frontend: columna "Hora" en el carrito (POS y formulario REM/DVV), guardar y reenviar `addedAt`. Route: react-code-crafter (decisión de cuándo marcar la hora: inline). Commit: (commit de frontend) ✅ (tsc; sin prueba en navegador)
- T7 — S5 backend: confirmedAt/editedAt/voidedAt + quién en el listado (rama feat/document-history). Route: inline. Commit: ver Log ✅ (245 tests, API dev)
- T8 — S5 frontend: columna Historial en DocumentsPage. Route: react-code-crafter. Commit: ver Log ✅ (tsc, captura del listado)

## Log

- L1 (usuario): "te voy a pasar una serie de bug y correciones que me ecnotra en una reunion entonces te las voy a psar y entonces decidimos en cuentos commits van"
- L2 (usuario): "1- cuando se crea una factura con negativos no arpece inmediante en el lsitado sino que se tiene que recargar" / "arregalo" / prueba en navegador: "dejalo asi mejor"
- L3 (usuario): "una pregunta la ventas pos y cot no tiene fecha ?" → "necesito es que en la remision la fecha seleccioanda sea la del dia actual y no se puda modificar!" Respuestas: frontend y backend; la del día de confirmar; REM y ventas POS/COT.
- L4 (evidencia, 2026-10-22): backend 221/221 tests + build; frontend tsc OK. API dev: REM create(2026-01-05) y update(2026-02-10) → 2026-10-22; PV conserva 2026-01-05 / 2026-02-10; borrador REM movido a 2026-10-01 en BD → al confirmar queda 2026-10-22. Documentos de prueba borrados o anulados.
- L5 (usuario): "MOSTRAR LA FECHA LA HORA, MINURTOS,SEGUNDO DE CUANDO FUE PISTOLEADO EL PRODUCTOS"; respuestas: carrito; última vez; agregado manual con hora; "POS, POSO, COT, REM, DVV"; "eso no puede quedar null y recuerda que estamos en una base de datos de DESARROLLO, me imagino que el método va a quedar en la clase abstracta"; "guardemos el timestamp tal cual dijiste tú ... hagamos ese refactor".
- L6 (evidencia): migración aplicada en dev (250 ítems con added_at = created_at); 236/236 tests + build; API dev: REM guarda addedAt del carrito al crear y editar, "ayer" → 400 sin cambiar el dato, PV usa hora del servidor. Bug encontrado y corregido: la clave contra duplicados comparaba la fecha del pedido en tipos con fecha fija.
- L7 (usuario): "me gustaría mostrar en pos y poso, cot la fecha actual" / "que sea de solo lectura". Hecho: campo Fecha de solo lectura en "Datos de la venta" (POSCheckoutPage, sirve a POS/POSO/COT). Pendiente decidir: `usesTodayDate` en POSO (backend).
- L8 (usuario): quitar el aviso "Venta oficial: los precios se digitan sin IVA, no se valida ni se descuenta stock y no aplica saldo a favor del cliente." / "sí actívalo" → `usesTodayDate = true` en POSO.
- L9 (usuario): "si dale" → commits: 391fc31 fix POS, e1b2b07 migración, 22f78aa backend, y el de frontend que cierra la feature.
- L10 (usuario): "todos los documentos actualmente en el listado deben tener la persona que lo creó, que lo confirmó, que lo editó si el caso lo permite, y la fecha con la hora, ya que actualmente solo está la fecha". Respuestas: Historial apilado; Fecha igual; sí anuló; rellenar con updatedAt.
- L11 (evidencia): migración aplicada en dev (156 confirmados, 13 editados, 57 anulados rellenados); 245/245 tests; API: PV creado→editado→confirmado→anulado muestra cada persona y hora en GET /documents.
- L12: commits 0f26e91 (migración), b93fc2a (backend) y el de frontend que cierra el ítem.
