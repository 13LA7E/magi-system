# Sprint 02 — Auth, Access Control, Tenant Readiness

**Goal:** Introduce authenticated API access, role-based permissions, and prepare for paid pilot usage.
**Length:** 2 weeks
**Prerequisite:** Sprint 1 complete

> For exact copy-paste prompts, see `.claude/commands/plan.md` Sprint 2 section.

---

## Context

Current state after Sprint 1: all endpoints are either fully public or protected only by a weak debug token.
Sprint 2 adds real API key auth for sensitive endpoints while keeping `/api/deliberate` public for the demo flow.

The deliberation endpoint stays public intentionally — it's the demo. The audit and debug surfaces are gated.

---

## Stories

### S2-01 — API Key Middleware
**New file:** `backend/auth.js`
**File:** `backend/server.js`

Implement:
- API key stored as `sha256(key)` in env: `API_KEY_HASH_1`, `API_KEY_HASH_2`, etc. (up to 10)
- Middleware: extract `x-api-key` header, hash it, compare against all env hashes
- Associated role stored in `API_KEY_ROLE_1` etc. (`developer` | `admin`)
- Apply middleware to: `GET /api/audit`, `GET /api/debug/last`
- Leave `POST /api/deliberate` and `GET /health` unauthenticated

Error shape: `{ "error": "UNAUTHORIZED", "message": "Valid API key required" }`

Done when:
- `GET /api/audit` without key → 401
- `GET /api/audit` with invalid key → 401
- `GET /api/audit` with valid developer key → 200
- `POST /api/deliberate` without key → 200 (no auth required)

---

### S2-02 — Role-Based Route Protection
**File:** `backend/auth.js`, `backend/server.js`

Add role gating:
- `developer` role: access to `GET /api/audit`, `GET /api/debug/last`
- `admin` role: all developer rights + `GET /api/metrics` (Sprint 3)
- Unknown role: treated as unauthorized

Add to `.env.example`:
```
API_KEY_HASH_1=          # sha256 of your API key
API_KEY_ROLE_1=developer # developer | admin
```

Add utility script: `backend/scripts/generate-api-key.js`
- Generates a random 40-char key, prints it once, prints its sha256 hash for `.env`
- Never stores the plaintext key

Done when:
- Role check enforced on protected routes
- Key generation script produces valid key+hash pair
- Role mismatch returns 403 (not 401): `{ "error": "FORBIDDEN" }`

---

### S2-03 — CORS Allowlist from Env
**File:** `backend/server.js`

Replace hardcoded `allowedOrigins` array:
- Read `CORS_ORIGINS` env var (comma-separated)
- Add `CORS_ORIGINS_STAGING` for non-production override
- Fail fast with clear error if `NODE_ENV=production` and `CORS_ORIGINS` is not set
- Log resolved CORS origins at startup

Update `.env.example`:
```
CORS_ORIGINS=https://trymagi.tech,https://www.trymagi.tech
CORS_ORIGINS_STAGING=http://localhost:3001,http://127.0.0.1:5500
```

Done when:
- `allowedOrigins` array removed from `server.js` source
- Production startup fails with clear message if `CORS_ORIGINS` missing
- Existing CORS behavior unchanged for allowed origins

---

### S2-04 — Auth Regression Checks
**File:** `backend/scripts/smoke-test.sh` (extend)

Extend smoke test with auth cases:
1. `GET /api/audit` without key → 401
2. `GET /api/audit` with invalid key → 401
3. `GET /api/audit` with valid developer key → 200
4. `GET /api/debug/last` with developer key → depends on `ENABLE_DEBUG_ENDPOINT` flag
5. `POST /api/deliberate` without key → 200 (regression: must still work)
6. Role mismatch (developer key on admin endpoint) → 403

Done when:
- All 6 auth checks pass in results table
- Sprint 1 smoke checks still pass (no regressions)

---

## Exit Criteria
- [ ] Unauthorized access to `/api/audit` returns 401
- [ ] Valid developer key accesses audit log
- [ ] `/api/deliberate` remains fully public (no auth required)
- [ ] CORS origins controlled by env, not source code
- [ ] Key generation utility script works
- [ ] All Sprint 1 smoke checks still pass

## Security Notes
- Never log plaintext API keys — only log first 8 chars of hash for debugging
- Key hashes use SHA-256: `require('crypto').createHash('sha256').update(key).digest('hex')`
- Rotate keys by changing env vars + restarting PM2 — no code changes needed
