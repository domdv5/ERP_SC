# Egresos y Recibos de caja con el mismo diseño

Solo frontend (crear, lista, detalle). Cambia el diseño, no las reglas de dinero; backend sin cambios. Rama `feat/egresos-recibos-same-design`.

## Specs
- S1 (A1): Cuadre de formas de pago igual en las dos: una fila "Falta por pagar" / "Falta por cobrar" o "Sobra" (patrón de Recibos), en lugar del texto rojo "Las formas de pago deben sumar X" de Egresos.
- S2 (A2): Mismo bloque de desglose en el resumen: Deuda → Descuento (solo recibos) → Saldo a favor → Total.
- S3 (A3): Errores al lado del campo (inline) en las dos, no solo toast.
- S4 (A4): Un solo `ConfirmDialog` compartido (hoy copiado en los dos archivos).
- S5 (A5): En la lista de Recibos, el nombre del cliente enlaza a su estado de cuenta (como el proveedor en Egresos).
- S6 (A6): Recibos no dice "Deben sumar $0": si el saldo a favor/descuento cubre todo, mismo texto que Egresos ("El saldo a favor cubre el total — no hace falta forma de pago").
- S7 (A7): Diálogo de Recibos: "de credits aplicados" → "de saldo a favor aplicado".
- S8: "Reparto (vista previa)" se quita de Egresos; ninguna de las dos la tiene.
- S9: Saldo a favor igual en las dos: tabla (Fecha · Origen · Saldo · Usar en este egreso/recibo) con botón "Usar todo", empieza en 0. Egresos deja de llenarse solo (hecho por el dueño en `useEgresoForm.ts`).
- S10: Quedan distintos a propósito: sucursal, descuento y "Registrar excedente" solo en Recibos; columnas "Formas de pago / Saldo a favor" de la lista solo en Egresos; filtro `usableIn === 'administracion'` de Recibos; abono = saldo completo al marcar con descuento activo.
- S11: Pruebas solo de reglas (hábito 7 del CLAUDE.md raíz): topes de "Usar todo", saldo arranca en 0, cuadre Falta/Sobra, reparto y validaciones. Se borran las pruebas de textos, columnas y orden del desglose.

- S12: Recibos guarda el reparto del saldo a favor por CxC igual que egresos: CxC más antigua primero, saldo más antiguo primero, sobre lo que queda de cada CxC tras su descuento (descuento sigue proporcional). Columnas nuevas opcionales `ReciboCajaAllocation.creditAmount` y `CustomerCreditApplication.accountReceivableId`; unique pasa a [customerCreditId, reciboCajaId, accountReceivableId]. Recibos viejos: null → "—" (sin backfill).
- S13: Lista de recibos devuelve dinero recibido (`total`), saldo a favor (Σ aplicaciones) y descuento; detalle devuelve por CxC `creditAmount` y por aplicación origen (kind, sourceDocument, fecha: DVV usa la fecha de la DVV) y CxC aplicada.
- S14: Detalle de egresos y recibos: bloque "Cuadre" (abonado − descuento − saldo = dinero) y "Saldos a favor usados" agrupado por saldo con "↳ Aplicado a <CxC>". Columna "Dinero pagado"/"Dinero recibido".

## Tasks
- T1 [S9] lógica: Egresos sin propuesta automática de saldo a favor (dueño) — commit: pendiente
- T2 [S1-S8, S9 UI] maquetación de crear/lista/detalle + pruebas — react-code-crafter — commit: pendiente

- T3 [S12] backend: schema + reparto al crear recibo (dueño, escrito) + migración + pruebas de la regla — PR1 rama feat/recibos-credit-split — commit: pendiente
- T4 [S13] backend: contratos y consultas de lista/detalle de recibos + pruebas — PR1 — commit: pendiente
- T5 [S14, S1-S11] frontend: 6 pantallas según `design/egresos-recibos/` — PR2 rama feat/egresos-recibos-same-design — commit: pendiente

