# Frontend (EloSC) — CLAUDE.md

Guidance specific to `frontend/`. See the project root `CLAUDE.md` for Safety Rules, Code Documentation Conventions, and Routing Rules — those apply here too and are not repeated in this file.

## Commands

All commands run from the `frontend/` directory using `pnpm`.

```bash
pnpm dev          # Start Vite dev server
pnpm build        # Production build
pnpm preview      # Preview production build
pnpm lint         # ESLint
```

## Testing frontend changes

When verifying any frontend behavior end-to-end (forms, flows, bug fixes), use the **Playwright CLI in headed mode** — write an ad-hoc script using the `playwright` package already installed in `frontend/` (`chromium.launch({ headless: false })`) and run it with `node`. Not the chrome-devtools MCP tools, not headless. The user wants to see the browser window while the flow runs.

## Key Patterns

**API responses** — Backend wraps everything as `{ success, data: T }`. Services unwrap before returning:
```ts
const res = await api.get<ApiResponse<T>>('/endpoint', { params })
return res.data.data
```

**Queries** — Always include `staleTime: 5 * 60 * 1000` to avoid redundant refetches on cached keys. Use `keepPreviousData` on paginated/searchable lists to prevent flicker.

**Debounced search** — 400 ms debounce via `useEffect` + `setTimeout`; reset `page` to 1 when search changes.

**Pagination** — Backend returns `{ items, meta: { total, page, limit, totalPages } }`. Query key includes `[..., page]`. Pagination controls show ellipsis for large page counts.

**Mutations** — Always call `queryClient.invalidateQueries({ queryKey: ['resource'] })` on success.

**Logout dropdown** — Built with `useState` + `useRef` + `document.addEventListener('mousedown', ...)` for click-outside detection. No external library.

**Row click to edit** — Every list page `<tr>` must have `onClick={() => setEditing(item)}` and `cursor-pointer`. The delete button must call `e.stopPropagation()` to prevent bubbling. The pencil button also gets `e.stopPropagation()` (it becomes redundant but keeps explicitness). Apply this pattern to every new module.

**Protected routes** — `AuthGuard` checks `useAuthStore` token; redirects to `/login` if not authenticated.

**Shared SSE connection (`useSystemStatus`)** — Module-level singleton (`sharedEventSource`, `activeSubscribers` ref-count) instead of one `EventSource` per component: `Header` and `AppLayout` both call the hook, but only the first mounted consumer opens the connection and the last one to unmount closes it. `staleTime: Infinity` on the underlying query — it's never refetched by time, only ever updated by the SSE push (including the mutation that toggles the mode itself, via `queryClient.setQueryData` in `Header.tsx`, so the acting user's own UI doesn't depend on their SSE round-tripping back to them). Reuse this module-level-singleton pattern for any future SSE hook — don't spin up a new `EventSource` per component instance.

**Combobox (shared)** — Use `<Combobox>` from `@/components/shared` for all searchable dropdowns. Two modes: (1) **Controlled** — pass `searchValue`/`onSearchChange` for server-side debounce; show "Escribe para buscar..." when empty, let caller manage `enabled` on the query; (2) **Uncontrolled** — omit both props, component filters `options` client-side. Always uses `createPortal` → safe inside overflow containers. Option interface: `{ id, label, sublabel? }`. `onChange` signature: `(id: string, option: ComboboxOption) => void`. For server-side search, add a synthetic option when an item is already selected and search is empty (prevents the trigger showing blank). It has no keyboard support (no Enter-to-select, no arrow-key nav) — every selection is mouse-only; that's why the barcode-scan flow (see `frontend/src/pages/documents/CLAUDE.md`) needed its own dedicated input instead of reusing it.

**`minSalePrice` auto-fill** — `ProductForm.tsx` auto-computes "Precio mínimo de venta" as `salePrice * 0.98` (business rule: 2% floor discount) while creating a product, live as `salePrice` is typed. Stops overwriting the moment the user edits `minSalePrice` by hand (tracked via a `minSalePriceTouched` flag, reset on every form open) — never auto-fills in edit mode, only on create.

**Permission-based UI** — Use `usePermission(...perms)` from `@/hooks/usePermission` to show/hide UI elements. The JWT already carries `permissions[]` so no extra request is needed. Pattern:
```tsx
const canManage = usePermission('user.manage')
// Hide action buttons, sidebar sections, entire CTAs:
{canManage && <button>Nuevo usuario</button>}
```
For sidebar sections that must be hidden for some roles, render the `<NavLink>` conditionally inside the component (not in the static `navGroups` array). See `Sidebar.tsx` "Administración" section as reference.

**Sidebar accordion nav items** — When a nav section needs collapsible sub-items (e.g. Bodegas), create a dedicated component (`WarehousesSidebarItem`) instead of a static NavLink. Use `useLocation` + `useState` for open/close; `max-height` CSS transition for animation; `useQuery` to load sub-items from API. Sub-item links use `Link` (not `NavLink`) with manual `isActive` computed from `location.search` — React Router's NavLink `isActive` ignores query params and would mark all sub-items active simultaneously.

