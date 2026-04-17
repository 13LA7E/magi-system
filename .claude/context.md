# Claude Context

## Current Task

- Active sprint: Sprint 01 — Security Baseline + API Guardrails
- Last completed story: Unscheduled — Full Codebase Audit & Bug Fix Pass

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
- S1-03 — Debug endpoint hardened + full security review pass (see prior change log)
- Unscheduled — Full codebase audit: 8 bugs fixed across 5 files (see change log below)

### In Progress
- S1-04 — Configuration Refactor (next)

### Not Started
- S1-05 — Smoke Test Script

## Files Changed This Session

- `backend/server.js`
- `backend/deliberation.js`
- `backend/triage.js`
- `backend/db.js`
- `backend/searchOrchestrator.js`

## Checks Run

- `node --check backend/server.js` — pass
- `node --check backend/deliberation.js` — pass
- `node --check backend/triage.js` — pass
- `node --check backend/db.js` — pass
- `node --check backend/searchOrchestrator.js` — pass

## Blockers

- None active
- Known deferred: `parseInt` in TRUST_PROXY_HOPS accepts prefixed strings like `2abc` — not a bug, tracked in memory for future config hygiene pass
- Known deferred: daily limit has a race condition under simultaneous requests — requires atomic counter (Redis or MongoDB `$inc`); out of scope for this sprint
- Known deferred: no MongoDB indexes on `timestamp` — performance concern at scale, not urgent

## Next Action

- File: `backend/server.js` and `.env.example`
- Task: Implement S1-04 — move DAILY_LIMIT, CORS_ORIGINS, NODE_ENV to env with safe fallbacks; add startup validation warnings (don't crash); log resolved config on startup (redact secrets); add all new keys to `.env.example` with comments
- Note: `MONGODB_URI` was added to `db.js` this session — add it to `.env.example` as part of S1-04

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

### `backend/server.js` (S1-03 extended, prior session)

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

### `backend/server.js` (audit pass, this session)

**Timing attack on debug token (Medium)**
- Added: `const crypto = require('crypto')` at top
- Removed: `token !== expectedToken` direct string comparison
- Added: `crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))` with prior length pre-check
- Why: string equality short-circuits on first mismatch; sufficiently fast attackers can brute-force tokens character by character via response timing

**getDailyCount outside try/catch (Medium)**
- Moved: `getDailyCount()` call and the 429 limit check from outside the try block to inside it
- Why: a DB error here propagated as an unhandled rejection, bypassing the global error handler and producing no proper HTTP response

**MongoDB boot failure not fatal (High)**
- Changed: `connectDB().catch(...)` followed by unconditional `app.listen()` to a chained `.then(() => app.listen(...)).catch(() => process.exit(1))`
- Why: server was starting and accepting requests even with no DB connection; audit logging silently failed and daily limits could not be enforced

### `backend/deliberation.js` (audit pass, this session)

**Degraded-mode return missing required fields (High — crash bug)**
- Added to the early-return when ≥2 units fail: `consensus: 'INSUFFICIENT_CONTEXT'`, `weightedScore: 0`, `escalate: false`, `classification`, `searchUsed`
- Why: `server.js` accesses these fields unconditionally after `runDeliberation()` returns; the missing fields caused TypeErrors or logged garbage to MongoDB in the ≥2-unit-failure path

### `backend/triage.js` (audit pass, this session)

**Length check before HTML stripping (Medium)**
- Moved: the `trimmed.length < 10` check to after HTML stripping and whitespace normalisation
- Added: `replace(/\s+/g, ' ').trim()` before `.substring(0, 2000)` to normalise whitespace
- Why: a query like `<script>AAAA</script>hi` (21 chars) passed the pre-strip length check then was stripped to `hi` (2 chars) — below the threshold for meaningful deliberation but not caught

### `backend/db.js` (audit pass, this session)

**Hardcoded MongoDB URI (Medium)**
- Changed: `mongoose.connect('mongodb://localhost:27017/magi')` to read `process.env.MONGODB_URI` with the same string as fallback
- Why: cannot deploy to staging or remote MongoDB without a code change

**getDailyCount using local time instead of UTC (High)**
- Changed: `start.setHours(0, 0, 0, 0)` to construct start-of-day from `new Date().toISOString().slice(0, 10)` → always UTC midnight
- Why: the 429 message tells clients the limit "resets at midnight UTC" but the reset was actually happening at server local midnight, which drifts on any non-UTC host

### `backend/searchOrchestrator.js` (audit pass, this session)

**No ANTHROPIC_API_KEY guard (High)**
- Added: explicit `if (!process.env.ANTHROPIC_API_KEY)` throw at top of `formCollaborativeSearchQuery`
- Added: try/catch around `formCollaborativeSearchQuery()` call inside `getSearchContext`; on failure, returns `searchUsed: false` and logs a warning rather than propagating the throw
- Why: missing key caused the SDK to throw uncaught through `getSearchContext` into `runDeliberation`, crashing the entire deliberation for any CURRENT-classified query; search failure should degrade gracefully

## Issues Found This Session

- Debug token comparison vulnerable to timing attack — fixed with `crypto.timingSafeEqual`
- `getDailyCount` outside try/catch — moved inside
- Server started even if MongoDB unavailable — made DB connection fatal before bind
- Degraded-mode return in `deliberation.js` missing fields accessed by `server.js` — added all required fields
- `triage.js` length check ran before HTML stripping — reordered strip → normalize → check
- `db.js` hardcoded MongoDB URI — moved to env var with fallback
- `db.js` `getDailyCount` used local time not UTC for daily window — fixed to UTC midnight
- `searchOrchestrator.js` no API key guard — added guard + graceful degradation on failure
