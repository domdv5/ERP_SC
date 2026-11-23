# Cuadre de plata (pendiente, otra sesión)

Revisión de solo lectura que compara los totales guardados de plata con la suma real de sus movimientos y avisa al admin. Estado: **diseñado, sin empezar** (2026-11-23).

## Specs

- **S1** — Compara `accounts_receivable.paid_amount` vs Σ abonos reales (recibo_caja_allocation de recibos no anulados + receivable_payments viejos); `accounts_payable.paid_amount` vs Σ egreso_allocation de egresos no anulados + payable_payments; `customer_credit.balance` / `supplier_credit.balance` vs `amount` − Σ aplicaciones. Fórmula exacta se afina al implementar.
- **S2** — Una sola función `revisarCuadre()` con dos disparadores: tarea nocturna (2:00 a.m., `@nestjs/schedule`) y botón manual "Revisar ahora".
- **S3** — Guarda cada corrida (tabla nueva, ej. `money_check_run`: fecha, origen noche/botón, cuántas revisó, diferencias) para ver el historial.
- **S4** — Pantalla de admin con el último resultado y aviso al entrar si la última corrida encontró diferencias.
- **S5** — Solo avisa, nunca corrige: el arreglo se decide a mano.
- **S6** — Permiso nuevo (ej. `money.check`) solo para admin.

## Pendiente de confirmar por el dueño (Safety Rules / dependencias)

- Agregar dependencia `@nestjs/schedule`.
- Migración: tabla de resultados.
- Seed RBAC: permiso nuevo (Safety Rule: los JWT ya emitidos no lo traen hasta re-login).

## Contexto

- Sin servidor de producción, la tarea nocturna no corre (el backend solo vive en la máquina de dev); queda lista para cuando haya servidor. Mientras tanto sirve el botón.
- Alternativa evaluada y descartada por ahora: no guardar `paidAmount` y calcularlo siempre (~15 lugares de lectura de plata a rehacer, `status` también guardado). Camino si aparece un descuadre real: una VIEW de saldos.

## Log

- L1 — Dueño: "pero entonces para ese cript, no seria mejor un cornjob que se haga cada noche o que se pueda activar de forma manual cunado se encesite?"
- L2 — Dueño: "dejemoslo anotado para en otra sesion y sigmaos con las mas chicas"
