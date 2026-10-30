Descuento en recibo de caja (rama `feat/recibo-caja-descuento`).
Check "Descuento" → motivo + valor; el recibo salda completas sus facturas con pagos + descuento. Excedentes/saldos a favor: aparte, en `odd/backlog/recibos-descuento-y-excedentes.md`.

## Specs

- S1 "necesito este nuevo desplegable en los recibos de cja, solo va a aparecer si se presiona el check de desceunto que tambien seria nuevo". Motivos (lista fija): Descuento Comercial, Oferta, Donacion, Fidelizacion, Mercancia Extraviada, Castigo de Cartera, Promocion.
- S2 "colocar un input para poner un descuento en valor numerico y que aplique al total del recibo de caja": abonos a facturas = formas de pago + descuento.
- S3 "que quede trazabilidad de como era la deuad origianl cuando fue el decunto y cunato se debio recibir": el recibo guarda la deuda de las facturas antes del recibo, el descuento, su motivo y fecha; el detalle muestra deuda original, descuento (motivo) y recibido.
- S4 "los decunsto no se aplcian en los cobros aprciales sino ene tl toal entonces no hayq eu repartir nada": con descuento, cada factura abonada debe quedar saldada (abono = saldo). Pagos + descuento que dejen saldo pendiente se rechazan. Nunca más del 100% de la deuda.
- S5 "lo de que se pueda aplicar un descuento que mate toda la obligabvvion solo ocurre cunado es por castigo de cartera o mercacia extraviada": solo esos dos motivos permiten recibo con $0 en formas de pago; con los demás, descuento < deuda.

## Tasks

- T1 S1-S5 schema + migración (enum motivo, descuento, deuda original, descuento por línea; CHECK total >= 0) — inline — commit: c037acb ✅
- T2 S2-S5 backend: DTO, validaciones, reparto interno proporcional por línea, idempotencia, pruebas — inline — commit: b92eceb ✅ (fin del slice backend, ~480 líneas)
- T3 S1-S5 frontend: validación del form (inline) + check/desplegable/input y detalle (react-code-crafter) + descuento en historial de la CxC — commit: ver abajo ✅
- T4 S1-S5 verificación + docs CLAUDE.md — inline — commit:

## Log

- L1 (2026-10-30) "necesito este nuevo desplegable en los recibos de cja, solo va a aparecer si se presiona el check de desceunto que tambien seria nuevo y si es esto ocurre en los recibos en alguna parte colocar un input para poner un descuento en valor numerico y que aplique al total del recibo de caja y que quede trazabilidad de como era la deuad origianl cuando fue el decunto y cunato se debio recibir"
- L2 Respuestas: recibo puede ser 100% descuento; motivos fijos; migración confirmada.
- L3 "los decunsto no se aplcian en los cobros aprciales sino ene tl toal entonces no hayq eu repartir nada ... solo ocurre cunado es por castigo de cartera o mercacia extraviada"
- L4 "solo me mencionaron esos entonces dejesmolo asi" (Donación no cubre 100%). "listo de una y obviamente no dejar ir ams alla del 100% de la deuda cierto?"
