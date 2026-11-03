# Saldo a favor: destino facturación / administración

Branch `feat/saldo-favor-destino`. La DVV con motivo saldo a favor elige dónde se usa el saldo; la venta y el recibo de caja filtran por ese destino.

## Specs

- S1: DVV con motivo **saldo a favor**: desplegable "¿Dónde se usa este saldo?", obligatorio y sin opción marcada: "En facturación" (se descuenta en una próxima venta) o "En administración" (se abona a deudas en el recibo de caja).
- S2: DVV con motivo **cambio de producto**: no pregunta, siempre facturación. **Devolución de dinero**: no genera saldo (igual que hoy).
- S3: La venta (modal de saldos a favor) muestra y acepta solo saldos `facturacion`.
- S4: El recibo de caja muestra y acepta saldos `administracion` (excedentes y devoluciones) solo de la misma sucursal; la lista se llama "Saldos a favor" y dice de dónde viene cada uno.
- S5: Saldo de administración amarrado a la sucursal de la DVV, igual que los excedentes.
- S6: El destino no se cambia después; si se eligió mal, se anula la DVV y se hace de nuevo.
- S7: Columna `usable_in` en `customer_credit`; existentes: devoluciones `facturacion`, excedentes `administracion`.
- S8: Pruebas: facturación no se usa en recibo y al revés; otra sucursal no se usa; cambio de producto queda en facturación; saldo a favor sin destino se rechaza.

## Tasks

- [x] T1 (S7): migración — inline, confirmada por el usuario — d60e393
- [x] T2 (S1-S6, S8): backend — reglas inline + nestjs-code-crafter — 8f8b4ee
- [x] T3 (S1, S4): frontend — react-code-crafter — 41ccd72
- [x] T4: CLAUDE.md backend/frontend — en 8f8b4ee y 41ccd72

- [x] T5: renombre excedentes→credits, availableExcedente→availableBranchCredit (back+front) — b418dd5
- [x] T6: mapa de revisión por revisor independiente (gentle-ai-explore); doc vieja de recibos corregida — d00bebf

## Log

- L1 (usuario): "cuando se haga una devolcuin en venta y el motivo sea saldo a favor entonces mostrar un desplegable nuevo con los valores ... si el "origen" es para favtruracion ese saldo se puede usar en facturacion, es decir les aprece el modal como esta actualemtne, si es para administacion entonces a ellos nos les debe aprecer ese saldo y a los de adminstracion al mmomento de ahcer el recibo de caja van a poder utilziar ese saldo!"
- L2 (usuario): sucursal amarrada ("aunque sea del mismo cliente la sucursal tiene independencia"); sin cambio posterior ("Sigo tu recomendacion!").
- L3: plan final aprobado con "listo"; cambio de producto siempre facturación. Mejoras fuera de alcance: botón "Hacer la venta del cambio", listado "cambios sin venta".
- L4: verificado: backend tsc OK, jest 539/539; frontend build OK, vitest 131/131.
- L5 (usuario): "dale" al renombre para que los nombres digan la verdad. Verificado: backend tsc OK + jest 539/539; frontend build OK + 131/131.
