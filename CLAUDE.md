# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session Start

**Read this file completely at the start of every session before taking any action.**

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

`backend/src/` contains NestJS modules. Implemented modules: `auth`, `prisma`, `third-parties`, `products`, `warehouses`, `documents`, `common`.

**Bootstrap** (`main.ts`):

- Global `ValidationPipe` for DTO validation
- Global `PrismaExceptionFilter` — catches Prisma errors P2002/P2003/P2025 and returns Spanish-language HTTP errors
- Global `ResponseFormatInterceptor` — wraps all responses as `{ success, data }`
- Listens on `PORT` env var (default 3000)

**AppModule** imports: `ConfigModule` (global, reads `.env`), `AuthModule`, `PrismaModule`, `ThirdPartiesModule`, `ProductsModule`, `WarehousesModule`, `DocumentsModule`

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

**CommonModule** (`src/common/`):

- `decorators/permissions.decorator.ts` — `@Permissions(...perms)` sets required permissions via SetMetadata
- `guards/jwt-auth.guard.ts` — validates Bearer token, throws 401 on failure
- `guards/permissions.guard.ts` — checks `request.user.permissions` against required perms, throws 403 if missing
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
- **Inventory** — current stock per `(productId, warehouseId)` composite PK. Query this table for stock, never cache on Product.
- **InventoryMovement** — append-only audit trail; `type` enum: `purchase | sale | return | transfer | adjustment | initial_stock | void | production`
- **Document + DocumentItem** — unified transaction document supporting types: `CM, DVC, RMDVC, PE, EAI, SAJ, COT, POS, REM, DVV, T`
- **AccountsReceivable / AccountsPayable** — payment tracking with credit support
- **User → UserRole → Role → RolePermission → Permission** — full RBAC graph

### Conventions

- **Path alias**: `@/*` maps to `src/*` (configured in `tsconfig.json`)
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

### Stack

| Tool | Use |
|------|-----|
| React 19 + Vite | UI / bundler |
| React Router v7 | SPA routing with lazy routes |
| Tailwind CSS v4 | Utility styles |
| TanStack Query v5 | Server state, cache, mutations |
| Zustand | Client state (`useAuthStore`) |
| Sonner | Toasts/notifications |
| react-hook-form + zod | Form validation |
| lucide-react | Icons |

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
    documents/    ← DocumentsPage + DocumentFormPage + DocumentDetailPage
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

**Combobox with portal** — When a searchable dropdown lives inside a container with `overflow-hidden` or `overflow-x-auto` (e.g. inside a table or card), use `createPortal` + `position: fixed` to avoid clipping. Pattern in `DocumentFormPage.tsx`: `triggerRef.getBoundingClientRect()` sets `top/left/width`; the dropdown renders in `document.body`. Required for any Combobox inside the items table or overflow containers.

**Search-on-type Combobox** — For fields with large datasets (products), set `enabled: debouncedSearch.length >= 1` on the query. Show "Escribe para buscar..." when empty, "Sin resultados" when search returns nothing. Prevents loading thousands of records on dropdown open. When an item is already selected and search is empty, show only that item via a synthetic option built from local state.

**Permission-based UI** — Use `usePermission(...perms)` from `@/hooks/usePermission` to show/hide UI elements. The JWT already carries `permissions[]` so no extra request is needed. Pattern:
```tsx
const canManage = usePermission('user.manage')
// Hide action buttons, sidebar sections, entire CTAs:
{canManage && <button>Nuevo usuario</button>}
```
For sidebar sections that must be hidden for some roles, render the `<NavLink>` conditionally inside the component (not in the static `navGroups` array). See `Sidebar.tsx` "Administración" section as reference.

**Role display names** — Spanish labels for roles live in `users.service.ts` as `ROLE_LABELS: Record<string, string>` with a `getRoleLabel(name)` helper that falls back to `replace(/_/g, ' ')`. Import from there when displaying role names anywhere in the UI.

### Implemented Modules

| Route | Status | Notes |
|-------|--------|-------|
| `/login` | Done | JWT auth, redirects to `/` if already logged in |
| `/` (dashboard) | Partial | Stats cards — Terceros shows real count, rest are static `—` |
| `/third-parties` | Done | Full CRUD, server-side search, debounce, pagination, cache |
| `/products` | Done | Full CRUD, server-side search, debounce, pagination, cache |
| `/warehouses` | Done | Full CRUD, type badge (store/warehouse), soft-delete |
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
- Path alias `@/*` → `src/*` (same as backend)

### Shared Components

`components/shared/` contains reusable primitives for all list/table pages. **Always import from the barrel** `@/components/shared`, never from individual files.

```tsx
// ✅ correct
import { StatsGrid, TableToolbar, TableSkeleton, EmptyState, ErrorState, TablePagination } from '@/components/shared'

// ❌ wrong — bypasses barrel
import { StatsGrid } from '@/components/shared/StatsGrid'
```