**Lazy route loading** — `router/index.tsx`'s `Lazy` wrapper uses a `DelayedPageLoader` (200ms `setTimeout` before rendering `PageLoader`) as the `Suspense` fallback, not `PageLoader` directly. Route chunks that resolve faster than 200ms (already-loaded chunks, fast dev-server reloads) never show the full-screen loader — only genuinely slow loads do. Don't revert this to a bare `<PageLoader />` fallback; it reintroduces a flash on every navigation.

**Theme toggle animation** — `Header.tsx`'s theme button uses the View Transition API (`document.startViewTransition`) for an expanding-circle wipe, with a plain `toggleTheme()` fallback when unsupported. Three gotchas if touching this: (1) wrap the state update in `flushSync` inside the transition callback — the `.dark` class toggle in `AppLayout.tsx`'s `useEffect` must apply synchronously before the browser snapshots the new state; (2) `index.css` resets `mix-blend-mode: normal` on `::view-transition-old(root)`/`::view-transition-new(root)` — Chrome's default `plus-lighter` blend additively mixes the two layers during a clip-path reveal, producing a color-flash; (3) the reveal keyframe animation needs `fill-mode: forwards`, otherwise `clip-path` snaps back to `circle(0%)` the instant the animation ends, flashing the old theme for a frame.

**Role display names** — Spanish labels for roles live in `users.service.ts` as `ROLE_LABELS: Record<string, string>` with a `getRoleLabel(name)` helper that falls back to `replace(/_/g, ' ')`. Import from there when displaying role names anywhere in the UI.

## Implemented Modules

| Route | Status | Notes |
|-------|--------|-------|
| `/login` | Done | JWT auth, redirects to `/` if already logged in |
| `/` (dashboard) | Partial | Stats cards — Terceros/Productos/Bodegas/Documentos show real counts via `{ limit: 1 }` + `meta.total`. Terceros and Productos count **active-only** (both list endpoints default to `active: true` when the filter is omitted, to support the Activos/Inactivos toggle on their list pages) — this is intentional, not a bug, matching convention across both modules. |
| `/third-parties` | Done | Full CRUD, server-side search, debounce, pagination, cache |
| `/products` | Done | Full CRUD, server-side search, debounce, pagination, cache, stock column (total + per-warehouse breakdown), cost columns ("Costo Prom." / "Últ. Costo") |
| `/warehouses` | Partial | Full CRUD warehouses + zones/bins (backend controllers implemented); sidebar accordion shows sub-items per warehouse; URL-based selection via `?id=` |
| `/documents` | Done | List + form (create/edit/confirm/void), portal Combobox, search-on-type |
| `/users` | Done | Full CRUD, role checkboxes, password confirmation, permission-gated sidebar |
| `/accounts-receivable` | Placeholder | ComingSoonPage |
| `/accounts-payable` | Placeholder | ComingSoonPage |

## Design Tokens

All colors and gradients are tokenized — **never use hardcoded hex values** in components.

**Color classes** (defined in `src/index.css` `@theme`):
- `bg-brand-primary` / `text-brand-primary` — `#141a17` (sidebar, dark surfaces)
- `bg-brand-secondary` / `text-brand-secondary` — `#07bc34` (CTAs, active states)
- `bg-brand-surface` — `#1e2820` (dropdowns on dark backgrounds)
- `bg-brand-primary-dark` — `#0d1210` (page background on login)
- Opacity modifiers work natively: `bg-brand-secondary/10`, `bg-brand-primary/15`

**Gradient utilities** (use as className, never as inline `style`):
- `gradient-action` — green CTA: buttons, active pagination
- `gradient-dark` — dark surface: empty state icons
- `gradient-user` — user avatars: dark-to-green
- `nav-active` — sidebar active NavLink
- `glass` — glassmorphism for dark panel forms
- `text-gradient-brand` — green gradient text for hero copy

## Typography

Fonts loaded in `index.html` from Google Fonts. Applied globally via `@layer base` in `src/index.css`.

| Font | Weight | Applied to | Class |
|------|--------|------------|-------|
| Prompt | Black 900 | h1–h6 (automatic) | — |
| Barlow | Regular 400 | Body text (default) | `font-sans` |
| Barlow | Medium Italic 500 | Subtitles, supporting text | `font-accent` |

**Rule:** Do not add `font-bold` to headings — Prompt Black is applied automatically. Use `font-accent` for subtitle/description text (e.g., page subtitles, date labels, placeholder descriptions).

## UI Conventions

