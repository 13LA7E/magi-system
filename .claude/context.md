# Claude Context

## Current Task

- Active sprint: Sprint 01 — Security Baseline + API Guardrails
- Last completed story: S1-03 — Debug Endpoint Hardening (extended: full security review pass)

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
- S1-03 — Debug endpoint hardened + full security review pass (see change log below)

### In Progress
- S1-04 — Configuration Refactor (next)

### Not Started
- S1-05 — Smoke Test Script

## Files Changed This Session

- `backend/server.js`

## Checks Run

- `node --check backend/server.js` — pass

## Blockers

- None active
- Known deferred: `parseInt` in TRUST_PROXY_HOPS accepts prefixed strings like `2abc` — not a bug, tracked in memory for future config hygiene pass

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
  - `testerId` fails `/^[a-zA-Z0-9-]+$/` → 400
  - `developerMode` present but non-boolean → 400

### `backend/server.js` (S1-03 extended, this session)

**Debug endpoint auth (High)**
- Removed: token length-only check (≥32 chars) — any long string was accepted
- Added: `process.env.DEBUG_TOKEN` secret comparison; endpoint returns 403 if token doesn't match exactly
- Added: boot-time guard — if `ENABLE_DEBUG_ENDPOINT=true` and `DEBUG_TOKEN` is absent or under 32 chars, process exits with fatal error before binding

**Trust proxy (Medium)**
- Added: `app.set('trust proxy', ...)` so `req.ip` resolves real client IP behind Cloudflare
- Added: reads `TRUST_PROXY_HOPS` env var; falls back to 1; clamped with `Math.max(1, ...)` to reject negatives
- Added: comment documenting current expected topology (Cloudflare → origin = 1 hop)

**Error shape consistency (Low)**
- Changed: triage rejection at `POST /api/deliberate` from `{ status: 'error', message }` to `{ error: 'VALIDATION_ERROR', message }`
- Changed: daily limit 429 from `{ status: 'error', message }` to `{ error: 'RATE_LIMIT_EXCEEDED', message }`
- Changed: global 500 error handler from `{ status: 'error', message }` to `{ error: 'INTERNAL_ERROR', message }`

**Duplicate variable cleanup (Low)**
- Removed: `const debugEnabled` local variable inside `/api/debug/last` handler — inlined env check directly
- Removed: `const debugEnabled` at boot-time guard — inlined env check directly

## Issues Found This Session

- Debug token auth was effectively public (length check only) — fixed with secret comparison + boot guard
- `req.ip` was logging proxy address, not real client — fixed with trust proxy setting
- Error shapes were inconsistent across 400/429/500 paths — unified to `{ error: 'CODE', message }`
- `debugEnabled` declared in two separate scopes — eliminated both in favour of inline checks
- `TRUST_PROXY_HOPS` accepts prefixed coercions like `2abc` via parseInt — deferred, saved to memory
