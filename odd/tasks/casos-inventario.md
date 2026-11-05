# Casos de diferencias de inventario

Cada línea de una EAI con motivo "negativo" abre un caso. Un encargado lo investiga con las pistas del kardex y lo cierra con una causa de una lista y una justificación.
Rama: `feat/casos-inventario`. Mockups aprobados: `design/diferencias-inventario/` (01 flujo, 02 bandeja, 03 detalle, 04 informe).

## Specs

- **S1** Al confirmar una EAI con `adjustmentReason = negativo`, se crea un caso abierto por cada línea, en la misma transacción. Guarda producto, bodega, cantidad y stock antes → después (del kardex). Usuario: "el ajsute se ahce pero queremos lelgar al fondo del asunto".
- **S2** No abren caso: la SAJ ("basicamente se usa para sacar una unidadesd e un codigo y meterals en otr, o si por ejemplo me equivoque en el ajsute"), las EAI con motivo `inventario_general`, `traspaso_costo` u `otro`, ni las EAI confirmadas antes de que salga esta funcionalidad.
- **S3** La nota de la EAI sigue opcional. Usuario: "la calisifcacion ya da el motiuvo [...] no sabria que poenr en esas notas!". El caso muestra la nota solo si existe.
- **S4** Bandeja "Diferencias de inventario" con contadores (abiertos, cerrados este mes, días promedio para cerrar) y filtros (estado, bodega, rango de fechas, búsqueda por producto). Columnas: N° caso, fecha del ajuste, código, producto, marca, bodega, stock del sistema antes → después (+n), documento EAI, quién ajustó, fecha de cierre, días abierto, estado. Usuario: "me ahce falta la columan del codigo, la amrca", "me haria falta tambien la fecha enq ue se cerro el caso!", "pero no simepre va a ser 0, osea pude que haya 20 y le tegna 30".
- **S5** El detalle del caso muestra "Lo que pasó antes del ajuste": los últimos movimientos del kardex de ese producto en esa bodega antes de la EAI, con documento, tipo, cantidad, stock antes → después y usuario.
- **S6** EloSC sugiere un "posible origen": la salida más reciente antes del ajuste que sacó la misma cantidad ajustada. Es solo una sugerencia: el encargado puede marcar otro documento del kardex o ninguno.
- **S7** Cerrar un caso exige una causa de la lista y una justificación. Causas: venta facturada con otro producto, traslado no registrado o mal registrado, compra mal digitada, devolución no registrada, error en conteo, pérdida o faltante, otro. Se guarda quién cerró y cuándo.
- **S8** Un caso cerrado solo lo reabre el admin, y queda registrado quién lo reabrió y cuándo.
- **S9** Al anular una EAI, sus casos abiertos se cierran solos con la causa "Ajuste anulado".
- **S10** Informe de causas: periodo, ranking de causas, casos por bodega, productos con más casos, y unidades y costo aproximado de lo ajustado.
- **S11** Permisos: ver casos, cerrarlos y reabrirlos. Rol nuevo "Encargado de inventario" que ve y cierra; el admin tiene todo. El encargado ve solo los documentos que mueven inventario (compras, ventas, devoluciones, traslados y ajustes; no facturas de compra/venta, preventas ni tesorería). Cambia el seed de RBAC (Safety Rule, confirmada con el "dale" del 2026-11-05).
- **S12** Sin SSE ni WebSockets: el caso se crea en la transacción del confirm, y el front lo ve al recargar o volver a la pestaña. Contador de casos abiertos en el menú.
- **S13** Dos bodegas reales: Almacén (vende) y Bodega (solo almacena). Sin tallas.

## Tasks

- [x] T1 S1,S7,S8,S9 — Schema `InventoryCase` + enums + migración aditiva (workaround manual). Route: inline. Commit: 3bf99cf (aparte, riesgo: migración).
- [x] T2 S11 — Permisos + rol "Encargado de inventario" en el seed. Route: inline. Commit: aeb3fae (aparte, riesgo: RBAC). Agrega inventory_case.read a SEE_ALL_PERMISSIONS.
- [x] T3 S1,S2,S9 — Crear casos al confirmar una EAI por negativo; cerrarlos al anularla. Pruebas. Route: inline (lógica de negocio). Commit: —
  Hecho (sin commit aún): `EaiEffectStrategy` crea/cierra casos; pruebas en `eai-effect.strategy.spec.ts` (7) en verde.
- [x] T4 S4-S8,S10,S12 — Módulo `inventory-cases`: bandeja, detalle con pistas y posible origen, cerrar, reabrir, informe, contador. Pruebas y backend/CLAUDE.md. Route: inline (posible origen) + nestjs-code-crafter (scaffolding). Commit: —
  Hecho (sin commit aún): módulo `inventory-cases` con contrato; 33 pruebas en `inventory-cases.service.spec.ts`, suite completa en verde.
- [ ] T5 — PR backend con mapa de revisión independiente. Commit: —
- [x] T6 S3-S8,S10,S12,S13 — Frontend: bandeja, detalle con cierre, informe, ítem del menú con contador. frontend/CLAUDE.md. Route: react-code-crafter. Commit: —
  Hecho (sin commit aún): `pages/inventory-cases/` (bandeja, detalle con cierre/reapertura, informe) + ítem del menú con contador; `npm run build` y Vitest en verde.
- [ ] T7 — PR frontend con mapa de revisión independiente. Commit: —

## Log

- **L1** (2026-11-05, pedido original) "vale, ahora necesito una especie de funcionalida, haber te comento lo mas importnate que tiene una empresa es el inventario estamos de acuerdo? entonces obviamente cuando algo pasa con respecto a este por ejemplo un negativo, es decir tengo la prenda fisicamente pero en el sistema no, entonces se ahce ese ajuste por EAI y listo, pero queremo llegar al fondo del asunto del porque se llego a ese punto, no puedo poner a esperar al cleinte mientra resuelov porque no se su culpa ,e ntonces igual el ajsute se ahce pero queremos lelgar al fondo del asunto, entonces en la empresa va aa haber una eprsona encargada de esto, entonces yo pensaba como mostrarle una especi de infomra donde le mustre los ajsutes que se hicieron en un determinado tiempo, que producto, fue , fecha etc etc etc, y que el pueda cerrarlos con algiuna  jsutidficaciond e porque se tuvo que ahcer en su momento ese ajsute, como una especie de casos quie tiene que cerrar algo asi es mi idea, pero poresnetame otra 2 0 3 para ver que se peud ehacer a nivel de sistema"
- **L2** Elegida la opción B (casos con pistas automáticas). Mockups revisados con comentarios: sin tallas, columnas código/marca, fecha de cierre, stock antes → después, 2 bodegas.
- **L3** Decisiones 1-9 aprobadas ("asi esta bien!"); los mapas de revisión en cada PR ("y tener en cuenta el mapa"); arranque con "dale".
- **L4** ajuste_anulado excluido de contadores e informe y no reabrible ("dale")
- **L5** Visibilidad del encargado: solo tipos que mueven inventario (respuesta "2"); endpoint de bodegas para el filtro.
