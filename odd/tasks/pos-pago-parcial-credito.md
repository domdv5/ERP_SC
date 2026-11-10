POS con parte a crédito — una venta de contado donde una parte queda debiendo; esa parte genera una cuenta por cobrar.
Diseño acordado en conversación (2026-11-10), sin "dale" todavía: arrancar en otra sesión y cerrar primero las decisiones abiertas (abajo).
Toca dinero (CxC, caja), migración y contrato de la venta: verificación independiente y revisión nativa obligatorias.

## Specs

- S1 — Pedido (verbatim): "que pasa cuando por ejmplo yo me voy a llevar una mercancia por ejmplo de contado, y en las forma de apgo una aprte se va a credito? actualemtne pasa, no pdoria llenar l;a venta como una venta de tipo credito (COT), porque me consumiria stock, el consecutivo etcetc seria como un nueva venta y no es asi soloq ue una parte va a estar en credito y generaia sobre esa aprte una cuenta por cobrar".
- S2 — Solución elegida por el usuario: "agregar una forma de pago en pos por ejemplo, y esa aprte genreia una cuenta por cobrar". COT sigue existiendo para la venta 100% a crédito.
- S3 — Ejemplo: total $500.000, efectivo $300.000 + crédito $200.000 → una sola venta POS, un consecutivo, un movimiento de stock; CxC por $200.000 a nombre del cliente apuntando a esa venta; la caja cuenta $300.000.
- S4 — En pantalla el cajero ve "Crédito" como una línea más de forma de pago. Por dentro (opción 2 recomendada, pendiente de confirmar): campo aparte en la venta (p. ej. `creditAmount`), `payments` sigue teniendo solo la plata recibida; regla de cuadre: Σ payments + creditAmount = total. Motivo: todo lo que hoy suma `payments` (caja, informes, libro de facturas) sigue correcto sin tocarlo. Descartada opción 1 (valor "crédito" en el enum de formas de pago): haría contar el crédito como plata recibida en cada lugar que suma `payments`.
- S5 — El cupo de crédito del cliente se valida solo contra la parte a crédito, reutilizando `assertCreditWithinLimit` (`documents/helpers/credit.helpers.ts`), en `validateCreate` y de nuevo en `confirm` con el lock del cliente (mismo patrón que COT).
- S6 — Anular un POS con parte a crédito anula también su CxC; se bloquea si la CxC ya tiene abonos de recibos de caja (mismo criterio que COT hoy).

## Decisiones abiertas (preguntar al retomar)

- D1 — Confirmar opción 2 (campo aparte) vs opción 1.
- D2 — M2 (POSO): propuesta = sigue solo de contado (hoy fuerza contado). Confirmar.
- D3 — Quién puede usar la parte a crédito: cualquiera con `document.create.POS` o un permiso aparte (como hoy COT con `document.create.COT`).
- D4 — ¿Monto mínimo de pago en el momento? ¿Se bloquea si la parte a crédito es 0 o el 100%? (100% crédito → usar COT).
- D5 — ¿Detalle y PDF muestran "pagado: $X / a crédito: $Y"?
- D6 — Informes de ventas: hoy contado = POS; decidir si separan contado/crédito por monto en vez de por tipo de documento.

## Tasks

- T1 — S4 — prisma-db-architect + migración manual (workaround de backend/CLAUDE.md) — columna para el monto a crédito en la venta — commit: pendiente
- T2 — S3, S4, S5 — nestjs-code-crafter (lógica de cupo y cuadre inline primero) — `PosEffectStrategy`: cuadre Σ payments + crédito = total, validar cupo sobre la parte a crédito, crear la CxC al confirmar; contrato `backend/src/contracts/documents.ts` — commit: pendiente
- T3 — S6 — nestjs-code-crafter — anulación de POS con CxC (`document-void.service.ts`), bloqueo si hay abonos — commit: pendiente
- T4 — S4 — react-code-crafter — POS: línea "Crédito" en formas de pago (solo con cliente con cupo), aviso de cupo, resumen — commit: pendiente
- T5 — D5, D6 — inline/react-code-crafter — detalle, PDF e informes según lo decidido — commit: pendiente
- T6 — S1-S6 — inline — pruebas (cuadre, cupo, CxC creada por el monto correcto, caja no cuenta el crédito, anulación) y CLAUDE.md — commit: pendiente

## Riesgos

- Dinero: si el cuadre o la CxC salen mal, el cliente debe más o menos de lo real, o la caja reporta plata que no entró. Por eso la opción 2 y pruebas de "la caja no cuenta el crédito".
- Migración de base de datos (columna nueva): seguir el workaround manual; nunca `migrate reset`.
- Contrato de la venta cambia (campo nuevo): ajustar contrato, backend y frontend en el mismo PR.
- Concurrencia del cupo: dos ventas con parte a crédito del mismo cliente a la vez no deben superar el cupo entre las dos (usar el mismo `FOR UPDATE` del cliente que COT).

## Log

- L1 — Usuario (2026-11-10): pedido de S1 (acotación de una reunión al mostrar las ventas).
- L2 — Se propuso COT con abono inicial; usuario: "pero una momento en sintesis no es un cot, no? no seria mas confuso?" → se cambió la recomendación a POS con forma de pago crédito.
- L3 — Usuario: "por eso, entonces piendo yo qu ela mejor solcuion es agregar una forma de pago en pos por ejemplo, y esa aprte genreia una cuenta por cobrar no?" → acuerdo; se explicó opción 1 vs 2 con el ejemplo de $500.000.
- L4 — Usuario: "guardemos tambien este plan para otra sesion!"
