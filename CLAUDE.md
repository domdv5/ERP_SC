# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session Start

**Read this file completely at the start of every session before taking any action.**

## Safety Rules

Do NOT change without explicit instruction and confirmation first:

- **Auth flow** (`AuthModule`, `JwtAuthGuard`, `PermissionsGuard`, JWT payload shape) — every route in the app depends on the current token contract; a silent change locks out users or opens routes.
- **Prisma schema migrations** — always use the manual workaround in Commands above; never run destructive migration commands (`migrate reset`, `db push --force-reset`).
- **Global bootstrap wiring in `main.ts`** (`ValidationPipe`, `PrismaExceptionFilter`, `ResponseFormatInterceptor`, `APP_GUARD` registrations) — these are cross-cutting; breaking one breaks every endpoint's response shape or auth behavior at once.
- **RBAC seed data** (`roles`, `permissions`, `RolePermission` mappings in seed script) — changing names/keys here desyncs already-issued JWTs (permissions are baked into the token, not re-checked against DB).
- **`BinStock` / `Inventory` invariant** (`SUM(BinStock.quantity WHERE warehouseId=W) === Inventory.quantity WHERE warehouseId=W`) — any stock-mutation code must preserve this; breaking it corrupts reported stock silently.

If a change requires touching any of the above, state clearly what and why, and wait for confirmation before implementing.

## Project Overview

ERP Supply Chain — full-stack application for managing products, inventory, warehouses, customers, suppliers, accounts receivable/payable, and documents.

- **Backend**: NestJS REST API (`backend/`)
- **Frontend**: React SPA named **EloSC** (`frontend/`), brand colors `#141a17` primary / `#07bc34` secondary

## Commands

All commands run from the `backend/` directory using `pnpm`.

```bash
# Development
pnpm start:dev          # Start with hot reload (watch mode)
pnpm build              # Compile TypeScript via nest build
pnpm start:prod         # Run compiled output

# Code quality
pnpm lint               # ESLint with auto-fix
pnpm format             # Prettier format

# Testing
pnpm test               # Run all Jest unit tests
pnpm test:watch         # Watch mode
pnpm test:cov           # With coverage
# Run a single test file:
pnpm exec jest path/to/file.spec.ts

# Database
pnpm migrate:dev        # Run Prisma migrations (dev) — requires interactive TTY
pnpm seed               # Seed roles, permissions, warehouses, categories, genders
```

> **Migration workaround** — `migrate:dev` needs an interactive terminal and fails in Claude Code. Use instead:
> 1. `pnpm exec prisma migrate diff --config prisma/prisma.config.ts --from-config-datasource --to-schema prisma/schema.prisma --script` → get SQL
> 2. Create `prisma/migrations/<timestamp>_<name>/migration.sql` manually with that SQL
> 3. `pnpm exec prisma migrate deploy --config prisma/prisma.config.ts` → apply
> 4. `pnpm exec prisma generate --config prisma/prisma.config.ts` → regenerate client

## Architecture

### Module Structure

`backend/src/` contains NestJS modules. Implemented modules: `auth`, `prisma`, `third-parties`, `products`, `warehouses`, `documents`, `accounts-payable`, `accounts-receivable`, `common`.

**Bootstrap** (`main.ts`):

- Global `ValidationPipe` for DTO validation
- Global `PrismaExceptionFilter` — catches Prisma errors P2002/P2003/P2025 and returns Spanish-language HTTP errors
- Global `ResponseFormatInterceptor` — wraps all responses as `{ success, data }`
- Listens on `PORT` env var (default 3000)

**AppModule** imports: `ConfigModule` (global, reads `.env`), `AuthModule`, `PrismaModule`, `ThirdPartiesModule`, `ProductsModule`, `WarehousesModule`, `DocumentsModule`, `AccountsPayableModule`, `AccountsReceivableModule`

**PrismaModule** is global — inject `PrismaService` anywhere without re-importing the module.

**AuthModule**:

