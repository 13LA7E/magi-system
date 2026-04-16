# MAGI Sprint Execution Plan (April 2026)

## Planning Assumptions

- Sprint length: 2 weeks
- Team: 1-2 engineers, founder-led delivery
- Primary objective: harden production system while preserving seven-stage Crucible invariants
- Constraint: keep architecture diversity (OpenAI + Anthropic + Google)

## Current State (Observed)

- Core seven-stage flow is implemented and running in production
- CURRENT classification and collaborative search are implemented
- MongoDB audit persistence exists for core deliberation records
- Major gaps remain in security hardening, API protection, automated testing, and delivery reliability

## Release Goal

Ship MAGI v1.0 as a secure, observable, test-covered governance API suitable for pilot customers.

## Sprint 1: Security Baseline + API Guardrails

### Goals

- Remove critical attack paths and insecure defaults
- Add first-line abuse protection for public endpoints
- Keep current behavior intact for deliberation output contracts

### Scope

- Add HTTP security headers (Helmet)
- Add strict body size and JSON parsing limits
- Add per-IP rate limiting for /api/deliberate, /api/audit, /api/debug/last
- Add request ID middleware and structured request logs
- Move hardcoded limits and origins into env configuration
- Harden /api/debug/last (token length/strength checks, disable in production unless explicitly enabled)
- Validate and normalize request payloads with schema validation

### Deliverables

- Middleware layer in backend server for headers, limits, and validation
- New env docs with secure defaults and examples
- Threat model v1 (lightweight doc: assets, attack paths, mitigations)

### Exit Criteria

- Deliberation and health endpoints pass manual regression checks
- Rate limits return deterministic 429 responses
- Debug endpoint cannot be reached without hardened token + feature flag
- No secret values printed in logs

## Sprint 2: Auth, Access Control, and Tenant Readiness

### Goals

- Introduce authenticated API usage for non-public operations
- Prepare for paid pilot and usage partitioning

### Scope

- Add API key auth for protected routes
- Introduce role-aware access (public, developer, admin)
- Separate public response vs developer trace response by role
- Add tester/account attribution fields for audit records
- Add CORS allowlist from env with staging/prod separation

### Deliverables

- Auth middleware + key rotation utility
- Route protection matrix (which endpoints require which role)
- Updated API docs with auth examples

### Exit Criteria

- Unauthorized requests fail closed
- Debug and extended audit data visible only to authorized roles
- Existing public query flow still works for allowed traffic profile

## Sprint 3: Reliability, Resilience, and Error Policy

### Goals

- Ensure predictable behavior during provider failures and timeouts
- Reduce incidents from dependency and infra failures

### Scope

- Circuit breaker + retry policy per provider call (bounded retries)
- Timeout tuning and fallback semantics explicitly documented
- Idempotency key support for /api/deliberate
- Centralized error taxonomy and client-safe error responses
- Health endpoint extension: database/provider readiness indicators

### Deliverables

- Reliability middleware/helpers used by all unit calls
- Runbook for degraded mode and provider outage handling
- Standardized error object schema

### Exit Criteria

- Simulated provider failures return stable API responses
- No unhandled promise rejections or crash loops under stress test
- Mean deliberation latency remains within agreed threshold

## Sprint 4: Test Coverage and Quality Gates

### Goals

- Make changes safe by default with repeatable automated checks
- Lock core protocol invariants with regression tests

### Scope

- Add unit tests for triage classification and consensus logic
- Add integration tests for /api/deliberate, /api/audit, /health
- Add contract tests for deliberation response shape
- Add snapshot tests for escalation brief and synthesis fallbacks
- Add CI workflow for lint/test/security audit

### Deliverables

- Test harness and scripts in backend package.json
- CI pipeline: install, test, coverage threshold, dependency audit
- Protocol invariants test suite for seven-stage guarantees

### Exit Criteria

- CI green on pull requests
- Core modules have minimum target coverage (70%+ to start)
- Breaking contract changes fail fast in CI

## Sprint 5: Data Governance, Compliance, and Audit Export

### Goals

- Strengthen compliance posture (EU AI Act-oriented auditability)
- Improve operator control over data lifecycle

### Scope

- Add retention/TTL policies for audit logs
- Add PII minimization and masking strategy for stored queries
- Add audit export endpoint (JSON + text transcript)
- Add admin reporting: consensus distribution, escalation rate, usage trends
- Add data deletion process for tester/account records

### Deliverables

- Data retention and deletion policy doc
- Export tooling for audit artifacts
- Compliance checklist mapping features to governance requirements

### Exit Criteria

- Retention policies enforced automatically
- Audit export generates complete and consistent artifacts
- Manual compliance checklist passes end-to-end review

## Sprint 6: Productization and Pilot Readiness

### Goals

- Prepare system for first paid pilots and operational handoff
- Reduce founder-only operational dependency

### Scope

- API versioning and deprecation policy
- Basic billing/usage metering hooks
- Production observability dashboard (latency, errors, provider health, consensus mix)
- Incident playbooks and on-call checklist
- Pilot onboarding package (security posture, API guide, sample workflows)

### Deliverables

- Versioned API docs
- Pilot operations handbook
- v1.0 release checklist signed off

### Exit Criteria

- Pilot sandbox environment functional
- Monitoring + alerts tested and routed
- Onboarding flow executable by someone other than founder

## Backlog After v1.0

- Fine-tuned unit variants (NVIDIA NIM track)
- Enterprise SDK
- On-prem deployment profile
- Advanced policy engine for domain-specific governance templates

## Dependency Graph (High Level)

- Sprint 1 is prerequisite for all later production work
- Sprint 2 depends on Sprint 1 middleware and env refactor
- Sprint 4 can start partially in parallel with Sprint 2/3
- Sprint 5 depends on stable schemas from Sprint 2-4
- Sprint 6 depends on Sprints 1-5 completion

## RAG Priorities for Immediate Start

- RED: debug endpoint hardening, rate limits, request validation
- AMBER: auth/roles, standardized errors, observability metrics
- GREEN: pilot collateral and productization docs
