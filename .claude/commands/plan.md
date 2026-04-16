# Plan

Use this command to run Sprint 1 in Claude Code with exact, token-efficient prompts.

## Exact Master Prompt (copy-paste)

Implement Sprint 1 from .claude/sprints/sprint-01-backlog.md end-to-end.
Preserve all MAGI invariants in CLAUDE.md.
Work one story at a time in this exact order: S1-01, S1-02, S1-03, S1-04, S1-05.
After each story:
1) run focused validation,
2) summarize what changed with file paths,
3) update .claude/context.md,
4) run /remember.
Constraints:
- keep public API response contracts stable,
- do not edit backend/.env directly,
- keep changes minimal and production-safe.
At the end, provide a final Sprint 1 completion report with checks and any residual risks.

## Exact Per-Story Prompts (copy-paste)

S1-01
Do S1-01 only from .claude/sprints/sprint-01-backlog.md.
File focus: backend/server.js, backend/package.json.
Add Helmet, JSON/body limits, and route rate limiting for /api/deliberate, /api/audit, /api/debug/last.
Do not change existing response shapes.
Run quick endpoint checks and report outcomes.

S1-02
Do S1-02 only from .claude/sprints/sprint-01-backlog.md.
Add strict request validation for POST /api/deliberate: query string required, testerId optional string, developerMode optional boolean.
Return deterministic 400 JSON for invalid payloads.
Do not change deliberation logic or output schema.

S1-03
Do S1-03 only from .claude/sprints/sprint-01-backlog.md.
Harden GET /api/debug/last using ENABLE_DEBUG_ENDPOINT and strong DEBUG_TOKEN rules.
Default behavior must be disabled in production unless explicitly enabled.
Preserve behavior for authorized debug access.

S1-04
Do S1-04 only from .claude/sprints/sprint-01-backlog.md.
Refactor DAILY_LIMIT and CORS origins to env-backed config with safe defaults and startup validation.
Do not modify backend/.env.
Document required env keys in repo docs.

S1-05
Do S1-05 only from .claude/sprints/sprint-01-backlog.md.
Add smoke checks for /health, /api/deliberate, /api/audit, /api/debug/last.
Include negative tests for payload validation and rate limiting.
Output commands run and a concise result table.

## Fast Review Prompt

Review current Sprint 1 diff only for regressions, security gaps, contract breaks, and missing tests.
List findings by severity with file paths and minimal fix steps.
