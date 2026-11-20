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

- [x] **T1** (S2-S4) backend: validación completo-o-nada en los 3 flujos + pruebas — route parent — commit: 8b76b1b
- [x] **T2** (S2, S5) frontend: regla en `lib/credit-application.ts` (parent) + casillas en POS, recibo, egreso (`react-code-crafter`) — commit:
- [x] **T3** verificación (mutación, tsc, jest, vitest; pantalla pendiente del dueño) — route parent — evidencia L2, L4-L6

## Log

- **L1** (2026-11-20) Pedido original: ver S1. Ante la pregunta de qué hacer si el saldo es mayor que lo pagado (a: bloquear, b: sobrante como saldo nuevo, c: devolver), el dueño eligió "la a". Plan aprobado con "dale".
- **L2** T1: RED 4 pruebas nuevas fallando; GREEN jest 751/751, tsc 0. Mutación (`!==` → `>`) en POS helper, recibo y egreso: las 3 DETECTADAS por sus pruebas "rechaza usar (solo) una parte". Código restaurado.
- **L3** T2 regla frontend (parent): `canUseCredit`, `suggestCreditAmounts` completo-o-nada, `keepCreditsWithinTotal` (reemplaza `limitCreditsToTotal`), `limitCreditAmount` eliminado. vitest 15/15 en `credit-application.test.ts`.
- **L4** Verificación independiente backend (gentle-ai-verify): S2, S3, S4 cumplidos; ninguna otra ruta aplica saldos con monto elegido; replays idempotentes viejos devuelven el documento guardado sin revalidar (correcto). Pruebas sugeridas agregadas (mismo saldo en dos líneas; saldo usado en parte en egreso FIFO): commit 237d1a3, jest 753/753.
- **L5** T2 pantallas (react-code-crafter): casilla "Usar saldo" en POS, recibo y egreso; tsc 0, vitest 248. Mutaciones frontend: canUseCredit DETECTADA; schema recibo DETECTADA; schema egreso NO DETECTADA → agregada egreso-form.schema.test.ts, ahora DETECTADA. 61 archivos solo con cambio de fin de línea restaurados. Verificación independiente frontend en curso.
- **L6** Verificación independiente frontend: S2, S3 (contrato), S5 cumplidos por código; ningún camino envía monto parcial. Corregido el Bajo: schemas de recibo/egreso comparan en centavos como el backend (+prueba 2000.4 vs 2000). vitest 251, tsc 0. Pantalla NO verificada (verificador sin navegador). Medio declarado: en recibo, si un saldo marcado cambia de valor al recargar, el monto se ajusta sin aviso y el cuadre falla hasta corregir las formas de pago.
