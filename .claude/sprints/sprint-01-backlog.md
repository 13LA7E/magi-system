# Sprint 01 Backlog (Next 2 Weeks)

Format standard for future sprints: `.claude/sprints/sprint-doc-style-guide.md` and `.claude/sprints/sprint-template.md`.

## Sprint Goal

Establish production-grade security baseline without breaking deliberation behavior.

## Use With /plan

If you want one exact copy-paste prompt set, use `.claude/commands/plan.md`.

## Claude Code Prompt Pack (Token-Efficient)

Use these short prompts directly in Claude Code to keep context lean while shipping Sprint 1.

### 0) Sprint Kickoff Prompt

```text
Implement Sprint 1 from .claude/sprints/sprint-01-backlog.md.
Preserve MAGI invariants in CLAUDE.md.
Work in small commits by story ID (S1-01..S1-05).
After each story: run focused checks, summarize diff, update .claude/context.md.
```

### 1) S1-01 Security Middleware

```text
Do S1-01 only.
File focus: backend/server.js, backend/package.json.
Add Helmet, JSON/body limits, rate limit on /api/deliberate /api/audit /api/debug/last.
Keep API response contracts unchanged.
Run quick endpoint checks and report exact results.
```

### 2) S1-02 Request Validation

```text
Do S1-02 only.
Add schema validation for POST /api/deliberate body: query(string), testerId(optional string), developerMode(optional boolean).
Reject invalid payloads with stable 400 JSON.
Do not change deliberation output shape.
```

### 3) S1-03 Debug Hardening

```text
Do S1-03 only.
Harden GET /api/debug/last with ENABLE_DEBUG_ENDPOINT and strong DEBUG_TOKEN checks.
Default: disabled in production unless explicit flag true.
Keep behavior unchanged when allowed and authorized.
```

### 4) S1-04 Config Refactor

```text
Do S1-04 only.
Move DAILY_LIMIT and CORS origins to env-backed config with safe defaults.
Add startup config validation and clear warnings/fail-fast rules.
Do not edit backend/.env directly.
```

### 5) S1-05 Regression Checks

```text
Do S1-05 only.
Add lightweight smoke checks for /health, /api/deliberate, /api/audit, /api/debug/last.
Include negative checks for validation and rate limit.
Return command list and observed outputs summary.
```

### 6) Patch Review Prompt

```text
Review current Sprint 1 changes.
Find only: regressions, security gaps, contract breaks, missing tests.
List findings by severity with file references.
Then give minimal fix plan.
```

### 7) End-of-Day Handoff Prompt

```text
Run /remember.
Update .claude/context.md with:
- completed story IDs
- files changed
- checks run + outcomes
- blockers
- next first action tomorrow
Keep it concise.
```

### Prompt Rules

- Keep prompts scoped to one story ID.
- Name exact files when possible.
- Require validation output, not just code edits.
- Use /remember after every meaningful chunk.

## Stories

### S1-01 Security Middleware Foundation

- Add Helmet configuration
- Add JSON/body size limits
- Add express-rate-limit for core API routes

Done when:

- Security middleware enabled in backend startup path
- Manual checks confirm expected headers and 429 behavior

### S1-02 Request Validation

- Add schema validation for /api/deliberate request payload
- Enforce testerId normalization and strict booleans for developerMode

Done when:

- Invalid payloads return stable 400 error schema
- Valid payload behavior unchanged

### S1-03 Debug Endpoint Hardening

- Add ENABLE_DEBUG_ENDPOINT flag
- Add strong token requirements and improved unauthorized telemetry
- Restrict debug payload fields in production mode

Done when:

- Debug endpoint disabled by default in production
- Access blocked unless both flag and token checks pass

### S1-04 Configuration Refactor

- Move DAILY_LIMIT and CORS origins to env
- Add startup configuration validation with clear console warnings/errors

Done when:

- Server reads limits/origins from env with safe defaults
- Misconfiguration fails fast where required

### S1-05 Security Regression Checks

- Add smoke test script for /health, /api/deliberate, /api/audit, /api/debug/last
- Add negative tests for rate limit and validation failures

Done when:

- Smoke script reproducible locally
- Results documented in sprint notes

## Risks

- Tight coupling in server middleware order could cause regressions
- Debug feature expectations may conflict with current developer workflow

## Mitigations

- Add incremental commits per story
- Run endpoint smoke checks after each story
- Keep a temporary compatibility flag during rollout

## Sprint Review Metrics

- 0 known high-severity security findings in modified paths
- 100% pass on planned smoke checks
- No regression in key response fields for /api/deliberate