- `GET /auth` — list all users with roles; requires `user.manage`
- `GET /auth/roles` — list all active roles with their permissions; requires `user.manage`
- `POST /auth` — create user (requires name, username, password, roleIds[]); requires `user.manage`
- `PATCH /auth/:id` — update user (password and roleIds optional); requires `user.manage`
- `DELETE /auth/:id` — delete user (hard delete); requires `user.manage`
- `POST /auth/login` — returns JWT containing `{ sub, name, username, permissions[] }`
- `JwtAuthGuard` — validates Bearer token; attaches `{ sub, name, username, permissions[] }` to `request.user`
- JWT expiration: 8 hours
- **Route order rule**: `GET /auth/roles` must be declared before any future `GET /auth/:id` to prevent NestJS treating `"roles"` as an id param

**ThirdPartiesModule**:

- `POST /third-parties` — create a third party (customer and/or supplier); requires `thirdparty.create` permission
- `PATCH /third-parties/:id` — update; requires `thirdparty.update`
- `DELETE /third-parties/:id` — soft-delete; requires `thirdparty.delete`
- `PATCH /third-parties/:id/brands/:brandId` — rename a brand in-place; requires `thirdparty.update`
- Supports `personType`: `natural` | `juridica`
- Supports `documentType`: `CC | NIT | CE | PAS | TI | RC`
- Conditional validation: natural persons require `firstName`/`lastName`; juridical persons require `businessName`
- Optional customer fields: `creditLimit`, `discount`, `sellerId`
- Optional supplier field: `internalNumber`
- Transactional creation: ThirdParty + Customer/Supplier records in one transaction
- **Brand rules**: brands can only be added or renamed — never deleted (products reference them). `update` does `createMany` + `skipDuplicates`; frontend sends only new brands (not already in `brandIds` map). Roles (`isCustomer`/`isSupplier`) are derived from the presence of `customer`/`supplier` relations, not boolean columns.

**WarehousesModule**:

- `GET /warehouses` — list all warehouses (optional `?active=true|false`); JWT required
- `GET /warehouses/:id` — detail with zones → bins hierarchy; JWT required
- `POST /warehouses` — create; requires `warehouse.manage` permission
- `PATCH /warehouses/:id` — update; requires `warehouse.manage` permission
- `DELETE /warehouses/:id` — soft-delete (`active: false`); requires `warehouse.manage` permission
- `type` is `WarehouseType` enum: `store` (almacén, sellable stock) | `warehouse` (bodega, storage only)
- Seed creates two records: `Almacén` (store) and `Bodega` (warehouse)
- Sales operations must only validate against `store`-type warehouse inventory
- Single permission `warehouse.manage` covers all write operations
- **Sub-resources (Aggregate Root pattern)**: Zone and Bin live inside WarehousesModule — no separate module. URLs: `POST /warehouses/:id/zones`, `PATCH /warehouses/:id/zones/:zoneId`, `DELETE /warehouses/:id/zones/:zoneId`, and equivalent `/bins` nested under `/zones/:zoneId/bins`. Justification: Zone/Bin have no lifecycle outside Warehouse; all endpoints require `:warehouseId` as first param.
- **Zone fields**: `name` (unique per warehouse via `@@unique([warehouseId, name])`), `active` (soft-delete)
- **Bin fields**: `code` (`Int`, numeric bin number 1..n, unique per zone via `@@unique([zoneId, code])`), `active` (soft-delete)
- **Business rules**: `removeZone` must verify no active bins; `removeBin` must verify `Inventory.quantity === 0`
- **findOne filter**: must return only `active: true` zones and bins (TASK 5, pending)

**DocumentsModule**:

- `GET /documents` — list with filters (type, status, dateFrom, dateTo, search); requires `document.read`
- `GET /documents/:id` — detail with items, parties, warehouses; requires `document.read`
- `POST /documents` — create draft; permission checked dynamically: `document.create.{type}`
- `PATCH /documents/:id` — update draft (replaces items); same dynamic permission
- `POST /documents/:id/confirm` — apply effects (stock, kardex, accounts); same dynamic permission
- `POST /documents/:id/void` — reverse movements, delete CxP; same dynamic permission
- `DELETE /documents/:id` — delete draft only; same dynamic permission
- **Strategy pattern**: `DocumentEffectsRegistry` maps type → strategy; add new types without touching service
- **Warehouse rule**: for all types except `T`, service always resolves the active `store`-type warehouse; client never sends `warehouseId` for non-transfer docs
- **Implemented strategies (phase 1)**: `CM` (purchase), `DVC` (supplier return), `EAI` (stock adjustment in), `SAJ` (stock adjustment out), `T` (transfer)
- **Phase 2 types** (not yet implemented): `COT`, `POS`, `DVV`, `REM`, `RMDVC`, `PE` — each needs only a new Strategy class

