# Sprint 01 — Security Baseline + API Guardrails

**Goal:** Establish production-grade security baseline without breaking deliberation behavior.
**Length:** 2 weeks
**Prerequisite:** None (first sprint)

> For exact copy-paste prompts, see `.claude/commands/plan.md` Sprint 1 section.

---

## Stories

### S1-01 — Security Middleware Foundation
**Files:** `backend/server.js`, `backend/package.json`

Add:
- `helmet` package with strict CSP and security header policy
- `express.json({ limit: '50kb' })` body size cap
- `express-rate-limit` on `/api/deliberate`, `/api/audit`, `/api/debug/last`
  - `/api/deliberate`: 20 req/min per IP
  - `/api/audit`: 30 req/min per IP
  - `/api/debug/last`: 10 req/min per IP

Done when:
- Security headers present on all responses (verify with curl -I)
- 429 returned consistently on rate limit breach
- No existing response shapes changed

---

### S1-02 — Request Validation
**File:** `backend/server.js`

Add schema validation for `POST /api/deliberate` body:
- `query`: string, required, max 2000 chars
- `testerId`: string, optional, max 100 chars, alphanumeric + hyphens
- `developerMode`: boolean, optional

Error shape: `{ "error": "VALIDATION_ERROR", "field": "query", "message": "..." }`

Done when:
- Missing `query` → 400 with `VALIDATION_ERROR`
- `query` over 2000 chars → 400
- Valid payload → deliberation runs unchanged
- testerId with XSS payload → sanitized or rejected

---

### S1-03 — Debug Endpoint Hardening
**File:** `backend/server.js`

Changes:
- Add `ENABLE_DEBUG_ENDPOINT` env flag (default: `false`)
- When flag is `false`: return `404` (not `401`) — do not reveal endpoint exists
- When flag is `true`: require `x-debug-token` header of minimum 32 chars
- Log unauthorized access attempts (IP + timestamp) to stdout

Done when:
- Without flag set: GET /api/debug/last returns 404
- With flag + weak token: returns 403
- With flag + valid token: returns full debug payload unchanged

---

### S1-04 — Configuration Refactor
**Files:** `backend/server.js`, `.env.example`

Move to env:
- `DAILY_LIMIT` (default: `100`)
- `CORS_ORIGINS` (comma-separated, default: `https://trymagi.tech`)
- `NODE_ENV` usage in startup checks

Add startup validation:
- Warn (don't crash) if `DAILY_LIMIT` not set
- Warn if `CORS_ORIGINS` contains `localhost` in production
- Log resolved config values on startup (redact secrets)

Done when:
- Server reads limits from env with safe fallbacks
- `.env.example` has all new keys with comments
- `backend/.env` NOT modified

---

### S1-05 — Smoke Test Script
**New file:** `backend/scripts/smoke-test.sh` (or `.js`)

Tests:
1. `GET /health` → 200, `status: "ok"` present
2. `POST /api/deliberate` with valid minimal payload → 200, `consensus` field present
3. `POST /api/deliberate` with missing `query` → 400, `VALIDATION_ERROR` in body
4. `POST /api/deliberate` × 21 rapid requests → 429 on 21st
5. `GET /api/debug/last` without token → 404
6. `GET /api/audit` → 200, array response

Done when:
- Script is runnable: `./backend/scripts/smoke-test.sh http://localhost`
- Results table printed: check | expected | actual | pass/fail
- All 6 checks pass

---

## Exit Criteria
- [ ] 0 known HIGH+ security findings in modified paths
- [ ] All 6 smoke checks pass
- [ ] `/api/deliberate` response contract unchanged (check `consensus`, `synthesis`, `stage1`, `stage2` fields present)
- [ ] No stack traces returned to any client
- [ ] No secrets in stdout logs

## Risks
- Helmet CSP headers may break frontend font loading (Google Fonts) — test in browser after S1-01
- Rate limits too tight may affect legitimate testing — adjust thresholds if needed

## Mitigation
- Incremental commits per story (one commit per story ID)
- Run smoke test after every story
- Keep a temporary `DISABLE_RATE_LIMIT=true` flag for local dev
