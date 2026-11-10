Pistoleo con filas separadas — el mismo producto solo se agrupa si es el último agregado; si no, va en fila nueva.
Aplica a REM, COT, POS, POSO y DVV, al pistolear y al elegir a mano. Plan aprobado en forma, sin "dale" todavía: arrancar en otra sesión.
Rama sugerida: `feat/scan-separate-rows`. Dos commits: backend primero (validación de stock), después frontend.

## Specs

- S1 — Regla (verbatim): "si por ejemplo yo psitoleo un producto y depsues pistole otro y depsues vuelvo a pistolear el rpimero no me lo debe de agrupar sino que conserve sufila, si por el con trario pistoleo, y cojo otro producto y el mismo que psitolle de ultimo se agreupa". Ejemplo: A, A, B, A → filas A×2, B×1, A×1.
- S2 — Solo en los tipos "REM, COT, POS, POSO, DVV". El resto (CM, T, EAI, SAJ, PV, DVC, CMO) sigue agrupando todo en una fila por producto, como hoy.
- S3 — Selección manual de producto en una fila: "Misma regla que el pistoleo" (si es el producto de la fila anterior/última agregada se suma; si no, queda en su propia fila).
- S4 — Backend: `calculateMissingStock` (`backend/src/documents/strategies/base-effect.strategy.ts:200-244`) hoy compara el disponible fila por fila. Con filas repetidas hay que sumar la cantidad por producto antes de comparar. Ejemplo: 5 disponibles, REM con A×3 y A×3 → hoy pasan las dos y se reservan 6; debe rechazarse con un solo error "disponible 5, solicitado 6". Lo usan POS, COT, REM y PV. Documentos con una fila por producto dan el mismo resultado que hoy.
- S5 — Frontend: el aviso "Supera el disponible" y la lista de faltantes (`findMissingItems`) suman todas las filas del mismo producto.
- S6 — DVV: revisar cómo valida contra lo vendido y si suma por producto, antes de tocar nada; si compara por fila, mismo arreglo que S4.

## Tasks

- T1 — S4 — inline (prueba primero; el usuario puede elegir "modo práctica" para escribir la suma él) — sumar por producto en `calculateMissingStock` con `Map` + `for` — commit: pendiente
- T2 — S6 — inline — revisar validación de DVV contra lo vendido; arreglar si compara por fila — commit: pendiente
- T3 — S1, S2 — react-code-crafter — `BarcodeScanInput.tsx` (~92-126, `processCode`, `addOneTo`) y `scan-queue.ts` (`findRowIndexByCode`): para los tipos de S2, +1 solo si coincide con la última fila; si no, `append` — commit: pendiente
- T4 — S3 — react-code-crafter — `ProductRow.tsx` (~183-195) y `pos-checkout/SaleCart.tsx` (~51-60): misma regla al elegir a mano — commit: pendiente
- T5 — S5 — react-code-crafter — aviso de disponible (`available-stock`, `ProductRow`, `POSCartLine`) y `pos-checkout/findMissingItems.ts` suman por producto — commit: pendiente
- T6 — S1-S5 — inline — actualizar pruebas que esperan agrupar (`scan-queue.test.ts` "A, A, B, A…", `ProductRow.test.tsx`, `SaleCart.test.tsx`) y agregar las de la regla nueva; frontend/CLAUDE.md y backend/CLAUDE.md — commit: pendiente

## Riesgos

- T1 cambia la validación de stock al confirmar (dinero/stock): la hace más estricta, nunca más floja. Verificación independiente obligatoria y probablemente revisión nativa.
- Sin T1, el cambio de frontend permitiría reservar o vender unidades apartadas por preventas/remisiones (el descuento atómico solo frena el stock físico negativo, no lo reservado).
- Ver qué otros lugares asumen una fila por producto (conversión REM→venta va por `documentItemId`, el explorador la vio bien; PDF usa `map`).

## Log

- L1 — Usuario (2026-11-10): "necesito cambiar el tema de cuando se pistolea un producto y es la sigueinte, si por ejemplo yo psitoleo un producto y depsues pistole otro y depsues vuelvo a pistolear el rpimero no me lo debe de agrupar sino que conserve sufila, si por el con trario pistoleo, y cojo otro producto y el mismo que psitolle de ultimo se agreupa"
- L2 — Usuario: tipos "REM, COT, POS, POSO, DVV"; selección manual "Misma regla que el pistoleo".
- L3 — Hallazgo: `calculateMissingStock` compara por fila (el explorador dijo que el backend ya estaba listo; no es así).
- L4 — Usuario: "pero dejemos el plan listo para ahcerl ne otra sesion entonces definamoslo y simplemnte desjmos listo para otr aseison". Pendiente al retomar: el usuario elige "dale" (todo lo implementa la IA) o "modo práctica" (escribe él la suma de T1).
