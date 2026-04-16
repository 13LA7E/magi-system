# Security Workstream Backlog (MAGI)

## Security Objectives

- Protect high-stakes deliberation data from unauthorized access
- Prevent abuse of public API surfaces
- Preserve audit integrity and traceability
- Reduce secrets and supply-chain risk

## Priority 0 (Ship First)

### 1. Endpoint Hardening

- Add Helmet with strict policy set
- Enforce JSON body limits and request timeout policy
- Add route-level rate limiting and slow-down middleware
- Ensure 404/405 behavior does not leak internals

Acceptance:

- Security headers present on all responses
- Abuse traffic receives 429 consistently
- No stack traces returned to clients

### 2. Debug Surface Lockdown

- Disable /api/debug/last in production by default
- Require strong token + optional IP allowlist
- Redact prompt and response payloads where not strictly needed

Acceptance:

- Debug route inaccessible when feature flag is off
- Debug route rejects weak or missing tokens
- Debug payload excludes secrets and unnecessary sensitive text

### 3. Input and Output Validation

- Introduce schema validation for request body and key params
- Enforce query length, testerId normalization, and type safety
- Validate all response contracts before return

Acceptance:

- Invalid payloads fail with deterministic 400
- Known malformed payload test cases pass

## Priority 1 (Within Next Sprint)

### 4. Auth and Authorization

- API key auth for protected endpoints
- Role-based access for debug and extended audit data
- Key rotation and revocation workflow

Acceptance:

- Unauthorized access blocked with 401/403
- Role policy enforced across all routes

### 5. Secrets and Configuration Security

- Move all critical config to env with safe defaults
- Add startup checks for missing/weak secret values
- Ensure .env files are never exposed via static serving

Acceptance:

- Server fails fast on insecure production config
- Secret scanning baseline documented

### 6. Dependency and Supply-Chain Hygiene

- Add npm audit gating policy in CI
- Pin/upgrade critical packages on schedule
- Generate SBOM for pilot security review

Acceptance:

- CI fails on critical/high vulnerabilities (with reviewed exceptions)
- Dependency upgrade cadence defined

## Priority 2 (Hardening and Compliance)

### 7. Data Protection and Governance

- Add retention policy with TTL index for audit docs
- Add field-level masking for potentially sensitive query content
- Define data export + deletion process

Acceptance:

- Retention policy active in DB
- Data deletion request flow documented and testable

### 8. Observability and Incident Response

- Add structured logs with request IDs
- Add alerting for auth failures, abuse spikes, and provider outages
- Create security incident runbook

Acceptance:

- Alerts trigger in test scenarios
- Incident runbook used in tabletop drill

## Security Test Plan

- Unit tests: validation logic, auth middleware, redaction helpers
- Integration tests: rate limits, debug auth, CORS policy, error handling
- Adversarial tests: malformed JSON, oversized body, header fuzzing, brute-force attempts
- Dependency scans: npm audit + curated remediation tracking

## Definition of Secure Done (Feature Level)

A feature is not done unless it has:

- Threats identified
- Input validation implemented
- Authorization rules defined
- Logging/redaction considered
- Tests for negative paths
- Rollback plan documented
