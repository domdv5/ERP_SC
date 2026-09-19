---
name: preventa-reservation-design
description: Preventa (PV) reserva stock de forma DERIVADA (no tabla StockReservation) — decisión de diseño y el argumento del void() que la define
metadata:
  type: project
---

Diseño propuesto (2026-07-28, **pendiente de aprobación del usuario**) para el tipo de documento `PV` (Preventa): la cantidad reservada NO se persiste en una tabla agregada tipo `StockReservation`, se **deriva** de `DocumentItem` de documentos `type=PV, status=confirmed` como `SUM(quantity - releasedQuantity - convertedQuantity)`.

**Why:** el argumento decisivo no es performance, es `documents.service.ts::void()`. Ese método es genérico e itera `document.inventoryMovements`; como PV no genera ningún `InventoryMovement`, el void de una preventa ya funciona **sin tocar una sola línea** de ese método, y las reservas se liberan solas porque la query derivada filtra `status: confirmed`. Con una tabla agregada habría que meter una rama PV dentro de `void()` — el método más riesgoso del módulo, vecino directo del invariante protegido `SUM(BinStock)===Inventory`. Además una tabla agregada crea un *segundo* invariante que mantener (`SUM(items PV abiertos) === StockReservation`), que es exactamente la clase de bug que ya mordió al proyecto (el stock fantasma de BinStock al anular traslados).

Corolario: la reserva es lógica, nunca toca `Inventory`/`BinStock`/`InventoryMovement`. Es el mismo principio ya establecido de "no cachear stock en Product" aplicado a reservas.

**How to apply:** si en el futuro se propone una tabla `StockReservation` (o un campo `reserved` en `Inventory`), el trigger legítimo para migrar es la concurrencia al implementar POS — no la performance de `/products`. La migración es aditiva (se hace backfill desde la query derivada), así que no hay urgencia de decidirlo antes. Ver [[warehouses-subentities]] para el precedente de sub-entidades dentro de un módulo y [[credit-tables-split]] para el precedente de "no generalizar antes de tener el segundo consumidor".
