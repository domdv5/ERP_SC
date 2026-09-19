---
name: documents-producttable-column-sync
description: DocumentFormPage.tsx <thead>/<tfoot> and ProductRow.tsx <td>s must stay column-count-synced per docType
metadata:
  type: project
---

The items table in the document create/edit form (`frontend/src/pages/documents/DocumentFormPage.tsx` + `frontend/src/pages/documents/components/ProductRow.tsx`) renders its cost column conditionally per `docType` (`CM`, `DVC`, `EAI`, `SAJ`, `T`). The `<thead>`/`<tfoot>` column visibility lives in `DocumentFormPage.tsx` (flags like `showCostColumn`), while the per-row `<td>` visibility lives in `ProductRow.tsx` (flags like `showCost`). These two files must be kept in sync independently — there's no shared source of truth, so adding/removing a conditional `<td>` in `ProductRow.tsx` for a given docType silently breaks column alignment unless the matching `<th>` conditional in `DocumentFormPage.tsx` is updated too.

**Why:** discovered while adding a read-only avgCost display for `SAJ` rows (2026-07-14) — `SAJ` previously had zero cost `<td>`s (cost column fully absent, `showCostColumn` excluded it), so adding a new informational `<td>` for `SAJ` in `ProductRow.tsx` alone would have misaligned the header (4 `<th>`) against the body (5 `<td>`). Had to add a parallel `hasCostColumn = showCostColumn || docType === 'SAJ'` flag in `DocumentFormPage.tsx` and use it for the `<th>`, while leaving the original `showCostColumn` untouched for the `<tfoot>` Total row (which sums `unitCost` register values — meaningless for SAJ since its cost isn't a registered form field, backend always uses `avgCost` automatically via `SajEffectStrategy`).

**How to apply:** any time a docType-conditional column is added/removed/changed in `ProductRow.tsx`, grep `DocumentFormPage.tsx` for the corresponding header flag (currently `showCostColumn`) and verify `<th>` presence still matches `<td>` presence for every `docType`. Don't assume the `<tfoot>` Total needs the same flag as the `<th>` — Total is meaningful only when `unitCost` is an actual registered/editable form field.
