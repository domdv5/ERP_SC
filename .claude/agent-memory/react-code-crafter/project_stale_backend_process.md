---
name: project-stale-backend-process
description: A running backend node process can serve stale compiled code even when dist/ is freshly rebuilt — verify process start time vs dist mtime before trusting a 400/missing-field response as a frontend bug
metadata:
  type: project
---

While verifying the PV (preventa) frontend feature end-to-end (2026-07-28), `GET /third-parties?isSeller=true` returned `400 "property isSeller should not exist"` even though `src/third-parties/dto/find-all-third-parties.dto.ts` clearly had `isSeller` implemented, and `dist/src/third-parties/dto/find-all-third-parties.dto.js` (rebuilt at 12:04) also had it compiled in.

Root cause: the node process actually listening on :3000 (`node --enable-source-maps dist/src/main`) had started at 11:57, seven minutes *before* the 12:04 rebuild — Node loads `dist/` into memory at startup and never re-reads it, so the process kept serving pre-rebuild code even though the files on disk were current. `netstat -ano | grep :3000` → PID → `Get-Process -Id <pid> | select StartTime` (PowerShell) is how this was diagnosed; comparing that timestamp against `ls -la dist/src/.../*.js` mtimes made the staleness obvious.

**Why:** this repo's dev workflow (per the separate, non-agent-scoped memory `project_backend_dev_server_runs_dist`) doesn't watch-reload the backend — a rebuild alone is not enough, the process must also be restarted. In a multi-session repo (see `project_concurrent_claude_sessions` in the user's global memory) it's easy for one session's rebuild to go live only after a restart that session didn't perform.

**How to apply:** before concluding "the backend doesn't support X" from a 400/missing-field/unexpected-shape response during manual or Playwright verification, check the *running* process's start time against the relevant compiled file's mtime, not just whether the source/dist has the feature. If stale, this agent cannot restart a shared backend process itself — `Stop-Process` on a foreign PID was blocked by the permission classifier — so report the staleness to the user/orchestrating agent and ask them to restart, rather than treating it as a frontend defect or silently working around it.
