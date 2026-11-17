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

- T3 [S12] backend: schema + reparto al crear recibo (dueño, escrito) + migración + pruebas de la regla — PR1 rama feat/recibos-credit-split — commit: e99246b
- T4 [S13] backend: contratos y consultas de lista/detalle de recibos + pruebas — PR1 — commit: e99246b
- T5 [S14, S1-S11] frontend: 6 pantallas según `design/egresos-recibos/` — PR2 rama feat/egresos-recibos-design (sale de feat/recibos-credit-split) — commit: pendiente

## Log
- L1 (2026-11-13): "lo que si quiero es que hay una conrcondia entre el dinseño de egresos y recibos de cja, obivmante cada uno tineie datos diferetnes pero el dinseo la idea es que sea homomgeno y solo cambie la logica de cad uno por ejmlpo, en egresos hay un columan que se llama reparto (vista previa) y en recibos de cjaa no"
- L2: Respuestas: Reparto → "Quitarla de Egresos"; Saldo a favor → "Tabla + 'Usar todo', empieza en 0". Plan A1–A7 aprobado con "dale".
- L3 (2026-11-13): "creo que no me etnedite bien lo que queri, osea haz una explocraion bioen, miras las columans que tiene el lsitaod de recibos de caja y la de egreso, por ejm,plo egresos tine formas de apgo, recibvos cde cjad, entonces no tineie sentido porque son 2 diseNos difetents, ovibamente la infromacion es difernete pero el diseNo debe de ser homogeneo en cuanto lo pemrita, mira el diseño de salsdo  favor de uno y el otro no tiene nda que r ver, entonces volvemos a lo mismo 2 diseNos difertnes ye so no em gusta yo quiero algo profesionla con rigor no simplemente algo vibecodeado que cauqleuiroi peuder hacer y lod eja asi porqeu fucniona, siente en la liebrtad de preguntarme lo que hagal falta para cerrar el dinse" — Aclaración: "cuando se aplica un saldo a favor en egreso o en recibo de caja una vez se confirma vuelves y entras y el diseño no tiene nada que ver uno con el otro".
- L4: Decisiones: Lista = mismas columnas completas (Número · Fecha · Tercero · [Sucursal recibos] · En dinero · Saldo a favor · [Descuento recibos] · Total; backend recibos). Detalle = reparto por factura en las dos (En dinero · Saldo a favor · [Descuento]; backend recibos). Saldos a favor usados = Origen enlazado + Fecha + Monto en las dos (backend recibos). Anular/PDF = otro trabajo. Diseño se aprueba en maqueta (design/) antes de código. Trabajo sin commitear de la rama (crear unificado) queda como base.
- L5 (2026-11-13): Maqueta en `design/egresos-recibos/` (01-lista-egresos, 02-lista-recibos, 03-crear-egreso, 04-crear-recibo, 05-detalle-egreso, 06-detalle-recibo) y `design/system.md` resincronizado con `frontend/src/index.css`. Pendiente de aprobación del dueño.
- L6 (2026-11-13): "cuado se acceda al detllae que quede claro como un reusmen de lo que suma y resta y el valro total, porque en el detalle esta suelto y puede llegar a confunidr" — 05/06: tarjetas sueltas reemplazadas por un bloque "Cuadre" (Cuentas abonadas − Descuento − Saldo a favor = Dinero pagado/recibido). Pendiente: decisión del reparto por factura en Recibos (opciones 1/2/3).
- L7 (2026-11-13): "en esa capture que te mostra tmapoco es calro que ese saldo a favor esd uno solo es como si fueran 2 diferttnes y no se sae que ahyq que sumarlo para que den los 55, y en cuntao a tu pregunta,entonces la opcion 1" — "Saldos a favor usados" agrupado por saldo (una fila con el total) y debajo "↳ Aplicado a <factura> $monto". Reparto por factura en Recibos: opción 1 = guardar desde ahora (FIFO, igual que Egresos) en columna nueva `ReciboCajaAllocation.creditAmount`; recibos viejos muestran "—" (sin backfill). Requiere migración (Safety Rule: confirmación aparte).
- L8 (2026-11-13): "dale" al plan: PR1 backend (guardar reparto como egresos, migración confirmada: dos columnas opcionales + cambio del unique) y PR2 frontend. Dueño confirmó que el descuento sigue proporcional (preguntó por descuento a una sola factura: hoy no se puede en un mismo recibo; queda fuera).
- L9 (2026-11-13): PR1 commit e99246b (559 líneas, un solo commit por ser alto riesgo: migración + regla de dinero) en `feat/recibos-credit-split`. PR2 (frontend) sigue en `feat/egresos-recibos-design`, apilada sobre PR1.
- L10 (2026-11-13): "no no deshace todo eso nuevo y volvamos al dinsor origianl". El rediseño del frontend (32 archivos, ~2.700 líneas) era más de lo pedido ("solo simplment e un tipo de igualaicon"). Se guardó en `git stash` ("frontend rediseño egresos/recibos descartado 2026-11-13") y las pantallas volvieron a como están en main. T5 queda en pausa. El backend e99246b sigue en la rama, sin push.
- L11 (2026-11-13): Nuevo enfoque: igualar pantalla por pantalla con cambios mínimos, preguntando cada detalle ("no asumas nada y haz las preguntas"). Listas decididas:
  - Egresos: solo renombrar "Formas de pago" → "Dinero pagado"; orden igual (Número · Fecha · Proveedor · Total · Dinero pagado · Saldo a favor).
  - Recibos: Número · Fecha · Cliente · Sucursal · Total · Dinero recibido · Saldo a favor · Descuento. Total = dinero + saldo a favor + descuento (igual que Egresos).
