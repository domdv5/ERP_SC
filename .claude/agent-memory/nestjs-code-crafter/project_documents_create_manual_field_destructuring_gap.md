---
name: project-documents-create-manual-field-destructuring-gap
description: DocumentsService.create() manually destructures/lists each scalar field for tx.document.create data — adding a new optional Document column requires touching create() too, not just the DTO
metadata:
  type: project
---

`DocumentsService.create()` (`backend/src/documents/documents.service.ts`) does NOT spread the DTO into `tx.document.create({ data: ... })` — it destructures known fields one by one (`type, date, items, thirdPartyId, destWarehouseId, destBinId, sourceBinId, freight, notes, ...rest`) and lists them explicitly in the `data` object. `update()` is different — it spreads `...rest` from `UpdateDocumentDto` directly into `data`, so any field added to `CreateDocumentDto` flows through `update()` automatically but NOT through `create()`.

**Why this matters:** when wiring a new optional `Document` column end-to-end (e.g. `sourceBinId`, mirroring the existing `destBinId` pattern — see 2026-07-21 task adding bin-level transfer-origin tracking), it's easy to add the field to the DTO + validate it in the strategy, but forget that `create()` silently drops it because it's not in the destructuring list or the `data` object. The field ends up validated and read by the strategy's `confirm()`, but is never persisted, so `document.sourceBinId` is always `undefined` at confirm time — a silent no-op bug, not a compile error (TS doesn't complain because the field just sits unused inside `...rest`).

**How to apply:** any new optional field added to `CreateDocumentDto` that needs to persist on `Document` must be added in THREE places in `create()`: the destructuring list (line ~130-141), and the `tx.document.create({ data: {...} })` object (line ~171-194) — mirroring how `destBinId`/`destWarehouseId` already appear in both. Grep for the existing sibling field (e.g. `destBinId`) across `documents.service.ts` to find all the spots it appears before considering the wiring done. `update()` needs no equivalent change (it spreads automatically).

See also [[project-binstock-invariant-transfer-strategy]].
