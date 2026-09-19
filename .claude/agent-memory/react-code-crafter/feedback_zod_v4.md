---
name: feedback-zod-v4
description: Zod v4 API changes that break TypeScript builds — invalid_type_error and required_error no longer valid on coerce/enum
metadata:
  type: feedback
---

Project uses **Zod v4** (`^4.4.3`). Several v3 patterns break the build:

- `z.coerce.number({ invalid_type_error: '...' })` → use plain `.positive('...')` / `.min(...)` messages only; the options object no longer accepts `invalid_type_error`
- `z.enum([...] as const, { required_error: '...' })` → just `z.enum([...] as const)`, custom messages go on `.refine()` or `superRefine()`
- Schemas with `.superRefine()` and `z.coerce` fields cause the inferred type to have `unknown` for coerced fields, which breaks `zodResolver`'s Resolver type parameter
- **Workaround**: cast resolver with `as any` on the `useForm` call; cast `onSubmit` with `as any` inside `handleSubmit(onSubmit as any)` — this is safe since the schema still validates at runtime

**Why:** The project upgraded to zod v4 which has breaking API changes from v3. Using v3 patterns silently compiles in some cases but throws TS errors in `tsc`.

**How to apply:** Before writing any zod schema in this project, avoid `invalid_type_error`/`required_error` options. Always cast resolver and handleSubmit args with `as any` when the form has `superRefine` + `coerce` fields.
