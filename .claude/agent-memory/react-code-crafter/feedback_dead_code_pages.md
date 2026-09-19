---
name: feedback-dead-code-pages
description: Always verify a component defined in a page file is actually rendered in JSX before treating it as live code
metadata:
  type: feedback
---

Before extending or "fixing" a component defined inside a page file, check whether it is ever instantiated in that file's returned JSX — not just whether it's defined and looks complete.

**Why**: In `frontend/src/pages/warehouses/WarehousesPage.tsx`, three fully-built components (`WarehouseTreeItem`, `ZoneTreeItem`, `BinTreeItem`, ~250 lines) plus their own `KebabMenu` and state setters (`setEditing`, `setDeleting`, `setAddingZoneTo`, etc.) were fully implemented with real-looking props and styling, but the page's `return` only ever rendered `<DetailPanel />`. The tree was scaffolded, abandoned mid-build, and never wired in — meaning warehouse edit/delete had **no UI entry point at all** despite the state machinery existing. A grep for the component name or a quick read of props alone would miss this; only reading the final JSX return confirms whether something is live.

**How to apply**: When a task says "connect X" or "fix the button for Y," search for where the relevant component is actually rendered (not just declared) before assuming the existing code is a working foundation to build on. If a fully-built component is never rendered, treat it as a genuine design decision point — either delete it or wire it in — and say so explicitly rather than silently building next to it. See [[project_warehouses_module]] for the concrete resolution (deleted the dead tree, kept `DetailPanel`'s card-drilldown as the one live UI).
