---
name: todo-human-checkpoint-no-compile-error
description: A method left with only a TODO(human) comment after an async $transaction fetch and no explicit return does NOT produce a tsc error in this repo — inferred return type absorbs it
metadata:
  type: project
---

When a task instructs inserting a `TODO(human)` checkpoint block (learning-mode methodology) inside
an async service method and leaving the method without a `return` statement, don't assume `tsc
--noEmit` will report a compile error at that point. This repo's `backend/tsconfig.json` has no
explicit return-type annotations required on service methods and no `noImplicitReturns` flag, so
TypeScript infers `Promise<void>` for a method with no `return` and the file compiles cleanly (exit
0, zero diagnostics) — verified 2026-08-03 on `ProductsService.findLocationsByCode`. The controller
call site (`return this.productsService.findLocationsByCode(code)`) also compiles fine since it
just returns `undefined` up through NestJS, which is a *runtime* correctness gap (endpoint
responds with `{ success: true, data: undefined }` until the human fills in the TODO), not a
type-level one.

**Why:** a prior task's instructions explicitly asked me to verify and report "the expected
compile error at the TODO point" — the accurate finding was that no such error exists, so I
reported that instead of fabricating one or trying to force one by adding an explicit `Promise<T>`
return annotation (which the instructions also forbade — no stub returns).

**How to apply:** for future `TODO(human)`-checkpoint tasks in this backend, run `tsc --noEmit`
as instructed but report the *actual* result rather than the expected one if they diverge. If the
task's premise depends on a compile error occurring and it doesn't, say so plainly rather than
declaring success or quietly "fixing" it by adding a stub return (which the checkpoint methodology
explicitly forbids per [[project_learning_mode_backend_todo_pattern]]).
