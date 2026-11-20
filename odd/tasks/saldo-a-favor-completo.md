# Saldo a favor completo o nada

Un saldo a favor (cliente o proveedor) se aplica por todo su disponible o no se aplica, en venta POS/COT, recibo de caja y egreso.
Rama `feat/saldo-a-favor-completo`. Sin migración ni cambios de contrato.

## Specs

- **S1** — Pedido: "los saldos a favor que se usna en ventas, ceuntas por pgar y cobrar, creo que no hay otro modulo mas, actualemnte se puede usar todo o una parte de el y la tora en otra ocasion, eso va a acmaiar apartir de ahora es usar todo el saldo o no usarlo! que no permita el sistema dividir ese saldo"
- **S2** — Si el saldo es mayor que lo que se paga: opción "a" del dueño ("la a") — no se deja aplicar.
- **S3** — Backend (POS/COT, recibo de caja, egreso): monto aplicado distinto del disponible → 400 "El saldo a favor se usa completo o no se usa. Saldo disponible: X", sin cambiar datos. Igual al disponible → se aplica y el saldo queda en 0 `used`.
- **S4** — Saldos ya usados en parte siguen usables por todo lo que les queda (`balance`, no `amount`).
- **S5** — Frontend (POS, recibo, egreso): el monto editable de cada saldo pasa a casilla "Usar saldo" que aplica el disponible completo; deshabilitada con "Saldo mayor que lo pendiente" si el saldo supera lo que falta. Se quitan los topes de monto parcial y "Usar lo que falta".

## Tasks

- [ ] **T1** (S2-S4) backend: validación completo-o-nada en los 3 flujos + pruebas — route parent — commit:
- [ ] **T2** (S2, S5) frontend: casillas en POS, recibo, egreso + pruebas — route `react-code-crafter` — commit:
- [ ] **T3** verificación (mutación, tsc, jest, vitest, pantalla) — route parent — evidencia en Log

## Log

- **L1** (2026-11-20) Pedido original: ver S1. Ante la pregunta de qué hacer si el saldo es mayor que lo pagado (a: bloquear, b: sobrante como saldo nuevo, c: devolver), el dueño eligió "la a". Plan aprobado con "dale".
