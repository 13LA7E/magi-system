# Claude Context

## Current Task

- Active sprint: Sprint 01 — Security Baseline + API Guardrails
- Last completed story: S1-03 — Debug Endpoint Hardening

## Key Facts

- Root instruction file: `CLAUDE.md`
- Slash commands live in `.claude/commands/`
- The app is a Node.js backend that serves a static frontend
- Product spec text is saved at `.claude/product-spec-from-pdf.txt`
- Sprint planning pack is in `.claude/sprints/`
- Execution plan: `.claude/sprints/execution-plan.md`
- Security workstream: `.claude/sprints/security-workstream.md`
- Current sprint backlog: `.claude/sprints/sprint-01-backlog.md`
- Core protocol: seven-stage Crucible with triage, collaborative search, two-stage deliberation, consensus, deadlock detection, synthesis, audit
- Classifications: `PERSONAL`, `FACTUAL`, `CURRENT`
- Key API endpoints: `/`, `/health`, `/api/deliberate`, `/api/audit`, `/api/debug/last`

## Sprint 01 Progress

### Completed
- S1-01 — Added helmet (CSP), 50kb body limit, per-route rate limits (deliberate 20/min, audit 30/min, debug 10/min)
- S1-02 — Added schema validation for POST /api/deliberate: query required/max 2000, testerId optional alphanumeric+hyphens/max 100, developerMode optional boolean; error shape { error, field, message }
- S1-03 — Debug endpoint hardened: 404 when flag unset, 403 + stdout log on weak/missing token, full payload on valid token ≥32 chars

### In Progress
- S1-04 — Configuration Refactor (next)

### Not Started
- S1-05 — Smoke Test Script

## Files Changed This Session

- `backend/server.js` — replaced debug endpoint auth logic with ENABLE_DEBUG_ENDPOINT flag + token length check + unauthorized access logging
- `.claudeignore` — replaced existing entries with exact three entries matching .gitignore (.env, node_modules/, backend/audit.json)

## Checks Run

- `node --check backend/server.js` — pass

## Blockers

- Known: error shape inconsistency — S1-02 validation uses `{ error, field, message }` but legacy triage/daily-limit errors still use `{ status: 'error', message }` — tracked in memory, batch-fix in a future refactor
- Note: Helmet CSP may break Google Fonts in frontend — verify in browser after deploy

## Next Action

- File: `backend/server.js` and `.env.example`
- Task: Implement S1-04 — move DAILY_LIMIT, CORS_ORIGINS, NODE_ENV to env with safe fallbacks; add startup validation warnings (don't crash); log resolved config on startup (redact secrets); add all new keys to `.env.example` with comments

## Detailed Change Log

### `backend/server.js` (S1-02, prior session)
- Removed: single-line legacy check `if (!rawQuery || typeof rawQuery !== 'string')`
- Added: full validation block before triage call in `POST /api/deliberate`:
  - `query` missing, non-string, or blank → 400 `{ error: 'VALIDATION_ERROR', field: 'query', message: '...' }`
  - `query` length > 2000 → 400 same shape
  - `testerId` present but non-string → 400
  - `testerId` length > 100 → 400
  - `testerId` fails `/^[a-zA-Z0-9-]+$/` → 400 (rejects XSS payloads and special chars)
  - `developerMode` present but non-boolean → 400
  - All valid → falls through to triage and deliberation unchanged

### `backend/server.js` (S1-03, this session)
- Removed: token comparison against `process.env.DEBUG_TOKEN`; removed 401 response
- Added: check `process.env.ENABLE_DEBUG_ENDPOINT === 'true'`; returns 404 when false (hides endpoint existence)
- Added: when flag true, check `x-debug-token` header length ≥ 32; returns 403 on failure
- Added: stdout log of IP + timestamp on unauthorized access attempt (403 path)

### `.claudeignore` (this session)
- Replaced prior contents (node_modules/, .env, .env.*, *.log, *.lock, dist/, coverage/) with exact three entries mirroring .gitignore: .env, node_modules/, backend/audit.json

## Issues Found This Session

- Legacy error responses downstream (triage rejection, daily limit 429) still use `{ status: 'error', message }` — not fixed this session, logged as known inconsistency for future batch refactor
- Prior `.claudeignore` had extra entries (.env.*, *.log, *.lock, dist/, coverage/) not present in .gitignore — replaced with exact match per user instruction
