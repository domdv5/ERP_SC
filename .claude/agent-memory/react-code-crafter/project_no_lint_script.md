---
name: project-no-lint-script
description: frontend/package.json has no "lint" script and no ESLint config/binary at all — CLAUDE.md's `pnpm lint` command is stale
metadata:
  type: project
---

As of 2026-07-27, `frontend/package.json` scripts are only `dev`, `build`, `preview` — there is no `lint` script. There's also no `eslint.config.*`/`.eslintrc*` in `frontend/` and no `eslint` binary in `frontend/node_modules/.bin/`. Confirmed via direct `ls`/grep, not assumed.

**Why it matters:** CLAUDE.md's frontend Commands section still lists `pnpm lint # ESLint` as a real, runnable command, and verification steps in plans/task prompts routinely ask for it. It will always fail with `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "lint" not found`.

**How to apply:** When a task's verification steps include `pnpm lint` for the frontend, run it, get the "not found" error, and report the gap honestly instead of fabricating a pass — don't silently skip it either. Only `pnpm exec tsc --noEmit` is currently a real, runnable frontend verification gate. Flag to the user that CLAUDE.md's lint line is inaccurate so they can either add the script or fix the doc.