**AccountsPayableModule**:

- `GET /accounts-payable` — list paginated, filters by `status`/`supplierId`/`search` (supplier name); requires `ap.read`
- `GET /accounts-payable/:id` — detail with `supplier.thirdParty`, `document`, `payablePayments` (desc); requires `ap.read`
- `POST /accounts-payable/:id/payments` — register a payment; requires `ap.manage`. Runs in `$transaction`, validates payment doesn't exceed pending balance (compared in integer cents via `toCents()` to avoid float drift), recomputes `status` (`pending` | `partial` | `paid`)
- Created automatically by `CM`/`DVC` document strategies on confirm; deleted on void (blocked if it already has payments)

**AccountsReceivableModule**:

- Mirrors `AccountsPayableModule` exactly, client side instead of supplier side — same endpoints (`GET /accounts-receivable`, `GET /accounts-receivable/:id`, `POST /accounts-receivable/:id/payments`), same `$transaction` + cents-based balance validation pattern, requires `ar.read` / `ar.manage`
- **Schema differences from AccountsPayable — do not copy blindly**: `AccountsReceivable` has two party relations (`client` via `Customer.thirdParty`, and `seller` via `ThirdParty` directly, relation name `SellerAR`) instead of AP's single `supplier`; `ReceivablePayment` has no `bankDestination` field (AP's `PayablePayment` does)
- Not yet wired to any document strategy (sales document types `COT`/`POS`/`DVV` are still Phase 2 — see DocumentsModule below), so records currently must be created manually until those strategies exist

**CommonModule** (`src/common/`):

- `decorators/permissions.decorator.ts` — `@Permissions(...perms)` sets required permissions via SetMetadata
- `decorators/public.decorator.ts` — `@Public()` marks a route as unauthenticated (skips JWT guard)
- `guards/jwt-auth.guard.ts` — global guard (registered via `APP_GUARD` in `AppModule`); checks `IS_PUBLIC_KEY` via Reflector before validating Bearer token; throws 401 on failure
- `guards/permissions.guard.ts` — global guard (registered via `APP_GUARD`); checks `request.user.permissions` against required perms, throws 403 if missing. `@Permissions` can be placed at class level (applies to all methods) or method level (overrides class)
- `filters/prisma-exception.filter.ts` — maps Prisma errors to HTTP responses (Spanish messages)
- `interceptors/response-format.interceptor.ts` — wraps responses as `{ success: true, data: T }`
- `enums/index.ts` — exports `MovementType`, `DocumentType`, `DocumentStatus`
- `types/index.ts` — exports `JwtPayload`, `RequestWithUser`, `ResponseFormat<T>`

### Authentication & Authorization

JWT includes the user's full permission set (loaded from Role → RolePermission → Permission at login time). Guards check against this in-token permissions array — no per-request DB lookup needed.

RBAC roles defined in seed: `admin`, `purchasing`, `warehouse`, `basket_management`, `billing`, `accounts_payable_admin`, `accounts_receivable_admin`.

Permissions are namespaced by module: `products.*`, `documents.*`, `warehouses.*`, `third_parties.*`, `accounts.*`, `cash.*`, `users.*`, `labels.*`.

### Database (Prisma + PostgreSQL)

Schema: `backend/prisma/schema.prisma`. Uses `@prisma/adapter-pg` for connection pooling.

Key domain models and their relationships:

