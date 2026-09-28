---
name: project_ap_ar_filters_combobox_exception
description: AP/AR list pages replaced free-text search with an exact-match third-party Combobox, added date range + filtered "Saldo total"; StatCard widened to allow formatted string values
metadata:
  type: project
---

2026-09-28: `AccountsPayableListPage.tsx`/`AccountsReceivableListPage.tsx` (`frontend/src/pages/accounts-payable/`, `.../accounts-receivable/`) got three additions, backend already shipped (`supplierId`/`clientId` already existed; `dateFrom`/`dateTo` + `meta.totals` are new).

**Combobox replaces TableToolbar's free-text search, doesn't coexist with it.** Backend's `search` param on both endpoints only ever matched the third party's name (`contains`, case-insensitive) — so an exact-selection `Combobox` (`{ isSupplier: true }` / `{ isCustomer: true }` against `getThirdParties`, same controlled-search-with-debounce pattern as `EgresoNewPage.tsx`'s supplier picker) is a strict precision upgrade over the same field, not an additional filter. Removing the redundant free-text field was the right call, not just "one of two valid options" — confirmed by tracing what `search` actually matched in the backend service before deciding.

**This deviates from the documented "Fila de filtros bajo TableToolbar" convention** (`frontend/CLAUDE.md`), which says never use `Combobox` in the filter row — that rule's rationale is "keep visual consistency for a *small closed* option set" (tipo/estado/rol/marca). It doesn't apply to an open, large set like all suppliers/clients — a native `<select>` can't render hundreds of options usably. Documented the exception inline in `frontend/CLAUDE.md` rather than silently breaking the rule.

**Because Combobox replaces the search input, these two pages no longer use the shared `TableToolbar` component at all** — it has no prop to swap its internal `<input>` for a custom control. Hand-rolled the same "search-slot + count + refresh button" row inline (same classNames) instead of modifying the shared component (used by 6 other pages) for a one-off need. If `TableToolbar` ever grows a `searchSlot` render-prop, migrate these two back.

**`StatsGrid`'s `StatCard.value` widened from `number` to `number | string`** (`frontend/src/components/shared/StatsGrid.tsx`) to let a card show `formatCOP(...)` output directly. Backward compatible — all other current callers pass numbers.

**Filtered "Saldo total" card reads `meta.totals.balance` from the same query response** — backend aggregates `_sum` over the *entire filtered set* (not just the visible page) in the same `$transaction` as the list query. Never recompute this by summing `items` client-side — that would only reflect the current page.

Related: [[feedback_tableSkeleton]] (same list-page family, different constraint).