- L12 (2026-11-13): Detalle decidido (mínimo):
  - Resumen arriba como Egresos en las dos: Total · Dinero pagado/recibido · Saldo a favor; Recibos agrega Descuento (con motivo) si hay; se quita "Deuda original" y las tarjetas Cliente/Sucursal/"N registradas" (cliente y sucursal al subtítulo como Egresos).
  - Orden de tablas como Egresos: Formas de pago → Cuentas abonadas → Saldos a favor usados.
  - Saldos a favor usados como Egresos: Origen (link) · Monto aplicado; una fila por factura cubierta aunque se repita el origen.
  - Cuentas abonadas: Documento · Abonado · Dinero pagado/recibido · Saldo a favor · (Descuento en recibos); recibos viejos "—".
- L13 (2026-11-13): Detalle: Egresos renombra "Formas de pago" → "Dinero pagado" en el resumen. Crear decidido: bloque de saldo a favor "Como Recibos" en las dos (tabla Fecha · Origen · Saldo · Usar, arranca en 0, "Usar todo"; Egresos deja de llenarse solo); quitar "Reparto (vista previa)" de Egresos.
- L14 (2026-11-13): "Total" pasa a llamarse "Total abonado" en las dos listas y en el resumen del detalle (= dinero + saldo a favor + descuento). "dale" para arrancar por las listas.
- L15 (2026-11-13): "nada este tampoco me convence, descartalo! porfa" → se descartó todo el cambio de las listas (vuelven a las originales). Detalle y Crear quedan sin empezar.
- L16 (2026-11-13): Dueño se confundió (creía que todo estaba aplicado); vuelven las listas. Nombre: "Total" en las dos ("el total por el que salió el egreso/recibo de caja y por dentro la justificación"). Recibos: Total = dinero + saldo a favor + descuento.
- L17 (2026-11-13): Listas con una sola columna de plata: "Total" (= lo que bajó la deuda; el desglose va en el detalle). Egresos: Número · Fecha · Proveedor · Total (se quitan Formas de pago y Saldo a favor). Recibos: Número · Fecha · Cliente · Sucursal · Total, con Total = dinero + saldo a favor + descuento. Idea abierta: en el detalle mostrar monto original y pendiente de cada factura.
- L18 (2026-11-13): Detalle aplicado según L12-L13: Recibos con resumen como Egresos (Total · Dinero recibido · Saldo a favor · Descuento con motivo), cliente (link) y sucursal en el subtítulo, orden Formas de pago → Cuentas → Saldos, Saldos a favor usados = Origen · Monto aplicado ("Excedente" sin documento), cuentas con Dinero recibido · Saldo a favor ("—" en recibos viejos). Egresos solo renombra "Formas de pago" → "Dinero pagado".
- L19 (2026-11-13): Nombre del cliente/proveedor en el encabezado del detalle: link visible (blanco, negrita, subrayado siempre); `link-plain` se perdía en el gris. Pendiente decidir si los números de documento de las tablas van igual.
- L20 (2026-11-13): Dueño corta por hoy ("en la próxima sesión arrancamos con esto de nuevo"). Detalle commiteado sin revisar en pantalla.
- L21 (2026-11-17): Pruebas en pantalla OK (reparto con DVV de administración + excedente + descuento). Se agrega columna "Aplicado a" en "Saldos a favor usados" de recibos y egresos (egresos: el detalle ahora incluye `accountPayable.document` de cada aplicación; contrato `EgresoCreditApplication.accountPayable`).
- L22 (2026-11-17): "me gustaria en recibos de caja el total, sea por cuneto fue el total de ese recibo, no que reste saldos a favor ni decuentos ni exccernte etc etc" / "el total a msotrar debe ser efectiamente lo que se recibio en dinero, entonces un descuento, saldo a favor, excdente no se tinei en cuneta" / "el excdente me peuyde lelgar hoy, y lo utilzio entre 15 dias , entonces no tendira sneitdo incluirlo". Decisión: Total (lista y resumen del detalle) = solo el dinero que entró/salió con ese documento, en recibos y egresos. "Dinero recibido" se deja también en el resumen. Reemplaza L16/L17 (Total = dinero + saldo + descuento).
- L23 (2026-11-17): "pero entonces mostremos en sa lsita, cuanto saldo a favor se uso, si hubo desceunto yq de que tipo y el valor, y tambien excdente, asi la informacon es ams clara no?" + descuento "como la primera opcion, pero deja de estar sugiriendo el gris que eso no se ve nada, y el total conufnde pon dinero recibido". Decisión: lista recibos = Número · Fecha · Cliente · Sucursal · Dinero recibido · Saldo a favor (una sola columna) · Descuento (monto + tipo, sin gris); lista egresos = ... · Dinero pagado · Saldo a favor; se quita "Total" del resumen de los detalles. Backend: lista de recibos devuelve `discountReason`.
- L24 (2026-11-17): "el tipo de descunto debajo, no em gusto" → elige "No mostrar el tipo en la lista": la columna Descuento muestra solo el monto; el tipo queda en el detalle. Se revierte `discountReason` de la lista en el backend.
- L25 (2026-11-17): Crear Egreso: "Sí, igual que Recibos" (saldo a favor arranca en 0, "Usar todo", sin "Reparto (vista previa)"); riesgo de no usar el saldo es operativo ("el saldo a favor en la factura mas indmeitne no siempre se va a usar ahi mismo"), sin aviso extra. Monto por fila se recorta al saldo, como Recibos. Lógica en `useEgresoForm.ts` + `calculateFillCreditAmount`; tabla inline en `EgresoNewPage.tsx` (CreditsPanel del POS sin tocar).
- L26 (2026-11-17): "no me esta mostrando cuanto me falta!" → Egresos usa la fila "Falta por pagar / Sobra" de Recibos en lugar de "Las formas de pago deben sumar X" (S1). Dueño: "listo ya probe ye sta bien!".

## Retomar aquí (próxima sesión)
Rama `feat/egresos-recibos-design` (local, sin push). Commits: e99246b backend reparto, d7aa87a listas, 61f5a43 detalle. Sin commitear (2026-11-17, aprobado en pantalla por el dueño): columna "Aplicado a" en Saldos a favor usados (recibos y egresos, backend egresos incluye `accountPayable.document`); listas = Dinero recibido/pagado · Saldo a favor · Descuento (solo monto); detalle sin tarjeta "Total".

Probado en pantalla por el dueño: reparto FIFO con DVV de administración + excedente + descuento (RC-000017) — OK.

Pendiente:
- Commitear lo de 2026-11-17 (esperando que el dueño lo pida).
- Decidir: números de documento de las tablas, ¿mismo estilo de link visible?
- Crear: HECHO saldo a favor como Recibos y Falta/Sobra en Egresos (L25-L26).
- Puntos del primer plan (Falta/Sobra, errores inline, ConfirmDialog, textos) descartados con el rediseño: volver a preguntarlos uno por uno al llegar a Crear.
- Idea abierta: en el detalle, monto original y pendiente de cada factura.
- Al final: PR (backend y frontend), decisión del dueño.