- **ThirdParty** → base for `Customer` and `Supplier` (one-to-one)
- **Product** — has pricing (`salePrice`, `minSalePrice`) and costing (`avgCost`, `lastCost`). No stock cache field — stock is always queried from `Inventory`.
- **Warehouse → Zone → Bin** — three-level location hierarchy. `Warehouse.type` is a `WarehouseType` enum (`store` | `warehouse`).
- **Inventory** — current stock per `(productId, warehouseId)` composite PK. `quantity` is `Int`. Query this table for stock totals (used by sales/POS). Never cache on Product.
- **BinStock** — bin-level stock per `(productId, binId)` composite PK. Has denormalized `warehouseId` to avoid 3-level JOIN. Only populated by transfer documents (type `T`). Purchases (CM) only update `Inventory` — all incoming stock enters the warehouse without bin assignment. Invariant: `SUM(BinStock.quantity WHERE warehouseId=W) === Inventory.quantity WHERE warehouseId=W`.
- **InventoryMovement** — append-only audit trail; `type` enum: `purchase | sale | return | transfer | adjustment | initial_stock | void | production`. `quantity`, `previousStock`, `newStock` are `Int`.
- **DocumentItem** — `quantity` is `Int`. Costs/prices (`unitCost`, `unitPrice`, `subtotal`) remain `Decimal`.
- **Document + DocumentItem** — unified transaction document supporting types: `CM, DVC, RMDVC, PE, EAI, SAJ, COT, POS, REM, DVV, T`
- **AccountsReceivable / AccountsPayable** — payment tracking with credit support
- **User → UserRole → Role → RolePermission → Permission** — full RBAC graph

### Conventions

- **Path alias**: `@/*` maps to `src/*` (configured in `tsconfig.json`). Verified working at build time: `nest build`'s compiler resolves `@/` to relative paths in the emitted `dist/` output, so it's safe at runtime too. **Import rule (hybrid — matches `import/no-relative-parent-imports`, Airbnb/Google style guides): use `@/` only when the import would otherwise need to go up a directory (`../`). Same-directory or subdirectory-of-current-directory imports (`./create-x.dto`, `./strategies/index`) stay relative.** This keeps modules portable (movable without rewriting their internal imports) and preserves `./` as a signal of "lives right next to me" vs `@/` as "cross-cutting dependency from elsewhere in the app." Example: `documents/dto/index.ts` re-exporting `./create-document.dto` stays relative (same folder); a file needing something from `common/` two levels up uses `@/common/x` instead of `../../common/x`.
- **Response format**: Always `{ success: boolean, data: T }` — the interceptor handles wrapping; `message` is optional
- **Error messages**: Spanish language (matches existing filter messages)
- **Passwords**: bcrypt, 10 salt rounds
- **Config**: All secrets via `ConfigService` from `.env` (`DATABASE_URL`, `JWT_SECRET`)

---

## Frontend (EloSC)

### Commands

All commands run from the `frontend/` directory using `pnpm`.

```bash
pnpm dev          # Start Vite dev server
pnpm build        # Production build
pnpm preview      # Preview production build
pnpm lint         # ESLint
```

### Testing frontend changes

When verifying any frontend behavior end-to-end (forms, flows, bug fixes), use the **Playwright CLI in headed mode** — write an ad-hoc script using the `playwright` package already installed in `frontend/` (`chromium.launch({ headless: false })`) and run it with `node`. Not the chrome-devtools MCP tools, not headless. The user wants to see the browser window while the flow runs.

### Stack

React 19 + Vite, React Router v7 (lazy routes), Tailwind CSS v4, TanStack Query v5, Zustand (`useAuthStore` for client state), Sonner (toasts), react-hook-form + zod, lucide-react.

### Structure

```
frontend/src/
  components/
    layout/       ← AppLayout, Sidebar, Header, AuthGuard
    shared/       ← PageLoader (branded 3-ring gyroscope)
  pages/
    auth/         ← LoginPage
    dashboard/    ← DashboardPage
    third-parties/← ThirdPartiesPage + ThirdPartyForm + DeleteConfirmDialog
    documents/    ← DocumentsPage + DocumentFormPage + DocumentDetailPage + components/ProductRow + document-form.schema.ts
    users/        ← UsersPage + components/UserForm + components/DeleteUserDialog
    coming-soon/  ← ComingSoonPage (placeholder for unimplemented modules)
  router/         ← index.tsx (lazy routes, authenticated layout)
  services/       ← third-parties.service.ts, documents.service.ts, users.service.ts, api.ts (axios instance)
  stores/         ← auth.store.ts (Zustand)
  hooks/          ← usePermission.ts (checks user.permissions[] from JWT)
  types/          ← shared TypeScript types
  lib/            ← utils (cn), queryClient
```

### Key Patterns

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