| Component | Key props | Use when |
|-----------|-----------|----------|
| `StatsGrid` | `cards: StatCard[]`, `isLoading` | 3-card stat row at top of every list page |
| `TableToolbar` | `search`, `onSearchChange`, `placeholder`, `isLoading`, `itemCount`, `total`, `onRefresh` | Search + count + refresh bar above table |
| `TableSkeleton` | `rows?`, `widths: [w1, w2, w3, w4]` | Animated placeholder while data loads |
| `EmptyState` | `icon`, `title`, `description` | No-data / no-results state inside table |
| `ErrorState` | `message`, `onRetry` | Fetch error state inside table |
| `TablePagination` | `page`, `totalPages`, `total`, `onPageChange` | Footer pagination; auto-hides if `totalPages ≤ 1` |
| `PageLoader` | — | Full-page branded loading spinner |

**Rule:** Before writing inline skeleton, error state, empty state, stats grid, toolbar, or pagination in a new page — check this list first and use the shared component.

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

Defines when to delegate to a subagent or invoke a skill. Read the trigger condition; if it matches, use that tool **before** generating any response.

### Subagents

| Trigger | Subagent | Notes |
|---------|----------|-------|
| "crea el componente / página / hook / feature de…" en el frontend | `react-code-crafter` | Genera código React alineado con los patrones del proyecto (TanStack Query, react-hook-form, tokens de diseño, debounce, paginación) |
| "agrega índices", "revisa el schema", "audita las tablas", "optimiza queries de BD", "mira mis tablas" | `prisma-db-architect` | Audita el schema.prisma, identifica índices faltantes y los agrega según los queries reales del backend |
| Exploración de código abierta que requiere >3 búsquedas: "¿dónde está X?", "¿qué archivos usan Y?" | `Explore` | Solo lectura; no usar para review ni análisis cross-file profundo |
| Investigación compleja multistep o búsqueda sin dirección clara en el código | `general-purpose` | Cuando Explore o Grep solos no son suficientes |
| "diseña / planifica la arquitectura de…", "¿cómo deberíamos estructurar…?" | `Plan` | Devuelve plan paso a paso antes de implementar |
| Preguntas sobre Claude Code CLI, Agent SDK, o la API de Anthropic | `claude-code-guide` | Antes de responder desde memoria, verificar si hay un agente activo que continuar |

### Skills — Frontend

| Trigger | Skill |
|---------|-------|
| Dudas de layout, jerarquía visual, UX de paneles/dashboards/tablas | `interface-design` |
| Optimización de rendimiento en componentes React: re-renders, memoización, bundle, code splitting | `vercel-react-best-practices` |
| Tipos TypeScript complejos: genéricos, tipos condicionales, mapped types, utility types | `typescript-advanced-types` |

### Skills — Backend

| Trigger | Skill |
|---------|-------|
| Crear / revisar módulos NestJS: providers, guards, interceptors, pipes, decorators | `nestjs-best-practices` |
| Patrones de middleware, autenticación, error handling, diseño de API REST en Node.js | `nodejs-backend-patterns` |
| Decisiones de arquitectura Node.js: selección de framework, async patterns, seguridad general | `nodejs-best-practices` |

### Skills — Prisma / Base de Datos

| Trigger | Skill |
|---------|-------|
| Comandos `prisma init`, `prisma generate`, `prisma migrate`, `prisma db`, `prisma studio` | `prisma-cli` |
| Escribir queries: `findMany`, `create`, `update`, `delete`, `$transaction`, filtros, operadores | `prisma-client-api` |
| Configurar Prisma con un nuevo proveedor (PostgreSQL, MySQL, SQLite, MongoDB) | `prisma-database-setup` |
| Crear / operar bases de datos Prisma Postgres (Console, Management API, `create-db`) | `prisma-postgres` |

### Skills — Calidad de Código

| Trigger | Skill |
|---------|-------|
| "revisa el diff / PR" buscando bugs, correctness, reutilización | `code-review` |
| "simplifica / refactoriza el código cambiado" | `simplify` |
| "haz una revisión de seguridad de los cambios" | `security-review` |
| "verifica que el cambio funciona en la app", "confirma que el fix está bien" | `verify` |
| "arranca la app", "corre el proyecto", "muéstrame el resultado en pantalla" | `run` |
| "revisa el PR #N" (GitHub PR review) | `review` |

### Skills — Claude API

| Trigger | Skill |
|---------|-------|
| Cualquier mención de `claude-*`, `anthropic`, `Opus/Sonnet/Haiku`, precios de modelos, streaming, tool use, MCP, caching de tokens | `claude-api` |

### Skills — Configuración de Claude Code

| Trigger | Skill |
|---------|-------|
| "desde ahora cuando X…", "cada vez que X…", "agrega permiso para…", "configura el hook…", cambios a `settings.json` | `update-config` |
| "cambia el shortcut", "reasigna la tecla", modificar `keybindings.json` | `keybindings-help` |
| Reducir prompts de permisos repetitivos | `fewer-permission-prompts` |

### Skills — Automatización

| Trigger | Skill |
|---------|-------|
| "ejecuta X cada N minutos", "repite este comando periódicamente" | `loop` |
| "programa una tarea para las 3pm", "crea un cron job para Claude" | `schedule` |
