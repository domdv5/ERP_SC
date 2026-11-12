POS con parte a crédito — una venta de contado donde una parte queda debiendo; esa parte genera una cuenta por cobrar.
Diseño acordado en conversación (2026-11-10); D1-D6 cerradas 2026-11-12. Falta el "dale" de implementación.
Toca dinero (CxC, caja), migración y contrato de la venta: verificación independiente y revisión nativa obligatorias.

## Specs

- S1 — Pedido (verbatim): "que pasa cuando por ejmplo yo me voy a llevar una mercancia por ejmplo de contado, y en las forma de apgo una aprte se va a credito? actualemtne pasa, no pdoria llenar l;a venta como una venta de tipo credito (COT), porque me consumiria stock, el consecutivo etcetc seria como un nueva venta y no es asi soloq ue una parte va a estar en credito y generaia sobre esa aprte una cuenta por cobrar".
- S2 — Solución elegida por el usuario: "agregar una forma de pago en pos por ejemplo, y esa aprte genreia una cuenta por cobrar". COT sigue existiendo para la venta 100% a crédito.
- S3 — Ejemplo: total $500.000, efectivo $300.000 + crédito $200.000 → una sola venta POS, un consecutivo, un movimiento de stock; CxC por $200.000 a nombre del cliente apuntando a esa venta; la caja cuenta $300.000.
- S4 — "Crédito" es una forma de pago más (opción 1, decidida 2026-11-12): valor `credito` nuevo en el enum `PaymentMethod`, guardado en `document_payment` como las demás. Regla del usuario (verbatim): "obicvmante las formas de pago incluyernfo el credito deben dar el totla, obviament e se genrea una cuenta por cobrar por el valor del credito". O sea: la regla de cuadre de hoy no cambia (Σ payments, crédito incluido = total − saldos a favor aplicados) y al confirmar se crea una CxC por el monto de la línea `credito`. Todo informe futuro de plata recibida (cuadre de caja, ventas por forma de pago) excluye `credito`; regla escrita en `backend/CLAUDE.md`.
- S5 — El cupo de crédito del cliente se valida solo contra la parte a crédito, reutilizando `assertCreditWithinLimit` (`documents/helpers/credit.helpers.ts`), en `validateCreate` y de nuevo en `confirm` con el lock del cliente (mismo patrón que COT). Usuario (verbatim): "Y OBVIAMENTE TNEER EN CUENTA LA VALIDACION DEL CUPO DE CREDITO DE LA EPEROSNA! y seria interesanete tambien mostralo como se ahce en credito pero que no sea muy imbasivoi".
- S8 — En el POS el cupo se muestra solo cuando hay una línea "Crédito", en una sola línea compacta bajo esa forma de pago (p. ej. "Cupo disponible: $X"), no el panel grande de 3 columnas de la COT (`pos-checkout/CreditLimitPanels.tsx`). Si el crédito supera el disponible, la línea pasa a rojo con el mensaje y se bloquea confirmar. Reusa la misma consulta de cupo que la COT.
- S6 — Anular un POS con parte a crédito anula también su CxC; se bloquea si la CxC ya tiene abonos de recibos de caja (mismo criterio que COT hoy).
- S7 — POSO (M2) no contempla esta forma de pago. Usuario (verbatim): "en el POSO NO VA ESTA REGLA!!!!! ESA FORMA DE APGO NO SE COMTempla". POSO rechaza una línea `credito` (backend) y su pantalla no la ofrece.

## Decisiones

- D1 — Cerrada (2026-11-12): opción 1, `credito` en el enum. Motivo: hoy ningún informe lee `document_payment` (los de ventas suman `document.total` por tipo, `reports.service.ts:120,233`; no hay cuadre de caja); solo la usan la validación del total y el detalle. Opción 2 (campo `creditAmount`) descartada: más cambios (columna, contrato, regla de cuadre nueva) para cuidar un informe que no existe.
- D2 — Cerrada (2026-11-12): POSO no acepta crédito (S7).
- D3 — Cerrada (2026-11-12): sin permiso nuevo; cualquiera con `document.create.POS` puede usar la línea "Crédito". Motivo: hoy los mismos roles que hacen POS ya hacen COT (`role-permissions.seed.ts:3`), así que un permiso aparte no protegería nada. Si se crea un rol de cajero solo de contado, se agrega entonces. Usuario (verbatim): "D3 SI".
- D4 — Cerrada (2026-11-12): se bloquea si el crédito cubre el 100% (backend rechaza; el frontend lo explica claro: "si todo es a crédito, haz una venta a crédito (COT)"). Usuario (verbatim): "Para mi tendria sentido si bloquear porque si el 100% es a credito pues directamente tendria que ser una venta a credito, eso si infomralo bien en fronted". Sin monto mínimo de pago aparte.
- D5 — Cerrada (2026-11-12): detalle y PDF muestran la diferencia "Pagado: $X / A crédito: $Y". Usuario (verbatim): "Hacer la difreciaini digo yo".
- D6 — Cerrada (2026-11-12): no aplica hoy. Ningún informe separa contado de crédito: "Ventas por vendedor" (`reports.service.ts:223`) suma POS + COT juntos y "Rotación" cuenta unidades; la parte a crédito se ve en Cuentas por cobrar por su CxC. Si algún día se crea un informe contado vs crédito, sale de las líneas de `document_payment` (excluyendo/separando `credito`), no del tipo de documento. Usuario: "D6 NO LO ENTIEDO COMO ESTA CTUALMENTE QUE INFOMRE ES?".