**Combobox (shared)** — Use `<Combobox>` from `@/components/shared` for all searchable dropdowns. Two modes: (1) **Controlled** — pass `searchValue`/`onSearchChange` for server-side debounce; show "Escribe para buscar..." when empty, let caller manage `enabled` on the query; (2) **Uncontrolled** — omit both props, component filters `options` client-side. Always uses `createPortal` → safe inside overflow containers. Option interface: `{ id, label, sublabel? }`. `onChange` signature: `(id: string, option: ComboboxOption) => void`. For server-side search, add a synthetic option when an item is already selected and search is empty (prevents the trigger showing blank).

**Permission-based UI** — Use `usePermission(...perms)` from `@/hooks/usePermission` to show/hide UI elements. The JWT already carries `permissions[]` so no extra request is needed. Pattern:
```tsx
const canManage = usePermission('user.manage')
// Hide action buttons, sidebar sections, entire CTAs:
{canManage && <button>Nuevo usuario</button>}
```
For sidebar sections that must be hidden for some roles, render the `<NavLink>` conditionally inside the component (not in the static `navGroups` array). See `Sidebar.tsx` "Administración" section as reference.

**Sidebar accordion nav items** — When a nav section needs collapsible sub-items (e.g. Bodegas), create a dedicated component (`WarehousesSidebarItem`) instead of a static NavLink. Use `useLocation` + `useState` for open/close; `max-height` CSS transition for animation; `useQuery` to load sub-items from API. Sub-item links use `Link` (not `NavLink`) with manual `isActive` computed from `location.search` — React Router's NavLink `isActive` ignores query params and would mark all sub-items active simultaneously.

**Role display names** — Spanish labels for roles live in `users.service.ts` as `ROLE_LABELS: Record<string, string>` with a `getRoleLabel(name)` helper that falls back to `replace(/_/g, ' ')`. Import from there when displaying role names anywhere in the UI.

### Implemented Modules

| Route | Status | Notes |
|-------|--------|-------|
| `/login` | Done | JWT auth, redirects to `/` if already logged in |
| `/` (dashboard) | Partial | Stats cards — Terceros shows real count, rest are static `—` |
| `/third-parties` | Done | Full CRUD, server-side search, debounce, pagination, cache |
| `/products` | Done | Full CRUD, server-side search, debounce, pagination, cache |
| `/warehouses` | Partial | Full CRUD warehouses + zones/bins (backend controllers implemented); sidebar accordion shows sub-items per warehouse; URL-based selection via `?id=` |
| `/documents` | Done | List + form (create/edit/confirm/void), portal Combobox, search-on-type |
| `/users` | Done | Full CRUD, role checkboxes, password confirmation, permission-gated sidebar |
| `/accounts-receivable` | Placeholder | ComingSoonPage |
| `/accounts-payable` | Placeholder | ComingSoonPage |

### Design Tokens

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

### Typography

Fonts loaded in `index.html` from Google Fonts. Applied globally via `@layer base` in `src/index.css`.

| Font | Weight | Applied to | Class |
|------|--------|------------|-------|
| Prompt | Black 900 | h1–h6 (automatic) | — |
| Barlow | Regular 400 | Body text (default) | `font-sans` |
| Barlow | Medium Italic 500 | Subtitles, supporting text | `font-accent` |

**Rule:** Do not add `font-bold` to headings — Prompt Black is applied automatically. Use `font-accent` for subtitle/description text (e.g., page subtitles, date labels, placeholder descriptions).

### UI Conventions

- Error messages in **Spanish** (matches backend)
- Toast pattern: `toast.success` / `toast.error` / `toast.info` (Sonner)
- All stats show `animate-pulse` skeleton while loading, never blank/undefined
- Action buttons hidden (`opacity-0`) on table rows, revealed on `group-hover`
- Path alias `@/*` → `src/*` (same as backend). **Import rule (hybrid — matches `import/no-relative-parent-imports`, Airbnb/Google style guides): use `@/` only when the import would otherwise need to go up a directory (`../`). Same-directory or subdirectory-of-current-directory imports (`./components/X`, `./x.constants`) stay relative.** This keeps feature folders portable (movable without rewriting their internal imports) and preserves `./` as a signal of "lives right next to me" vs `@/` as "cross-cutting dependency from elsewhere in the app." Example: `pages/accounts-payable/AccountsPayableDetailPage.tsx` importing its own `./components/StatusBadge` stays relative; that same component reaching up one level for `../accounts-payable.constants` becomes `@/pages/accounts-payable/accounts-payable.constants` instead.

