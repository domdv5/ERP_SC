# Memory Index

- [Zod v4 patterns](feedback_zod_v4.md) — `invalid_type_error`/`required_error` removed; `superRefine`+`coerce` requires `as any` on resolver/handleSubmit
- [TableSkeleton widths tuple](feedback_tableSkeleton.md) — widths prop must be exactly 4 strings; never pass more
- [Documents module](project_documents_module.md) — types CM/DVC/EAI/SAJ/T/PV; 3 pages + service + types; document.constants.ts label maps; per-type item column recipe
- [Stale backend process](project_stale_backend_process.md) — rebuilt dist/ isn't enough, running node process must restart too; check process StartTime vs dist mtime before blaming frontend
- [Users module](project_users_module.md) — CRUD usuarios via /auth, multi-role checkboxes, password opcional en edición, ruta /users + grupo Administración en sidebar
- [Warehouses module — Zones/Bins](project_warehouses_module.md) — Bin.code not name, no delete endpoint (KebabMenu deleteDisabled), Selection/?id&zone&bin nav pattern, WarehouseDetailPage.tsx orphaned
- [Dead code in page files](feedback_dead_code_pages.md) — verify a component is actually rendered in JSX, not just defined, before treating it as live
- [Transfer source-bin selector](project_transfer_source_bin.md) — mirrors dest-bin cascade but filters by binStocks (has product) not !occupied (empty)
- [Supplier credit application frontend](project_supplier_credit_frontend.md) — Plan 020 Paso 8: credit-application UI in RegisterPaymentForm/AccountsPayableDetailPage, built against a contract before backend landed, Option B assumed
- [No lint script](project_no_lint_script.md) — frontend has no `pnpm lint`, no eslint config/binary at all; CLAUDE.md's command is stale, only `tsc --noEmit` is real
- [PV (preventa) module](project_pv_preventa_module.md) — Document.type PV, releasedQuantity, Liberar Stock + real Convertir a venta; backend-computed `pv` conversion block -> chip + age counter + button gating by active derivative
- [UI placeholder button pattern](feedback_ui_placeholder_pattern.md) — disabled + native title tooltip, reuse existing disabled:opacity-50 convention, don't build fake interactions
