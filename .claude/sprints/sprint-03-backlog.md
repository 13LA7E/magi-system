# Sprint 03 — Reliability, Observability, Error Contracts

**Goal:** Production errors never crash the process. Every error returns a structured response. Key metrics are observable.
**Length:** 2 weeks
**Prerequisite:** Sprint 1 complete. Sprint 2 recommended.

> For exact copy-paste prompts, see `.claude/commands/plan.md` Sprint 3 section.

---

## Stories

### S3-01 — Structured Error Responses + Request IDs
**Files:** `backend/server.js`

Add:
- `uuid` package for request IDs
- `X-Request-ID` header on all responses (generated per request)
- Global error handler middleware (must be last `app.use`):
  ```json
  { "error": "ERROR_CODE", "message": "human readable", "requestId": "uuid" }
  ```
- Never return `err.stack` or raw error objects to clients
- Map common error types to codes:
  - Validation errors → `VALIDATION_ERROR` (400)
  - Auth failures → `UNAUTHORIZED` (401) / `FORBIDDEN` (403)
  - Rate limit → `RATE_LIMITED` (429)
  - Unit failure → `DELIBERATION_PARTIAL` (200, not an error — still returns result)
  - Server crash → `INTERNAL_ERROR` (500)

Done when:
- All 4xx/5xx responses include `error`, `message`, `requestId`
- No stack traces visible in any response body
- Request ID header present on every response

---

### S3-02 — Unit Failure Graceful Degradation (Verified)
**File:** `backend/deliberation.js`

Audit current implementation:
- Verify Stage 1 `Promise.all` has per-unit error handling
- If any unit throws, deliberation continues with remaining units
- Minimum viable: 2 units must succeed for a valid deliberation
- If < 2 units succeed: return `{ consensus: "INSUFFICIENT_CONTEXT", escalate: true }` — do not crash

Add to audit log document:
```json
"unitsFailed": ["casper"],
"unitsUsed": ["melchior", "balthasar"]
```

Test methodology:
- Temporarily set a unit's API key to invalid
- Run a deliberation
- Confirm: valid response returned, `unitsFailed` populated, no 500

Done when:
- Single unit failure → 2-unit deliberation with `unitsFailed` logged
- Two unit failures → `INSUFFICIENT_CONTEXT` consensus, escalate true
- Zero crashes on unit failure

---

### S3-03 — Structured Request Logging + Metrics
**File:** `backend/server.js`

Add request logging middleware (runs before routes):
```json
{ "ts": "ISO", "method": "POST", "path": "/api/deliberate", "status": 200, "ms": 1423, "requestId": "uuid", "ip": "x.x.x.x" }
```

Rules:
- Log to `stdout` only (PM2 captures it)
- Do NOT log `query` content — privacy
- Do NOT log API key values

Add `GET /api/metrics` (admin-only, Sprint 2 auth required):
```json
{
  "period": "24h",
  "totalDeliberations": 47,
  "avgDurationMs": 2100,
  "escalationRate": 0.08,
  "consensusDistribution": { "APPROVED": 30, "REJECTED": 10, "SPLIT": 5, "DEADLOCK": 2 },
  "unitFailureRate": 0.02,
  "searchUsedRate": 0.35
}
```

Done when:
- Every request produces a structured JSON log line in stdout
- `/api/metrics` returns correct aggregated data from MongoDB
- No query content appears in logs

---

### S3-04 — PM2 + Process Hardening
**Files:** `ecosystem.config.js` (create), `backend/server.js`

PM2 ecosystem config:
```js
module.exports = {
  apps: [{
    name: 'magi-backend',
    script: 'backend/server.js',
    max_memory_restart: '300M',
    restart_delay: 3000,
    max_restarts: 10,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    env_production: { NODE_ENV: 'production' }
  }]
}
```

Add to `backend/server.js`:
```js
process.on('unhandledRejection', (reason) => {
  console.error(JSON.stringify({ event: 'unhandledRejection', reason: String(reason) }));
  process.exit(1); // Let PM2 restart
});
process.on('uncaughtException', (err) => {
  console.error(JSON.stringify({ event: 'uncaughtException', message: err.message }));
  process.exit(1);
});
```

MongoDB: verify disconnect/reconnect event handlers exist in `db.js`. If missing, add:
```js
mongoose.connection.on('disconnected', () => console.error('MongoDB disconnected'));
mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));
```

Done when:
- `ecosystem.config.js` deploys correctly with `pm2 start ecosystem.config.js --env production`
- Unhandled rejection causes PM2 restart (test: throw in a route handler)
- MongoDB reconnect logs on connection drop

---

## Exit Criteria
- [ ] All responses include structured error shape on 4xx/5xx
- [ ] No stack traces in any response body
- [ ] Single unit failure → deliberation continues (verified with test)
- [ ] Request logs in JSON format visible in `pm2 logs`
- [ ] `/api/metrics` returns correct data (admin auth required)
- [ ] `ecosystem.config.js` committed and working
- [ ] Unhandled rejection → PM2 restart confirmed

## Notes
- Request logging middleware must run BEFORE routes but AFTER body parser
- Error handler must be LAST `app.use` call — order matters in Express
- `unitsFailed` field is additive to existing schema — safe to add