### Shared Components

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
| `EmptyState` | `icon`, `title`, `description` | No-data / no-results state inside table |
| `ErrorState` | `message`, `onRetry` | Fetch error state inside table |
| `TablePagination` | `page`, `totalPages`, `total`, `onPageChange` | Footer pagination; auto-hides if `totalPages ≤ 1` |
| `PageLoader` | — | Full-page branded loading spinner |

**Rule:** Before writing inline skeleton, error state, empty state, stats grid, toolbar, pagination, or searchable combobox in a new page — check this list first and use the shared component.

**Component splitting rule** — Extract an inline component when: (a) it exceeds ~100 lines AND has a clearly differentiable responsibility, OR (b) it's duplicated in 2+ files. Do NOT extract when: it's <50 lines and used only once, or when extraction adds more indirection than clarity. Helpers that are just styled wrappers (~10-15 lines) stay inline. Pages >600 lines should be reviewed for extractable sections.

### Dark Mode — MANDATORY for every new component

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

---

## Routing Rules

Defines when to delegate to a subagent or invoke a skill. **Read the trigger condition; if it matches, invoke that tool BEFORE generating any response.** Triggers are written en lenguaje natural — reconocer la intención aunque la frase exacta difiera.

### Subagents

| Trigger | Subagent | Notes |
|---------|----------|-------|
| Cualquier implementación de frontend: crear O modificar páginas, componentes, hooks, features, formularios, tablas, secciones — "hazme una página de…", "agrega el módulo de…", "necesito la pantalla de…", "crea el form para…", "arregla el bug en…", "cambia el componente de…", "edita la tabla de…", "modifica el form de…" | `react-code-crafter` | Invocar skill `vercel-react-best-practices` ANTES de lanzar el agente, e incluir las reglas relevantes en el prompt. Genera código React alineado con los patrones del proyecto (TanStack Query, react-hook-form, tokens de diseño, debounce, paginación) |
| Cualquier implementación de backend NestJS: crear O modificar módulos, controllers, services, DTOs, guards, interceptors, estrategias — "agrega el endpoint de…", "crea el módulo de…", "arregla el bug en el service de…", "cambia el controller de…", "implementa la estrategia para…" | `nestjs-code-crafter` | Invocar skill `nestjs-best-practices` ANTES de lanzar el agente, e incluir las reglas relevantes en el prompt. Genera código NestJS alineado con la arquitectura del proyecto (RBAC, DTOs, Prisma, response format, regla híbrida de imports); respeta las Safety Rules — si la tarea toca AuthModule/migraciones/bootstrap/seed RBAC/invariante BinStock, debe detenerse y pedir confirmación en vez de proceder |
| Base de datos / Prisma: "agrega índices", "revisa el schema", "audita las tablas", "optimiza queries", "mira mis tablas", "hay duplicados en…", "el query es lento", "diseña las tablas para…", "cómo modelar…" | `prisma-db-architect` | Audita schema.prisma, identifica índices faltantes, modela relaciones, optimiza queries |
| Exploración de código abierta >3 búsquedas: "¿dónde está X?", "¿qué archivos usan Y?", "busca dónde se define…" | `Explore` | Solo lectura; no usar para review ni análisis cross-file profundo |
| Investigación compleja multistep o búsqueda sin dirección clara | `general-purpose` | Cuando Explore o Grep solos no son suficientes |
| Diseñar arquitectura o planificar antes de implementar: "¿cómo deberíamos estructurar…?", "diseña el flujo de…", "planifica la implementación de…", "qué enfoque recomiendas para…" | `Plan` | Devuelve plan paso a paso antes de implementar |
| Preguntas sobre Claude Code CLI, hooks, settings, Agent SDK, API de Anthropic | `claude-code-guide` | Verificar si hay un agente activo antes de lanzar uno nuevo |

### Skills — Diseño UI / Frontend