- Error messages in **Spanish** (matches backend)
- Toast pattern: `toast.success` / `toast.error` / `toast.info` (Sonner)
- All stats show `animate-pulse` skeleton while loading, never blank/undefined
- Action buttons hidden (`opacity-0`) on table rows, revealed on `group-hover`
- Path alias `@/*` → `src/*` (same as backend). **Import rule (hybrid — matches `import/no-relative-parent-imports`, Airbnb/Google style guides): use `@/` only when the import would otherwise need to go up a directory (`../`). Same-directory or subdirectory-of-current-directory imports (`./components/X`, `./x.constants`) stay relative.** This keeps feature folders portable (movable without rewriting their internal imports) and preserves `./` as a signal of "lives right next to me" vs `@/` as "cross-cutting dependency from elsewhere in the app." Example: `pages/accounts-payable/AccountsPayableDetailPage.tsx` importing its own `./components/StatusBadge` stays relative; that same component reaching up one level for `../accounts-payable.constants` becomes `@/pages/accounts-payable/accounts-payable.constants` instead.

## Shared Components

`components/shared/` contains reusable primitives for all list/table pages. **Always import from the barrel** `@/components/shared`, never from individual files.

```tsx
// ✅ correct
import { Combobox, StatsGrid, TableToolbar, TableSkeleton, EmptyState, ErrorState, TablePagination } from '@/components/shared'

// ❌ wrong — bypasses barrel
import { StatsGrid } from '@/components/shared/StatsGrid'
```

| Component | Key props | Use when |
|-----------|-----------|----------|
| `Combobox` | `value`, `onChange(id, opt)`, `options: ComboboxOption[]`, `searchValue?`, `onSearchChange?`, `isLoading?`, `placeholder?`, `disabled?`, `error?` | Searchable dropdown. Controlled mode (pass `searchValue`/`onSearchChange`) for server-side debounce; uncontrolled (omit both) for small client-side datasets. Uses `createPortal` — safe inside overflow containers. |
| `StatsGrid` | `cards: StatCard[]`, `isLoading` | 3-card stat row at top of every list page |
| `TableToolbar` | `search`, `onSearchChange`, `placeholder`, `isLoading`, `itemCount`, `total`, `onRefresh` | Search + count + refresh bar above table |
| `TableSkeleton` | `rows?`, `widths: [w1, w2, w3, w4]` | Animated placeholder while data loads |
| `SegmentedToggle` | `checked`, `onChange`, `uncheckedLabel`, `checkedLabel` | Two-option pill toggle (e.g. Activos/Inactivos on Products and ThirdParties list pages) |
| `EmptyState` | `icon`, `title`, `description` | No-data / no-results state inside table |
| `ErrorState` | `message`, `onRetry` | Fetch error state inside table |
| `TablePagination` | `page`, `totalPages`, `total`, `onPageChange` | Footer pagination; auto-hides if `totalPages ≤ 1` |
| `PageLoader` | — | Full-page branded loading spinner |

**Rule:** Before writing inline skeleton, error state, empty state, stats grid, toolbar, pagination, or searchable combobox in a new page — check this list first and use the shared component.

**Component splitting rule** — Extract an inline component when: (a) it exceeds ~100 lines AND has a clearly differentiable responsibility, OR (b) it's duplicated in 2+ files. Do NOT extract when: it's <50 lines and used only once, or when extraction adds more indirection than clarity. Helpers that are just styled wrappers (~10-15 lines) stay inline. Pages >600 lines should be reviewed for extractable sections.

## Dark Mode — MANDATORY for every new component

The app has a dark/light toggle. **Every component must be dark-mode-ready from the start.** The rule is simple: never use hardcoded Tailwind gray classes. Use semantic tokens instead.

| Instead of… | Use… |
|-------------|------|
| `bg-white` | `bg-surface` |
| `bg-gray-50` (elevated area, toolbar, footer) | `bg-surface-raised` |
| `bg-gray-100` (hover state, skeleton) | `bg-surface-hover` |
| `hover:bg-gray-50` | `hover:bg-surface-raised` |
| `hover:bg-gray-100` | `hover:bg-surface-hover` |
| `border-gray-50` / `divide-gray-50` | `border-ui-divide` / `divide-ui-divide` |
| `border-gray-100` | `border-ui-border` |
| `border-gray-200` | `border-ui-border-medium` |
| `text-gray-900` / `text-gray-800` | `text-content` |
| `text-gray-700` / `text-gray-600` | `text-content-secondary` |
| `text-gray-500` | `text-content-muted` |
| `text-gray-400` / `text-gray-300` | `text-content-faint` |
| `bg-gray-50` (page background) | `bg-page` |

**Inline styles with hex colors are forbidden.** Replace with CSS utility classes:
- `style={{ background: 'linear-gradient(135deg, #141a17, #1f2b24)' }}` → `className="gradient-dark"`
- `style={{ background: 'linear-gradient(135deg, #07bc34, #059928)' }}` → `className="gradient-action"`
- `style={{ background: '#141a17' }}` → `className="bg-brand-primary"`

**Status / category pill badges** use Tailwind color classes (green, blue, amber…) which are acceptable, but must include dark-mode variants:
```tsx
// ✅ correct
'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'

// ❌ wrong — no dark variant
'bg-green-100 text-green-700'
```

The `dark:` variant works because `@custom-variant dark (&:is(.dark *))` is declared in `index.css` and `<html class="dark">` is toggled by `useThemeStore` via `AppLayout`.