## Log
- L1 (2026-11-13): "lo que si quiero es que hay una conrcondia entre el dinseño de egresos y recibos de cja, obivmante cada uno tineie datos diferetnes pero el dinseo la idea es que sea homomgeno y solo cambie la logica de cad uno por ejmlpo, en egresos hay un columan que se llama reparto (vista previa) y en recibos de cjaa no"
- L2: Respuestas: Reparto → "Quitarla de Egresos"; Saldo a favor → "Tabla + 'Usar todo', empieza en 0". Plan A1–A7 aprobado con "dale".
- L3 (2026-11-13): "creo que no me etnedite bien lo que queri, osea haz una explocraion bioen, miras las columans que tiene el lsitaod de recibos de caja y la de egreso, por ejm,plo egresos tine formas de apgo, recibvos cde cjad, entonces no tineie sentido porque son 2 diseNos difetents, ovibamente la infromacion es difernete pero el diseNo debe de ser homogeneo en cuanto lo pemrita, mira el diseño de salsdo  favor de uno y el otro no tiene nda que r ver, entonces volvemos a lo mismo 2 diseNos difertnes ye so no em gusta yo quiero algo profesionla con rigor no simplemente algo vibecodeado que cauqleuiroi peuder hacer y lod eja asi porqeu fucniona, siente en la liebrtad de preguntarme lo que hagal falta para cerrar el dinse" — Aclaración: "cuando se aplica un saldo a favor en egreso o en recibo de caja una vez se confirma vuelves y entras y el diseño no tiene nada que ver uno con el otro".
- L4: Decisiones: Lista = mismas columnas completas (Número · Fecha · Tercero · [Sucursal recibos] · En dinero · Saldo a favor · [Descuento recibos] · Total; backend recibos). Detalle = reparto por factura en las dos (En dinero · Saldo a favor · [Descuento]; backend recibos). Saldos a favor usados = Origen enlazado + Fecha + Monto en las dos (backend recibos). Anular/PDF = otro trabajo. Diseño se aprueba en maqueta (design/) antes de código. Trabajo sin commitear de la rama (crear unificado) queda como base.
- L5 (2026-11-13): Maqueta en `design/egresos-recibos/` (01-lista-egresos, 02-lista-recibos, 03-crear-egreso, 04-crear-recibo, 05-detalle-egreso, 06-detalle-recibo) y `design/system.md` resincronizado con `frontend/src/index.css`. Pendiente de aprobación del dueño.
- L6 (2026-11-13): "cuado se acceda al detllae que quede claro como un reusmen de lo que suma y resta y el valro total, porque en el detalle esta suelto y puede llegar a confunidr" — 05/06: tarjetas sueltas reemplazadas por un bloque "Cuadre" (Cuentas abonadas − Descuento − Saldo a favor = Dinero pagado/recibido). Pendiente: decisión del reparto por factura en Recibos (opciones 1/2/3).
- L7 (2026-11-13): "en esa capture que te mostra tmapoco es calro que ese saldo a favor esd uno solo es como si fueran 2 diferttnes y no se sae que ahyq que sumarlo para que den los 55, y en cuntao a tu pregunta,entonces la opcion 1" — "Saldos a favor usados" agrupado por saldo (una fila con el total) y debajo "↳ Aplicado a <factura> $monto". Reparto por factura en Recibos: opción 1 = guardar desde ahora (FIFO, igual que Egresos) en columna nueva `ReciboCajaAllocation.creditAmount`; recibos viejos muestran "—" (sin backfill). Requiere migración (Safety Rule: confirmación aparte).
- L8 (2026-11-13): "dale" al plan: PR1 backend (guardar reparto como egresos, migración confirmada: dos columnas opcionales + cambio del unique) y PR2 frontend. Dueño confirmó que el descuento sigue proporcional (preguntó por descuento a una sola factura: hoy no se puede en un mismo recibo; queda fuera).
