# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session Start

**Read this file completely at the start of every session before taking any action.**

## Safety Rules

Do NOT change without explicit instruction and confirmation first:

- **Auth flow** (`AuthModule`, `JwtAuthGuard`, `PermissionsGuard`, JWT payload shape) — every route in the app depends on the current token contract; a silent change locks out users or opens routes.
- **Prisma schema migrations** — always use the manual workaround in `backend/CLAUDE.md`'s Commands section; never run destructive migration commands (`migrate reset`, `db push --force-reset`).
- **Global bootstrap wiring in `main.ts`** (`ValidationPipe`, `PrismaExceptionFilter`, `ResponseFormatInterceptor`, `APP_GUARD` registrations) — these are cross-cutting; breaking one breaks every endpoint's response shape or auth behavior at once.
- **RBAC seed data** (`roles`, `permissions`, `RolePermission` mappings in seed script) — changing names/keys here desyncs already-issued JWTs (permissions are baked into the token, not re-checked against DB).
- **`BinStock` / `Inventory` invariant** (`SUM(BinStock.quantity WHERE warehouseId=W) === Inventory.quantity WHERE warehouseId=W`) — any stock-mutation code must preserve this; breaking it corrupts reported stock silently.

If a change requires touching any of the above, state clearly what and why, and wait for confirmation before implementing.

## Code Documentation Conventions

Document the **why**, never the **what** — well-named identifiers already say what code does; a comment earns its place only when the reader can't derive it from the code itself.

- **Document**: non-obvious business rules/invariants, design decisions with real trade-offs, workarounds for a specific bug/limitation, concurrency/locking rationale, non-obvious algorithms or formats (e.g. zero-padding for lexicographic order), anything that would genuinely surprise a future reader.
- **Don't document**: trivial CRUD, simple getters/destructuring, self-explanatory conditionals, anything a competent reader infers instantly from names/types.
- **Style**: short inline `//` comments in **Spanish** (matches existing comments across the codebase) for business-logic explanations; JSDoc only on exported functions/classes whose behavior isn't obvious from the signature — never on trivial ones. No multi-paragraph comment blocks.
- **Before adding a comment**, check the surrounding code for one that already explains the same thing — don't duplicate.
- This is a comment-only concern — never justifies changing logic, renaming, or refactoring as a side effect of "documenting."

## Project Overview

ERP Supply Chain — full-stack application for managing products, inventory, warehouses, customers, suppliers, accounts receivable/payable, and documents.

- **Backend**: NestJS REST API (`backend/`) — see `backend/CLAUDE.md` for architecture, endpoints, and business rules.
- **Frontend**: React SPA named **EloSC** (`frontend/`), brand colors `#141a17` primary / `#07bc34` secondary — see `frontend/CLAUDE.md` for patterns, design tokens, and conventions.

---

## Routing Rules

Defines when to delegate to a subagent or invoke a skill. **Read the trigger condition; if it matches, invoke that tool BEFORE generating any response.** Triggers are written en lenguaje natural — reconocer la intención aunque la frase exacta difiera.

### Subagents

| Trigger | Subagent | Notes |
|---------|----------|-------|
| Cualquier implementación de frontend: crear O modificar páginas, componentes, hooks, features, formularios, tablas, secciones — "hazme una página de…", "agrega el módulo de…", "necesito la pantalla de…", "crea el form para…", "arregla el bug en…", "cambia el componente de…", "edita la tabla de…", "modifica el form de…" | `react-code-crafter` | Invocar skills `vercel-react-best-practices` **y** `typescript-advanced-types` ANTES de lanzar el agente (siempre ambas, no solo cuando el trigger de tipos avanzados aplica explícitamente). **No alcanza con invocarlas en la sesión orquestadora** — `react-code-crafter` no es un archivo `.md` local editable en este proyecto (agente hospedado externamente), así que no hereda skills cargadas afuera. El prompt de delegación en sí mismo debe instruir explícitamente al agente a invocar `Skill(vercel-react-best-practices)` y `Skill(typescript-advanced-types)` como su propio primer paso, antes de escribir código. Genera código React alineado con los patrones del proyecto (TanStack Query, react-hook-form, tokens de diseño, debounce, paginación) — ver `frontend/CLAUDE.md` |
| Cualquier implementación de backend NestJS: crear O modificar módulos, controllers, services, DTOs, guards, interceptors, estrategias — "agrega el endpoint de…", "crea el módulo de…", "arregla el bug en el service de…", "cambia el controller de…", "implementa la estrategia para…" | `nestjs-code-crafter` | Invocar skills `nestjs-best-practices` **y** `typescript-advanced-types` ANTES de lanzar el agente (siempre ambas). **No alcanza con invocarlas en la sesión orquestadora** — mismo motivo que `react-code-crafter`, agente hospedado externamente, no hereda skills cargadas afuera. El prompt de delegación debe instruir explícitamente al agente a invocar `Skill(nestjs-best-practices)` y `Skill(typescript-advanced-types)` como su propio primer paso. Genera código NestJS alineado con la arquitectura del proyecto (RBAC, DTOs, Prisma, response format, regla híbrida de imports) — ver `backend/CLAUDE.md`; respeta las Safety Rules — si la tarea toca AuthModule/migraciones/bootstrap/seed RBAC/invariante BinStock, debe detenerse y pedir confirmación en vez de proceder |
| Base de datos / Prisma: "agrega índices", "revisa el schema", "audita las tablas", "optimiza queries", "mira mis tablas", "hay duplicados en…", "el query es lento", "diseña las tablas para…", "cómo modelar…" | `prisma-db-architect` | Audita schema.prisma, identifica índices faltantes, modela relaciones, optimiza queries |
| Exploración de código abierta >3 búsquedas: "¿dónde está X?", "¿qué archivos usan Y?", "busca dónde se define…" | `Explore` | Solo lectura; no usar para review ni análisis cross-file profundo |
| Investigación compleja multistep o búsqueda sin dirección clara | `general-purpose` | Cuando Explore o Grep solos no son suficientes |
| Diseñar arquitectura o planificar antes de implementar: "¿cómo deberíamos estructurar…?", "diseña el flujo de…", "planifica la implementación de…", "qué enfoque recomiendas para…" | `Plan` | Devuelve plan paso a paso antes de implementar |

**Regla TODO(human) al delegar a `react-code-crafter`/`nestjs-code-crafter`** (Learning output style): antes de escribir el prompt de delegación, evaluar si la tarea tiene un punto de decisión de lógica de negocio real (regla condicional, algoritmo, forma de un DTO/interfaz, rama de validación) — no una maquetación pura.

- **Maquetación frontend** (layout, JSX, CSS/estilos, estructura de formulario, componentes visuales): delegar 100% al agente, cero checkpoints — nunca pedirle al usuario que la escriba.
- **Cualquier otra cosa con decisión de negocio real** (backend o frontend): implementar esa pieza específica YO MISMO primero, en el archivo real, con código funcionando (no un stub) — después delegar solo el scaffolding/boilerplate alrededor al agente. No mandar el punto de decisión dentro del prompt del subagente, ni como TODO ni de ninguna otra forma.
- **Excepción**: si el usuario pide explícitamente que se implemente todo sin intervención ("hazlo todo", "impleméntalo completo"), se salta este checkpoint para esa tarea puntual, sin objetar.
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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
