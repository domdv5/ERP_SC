---
name: readonly-mode-feature
description: Frontend "modo de solo lectura" (cierre contable) feature — SSE-backed system status, singleton EventSource pattern
metadata:
  type: project
---

Implemented 2026-07-29: read-only mode banner + toggle in Header, backed by SSE from `GET /system/status/stream`.

Files: `frontend/src/types/system.types.ts` (SystemStatus, SystemStatusActivatedBy), `frontend/src/services/system.service.ts` (getSystemStatus, setReadOnlyMode), `frontend/src/hooks/useSystemStatus.ts`, `frontend/src/components/layout/ReadOnlyBanner.tsx`. Modified: `AppLayout.tsx` (renders banner), `Header.tsx` (Lock/Unlock toggle button, gated by `usePermission('system.manage')`), `services/api.ts` (added `API_BASE_URL` export, added 403 "modo de solo lectura" toast branch in response interceptor alongside existing 401 branch).

**Non-obvious decision — singleton SSE via module-level ref-count**: the task spec asked for `useSystemStatus()` to be called both in `AppLayout` (to render the banner) AND in `Header` (to show the correct Lock/Unlock icon + know current state before toggling) but *also* said the EventSource must open only once app-wide (`advanced-init-once` rule). These are in tension since two call sites both mount for the full session lifetime. Resolved with a module-level `activeSubscribers` counter + `sharedEventSource` singleton inside the hook itself: first mount opens the connection, last unmount closes it, `useQuery(['system-status'])` is safely subscribed from both components (TanStack Query dedupes reads on a shared key regardless). If a third consumer of `useSystemStatus()` is ever added, this pattern still holds — no changes needed.

**SSE payload double-wrap**: the backend's global `ResponseFormatInterceptor` wraps SSE messages too, so `event.data` is `{"data":{"success":true,"data":{...}}}` — parse then `.data.data` to get the real `SystemStatus`. Don't confuse with the normal single-wrap `res.data.data` used for plain REST calls.

**No `pnpm lint` script exists** in `frontend/package.json` despite CLAUDE.md referencing it — only `dev`, `build`, `preview`. Verification for this task used `tsc --noEmit` + `pnpm build` instead.

See [[project_documents_module]] for the broader module-conventions context this project follows.
