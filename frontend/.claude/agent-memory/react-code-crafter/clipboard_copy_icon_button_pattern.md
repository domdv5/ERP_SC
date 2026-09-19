---
name: clipboard-copy-icon-button-pattern
description: Established pattern for small icon-only "copy to clipboard" buttons next to read-only values (e.g. ProductRow.tsx SAJ cost column)
metadata:
  type: project
---

Pattern for a small icon-only clipboard-copy action next to a read-only display value, established in `frontend/src/pages/documents/components/ProductRow.tsx` (SAJ read-only avg-cost cell, copies the raw numeric avgCost so operators can paste it into another document's cost `<input type="number">`).

- Icon: `Copy` from `lucide-react`, sized `w-3.5 h-3.5` (smaller than the `w-4 h-4` used for row-level destructive actions like `Trash2`).
- Hover treatment for non-destructive icon actions: `text-content-faint hover:text-brand-secondary hover:bg-brand-secondary/10` — green brand-secondary, NOT the red `hover:text-red-500 hover:bg-red-500/10` reserved for destructive actions (remove row, delete).
- Always `type="button"` since these buttons live inside a `<form>` (react-hook-form document forms) — omitting this submits the form.
- Always `aria-label` on icon-only buttons (e.g. `"Copiar costo"`) since there's no visible text.
- Copy the **raw unformatted numeric value** (`String(rawNumber)`), never the display-formatted string (e.g. never copy `formatCOP()` output like `"$200"`) — the destination is typically a numeric input that can't parse currency symbols/thousands separators.
- Wrap `navigator.clipboard.writeText(...)` in try/catch; `toast.success('...copiado')` on success, `toast.error('No se pudo copiar...')` on failure (clipboard API can reject e.g. without permissions/HTTPS).
- Reuse this pattern (icon, sizing, green hover, raw-value copy, toast feedback) anywhere else a read-only numeric/reference value needs a quick copy affordance.

See also [[documents_producttable_column_sync]] for the broader SAJ read-only cost column this button lives inside.