## Tasks

- T1 — S4 — migración manual (workaround de backend/CLAUDE.md) — `ALTER TYPE "PaymentMethod" ADD VALUE 'credito'` — commit: pendiente
- T2 — S3, S4, S5, S7 — nestjs-code-crafter (lógica de cupo y CxC inline primero) — `PosEffectStrategy`: validar cupo sobre la línea `credito`, crear la CxC por ese monto al confirmar; `PosoEffectStrategy` rechaza `credito`; DTO y contrato `backend/src/contracts/documents.ts` — commit: pendiente
- T3 — S6 — nestjs-code-crafter — anulación de POS con CxC (`document-void.service.ts`), bloqueo si hay abonos — commit: pendiente
- T4 — S4, S7, S8, D4 — react-code-crafter — POS: forma de pago "Crédito" en `PaymentLinesField` (solo con cliente con cupo, nunca en M2), línea compacta de cupo, aviso claro si el crédito cubre el 100% ("usa una venta a crédito (COT)"), resumen — commit: pendiente
- T5 — D5 — inline/react-code-crafter — detalle y PDF muestran "Pagado: $X / A crédito: $Y" — commit: pendiente
- T6 — S1-S7 — inline — pruebas (cuadre con crédito, cupo, CxC creada por el monto correcto, POSO rechaza crédito, anulación) y regla "informes de plata recibida excluyen `credito`" en backend/CLAUDE.md — commit: pendiente

## Riesgos

- Dinero: si la CxC sale por otro monto que la línea `credito`, el cliente debe más o menos de lo real. Prueba: CxC = monto de la línea `credito`.
- Informe futuro de caja que sume `document_payment` sin excluir `credito`: reportaría plata que no entró. Se mitiga con la regla en backend/CLAUDE.md y una prueba en ese informe cuando exista.
- Migración (valor nuevo en el enum): seguir el workaround manual; nunca `migrate reset`. En Postgres el valor nuevo de un enum no se puede usar en la misma transacción que lo crea.
- Contrato de la venta cambia (valor nuevo en la lista de formas de pago): ajustar contrato, backend y frontend en el mismo PR.
- Concurrencia del cupo: dos ventas con parte a crédito del mismo cliente a la vez no deben superar el cupo entre las dos (usar el mismo `FOR UPDATE` del cliente que COT).

## Log

- L1 — Usuario (2026-11-10): pedido de S1 (acotación de una reunión al mostrar las ventas).
- L2 — Se propuso COT con abono inicial; usuario: "pero una momento en sintesis no es un cot, no? no seria mas confuso?" → se cambió la recomendación a POS con forma de pago crédito.
- L3 — Usuario: "por eso, entonces piendo yo qu ela mejor solcuion es agregar una forma de pago en pos por ejemplo, y esa aprte genreia una cuenta por cobrar no?" → acuerdo; se explicó opción 1 vs 2 con el ejemplo de $500.000.
- L4 — Usuario: "guardemos tambien este plan para otra sesion!"
- L5 — Usuario (2026-11-12): "pero no entiendo es si se pone credito, donde se rompe o que informe? no bastaria simplemnete con un filtro a al hora de un informe o algo asi por el estilo, no dejar de ser otra forma de apgo" → revisado el código: ningún informe lee `document_payment`; la recomendación cambia a opción 1.
- L6 — Usuario (2026-11-12): "dale actualziado y me lo muestras, una calridad obicvmante las formas de pago incluyernfo el credito deben dar el totla, obviament e se genrea una cuenta por cobrar por el valor del credito, en el POSO NO VA ESTA REGLA!!!!! ESA FORMA DE APGO NO SE COMTempla" → D1 y D2 cerradas, S4 reescrita, S7 nueva.
- L7 — Usuario (2026-11-12): "D3 no entienod la pregunta / D4 Para mi tendria sentido si bloquear porque si el 100% es a credito pues directamente tendria que ser una venta a credito, eso si infomralo bien en fronted / D5 Hacer la difreciaini digo yo" → D4 y D5 cerradas; D3 re-explicada.
- L8 — Usuario (2026-11-12): "Y OBVIAMENTE TNEER EN CUENTA LA VALIDACION DEL CUPO DE CREDITO DE LA EPEROSNA! y seria interesanete tambien mostralo como se ahce en credito pero que no sea muy imbasivoi" → S5 confirmada, S8 nueva.
- L9 — Usuario (2026-11-12): "D3 SI" → D3 cerrada con la opción recomendada (sin permiso nuevo).
- L10 — Usuario (2026-11-12): "D6 NO LO ENTIEDO COMO ESTA CTUALMENTE QUE INFOMRE ES?" → revisado el código: ningún informe separa contado/crédito; D6 cerrada como "no aplica".