| Trigger | Skill |
|---------|-------|
| Preguntas sobre diseño visual, UX, colores, qué se ve mejor, cómo mejorar visualmente, jerarquía, layout, espaciado, qué color usar, iconos, contraste, modo oscuro, dashboard looks, recomendación de UI — "¿cómo se ve?", "¿qué recomiendas para…?", "¿queda bien así?", "mejora el diseño de…", "hay mucho verde", "quiero variedad de colores", "no me gusta cómo se ve" | `interface-design` |
| Cualquier trabajo de frontend React: crear, modificar, revisar, o hablar sobre componentes, páginas, hooks, estado, performance, bundle — siempre invocar antes de delegar al agente `react-code-crafter` | `vercel-react-best-practices` |
| TypeScript avanzado: genéricos, tipos condicionales, mapped types, infer, utility types, errores de tipo difíciles | `typescript-advanced-types` |

### Skills — Backend NestJS / Node.js

| Trigger | Skill |
|---------|-------|
| Crear o revisar módulos NestJS: providers, guards, interceptors, pipes, decorators, módulos, controladores — "cómo hago un guard", "necesito un interceptor", "agrega un pipe de validación" — siempre invocar antes de delegar al agente `nestjs-code-crafter` | `nestjs-best-practices` |
| Patrones de middleware, autenticación JWT, error handling, diseño de endpoints REST, rate limiting, CORS — "cómo manejo el error de…", "cómo estructuro este endpoint", "necesito middleware para…" | `nodejs-backend-patterns` |
| Decisiones de arquitectura Node.js: framework, async/await patterns, seguridad, variables de entorno, estructura de proyecto | `nodejs-best-practices` |

### Skills — Prisma / Base de Datos

| Trigger | Skill |
|---------|-------|
| Comandos CLI de Prisma: `migrate`, `generate`, `db push`, `studio`, `seed`, `introspect` — "cómo corro la migración", "el generate está fallando" | `prisma-cli` |
| Escribir queries Prisma: `findMany`, `create`, `update`, `upsert`, `$transaction`, `include`, `select`, filtros, paginación — "cómo hago un query que…", "necesito filtrar por…" | `prisma-client-api` |
| Configurar Prisma con PostgreSQL, MySQL, SQLite, MongoDB — conexión, datasource, adapter | `prisma-database-setup` |
| Prisma Postgres cloud (Console, Management API) | `prisma-postgres` |

### Skills — Calidad de Código
| Trigger | Skill |
|---------|-------|
| Revisar código por bugs, correctness o reutilización: "revisa el diff", "revisa el PR", "¿está bien esto?", "busca errores en…" | `code-review` |
| Simplificar o refactorizar: "simplifica esto", "está muy largo", "refactoriza el código de…", "hay mucha repetición" | `simplify` |
| Revisión de seguridad: "¿es seguro esto?", "revisa vulnerabilidades", "hay algún problema de seguridad" | `security-review` |
| Verificar que algo funciona en la app: "confirma que el fix está bien", "prueba que funciona", "¿quedó bien el cambio?" | `verify` |
| Arrancar la app o mostrar resultado en pantalla: "corre el proyecto", "muéstrame cómo queda", "arranca el servidor" | `run` |
| Revisar un PR de GitHub por número: "revisa el PR #N" | `review` |

### Skills — Claude API

| Trigger | Skill |
|---------|-------|
| Mención de modelos claude-*, Anthropic API, Opus/Sonnet/Haiku, streaming, tool use, MCP, caching de tokens, precios de modelos | `claude-api` |

### Skills — Configuración de Claude Code

| Trigger | Skill |
|---------|-------|
| Cambiar comportamiento de Claude Code: "desde ahora cuando X…", "agrega permiso para…", "configura el hook…", "quiero que siempre…", cambios a `settings.json` | `update-config` |
| Cambiar atajos de teclado: "cambia el shortcut de…", "reasigna la tecla…", `keybindings.json` | `keybindings-help` |
| Reducir prompts de permisos repetitivos | `fewer-permission-prompts` |

### Skills — Automatización

| Trigger | Skill |
|---------|-------|
| Repetir una tarea periódicamente: "ejecuta X cada N minutos", "repite este comando", "corre esto en loop" | `loop` |
| Programar una tarea a una hora específica: "programa esto para las 3pm", "crea un cron job" | `schedule` |
