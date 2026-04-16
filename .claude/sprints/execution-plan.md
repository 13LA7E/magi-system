# MAGI Sprint Execution Plan — MVP to v1.0

## Release Goal
Ship MAGI v1.0: a secure, observable, compliant, and pilotable AI governance API.

## Sprint Map

| Sprint | Name | Goal | Priority |
|--------|------|------|----------|
| 1 | Security Baseline | Remove attack paths, add guardrails | 🔴 Ship first |
| 2 | Auth + Access Control | API keys, roles, tenant readiness | 🔴 Blocks pilot |
| 3 | Reliability + Observability | Structured errors, graceful degradation, metrics | 🟠 Blocks pilot |
| 4 | UI Overhaul + Dev Console | Enterprise aesthetic, compiled report format | 🟡 Can parallel S2/S3 |
| 5 | Data Governance + Compliance | Retention, export, EU AI Act mapping | 🟡 Can parallel S4 |
| 6 | Productization | API versioning, metering, pilot onboarding | 🟢 Final gate |

## Dependency Graph
```
Sprint 1 ─── Sprint 2 ─── Sprint 3 ───┐
                                        ├─── Sprint 6 (v1.0)
Sprint 4 (parallel to S2/S3) ──────────┤
Sprint 5 (parallel to S4) ─────────────┘
```

## Current State (April 2026)

### Complete
- 7-stage Crucible protocol (all stages)
- Production deployment (trymagi.tech, DigitalOcean Frankfurt)
- MongoDB audit persistence
- Tavily web search integration
- Smart triage + collaborative search query formation
- Developer console (partial — exists, needs overhaul in Sprint 4)
- UI overhaul (in progress — to be completed in Sprint 4)

### Security Gaps (Sprint 1 target)
- No HTTP security headers (Helmet missing)
- No request body size limits
- No per-route rate limiting (only daily global limit)
- Debug endpoint has weak token validation
- DAILY_LIMIT and CORS origins hardcoded in server.js

### Missing for Pilot (Sprints 2–6)
- No API key authentication
- No role-based access control
- No structured error response contract
- No graceful degradation verification
- No request logging (structured JSON)
- No metrics endpoint
- No MongoDB TTL retention policy
- No audit export endpoint
- No EU AI Act compliance mapping
- No API versioning
- No usage metering
- No pilot onboarding documentation

## RAG Priorities
- 🔴 RED (ship now): Helmet, rate limits, request validation, debug endpoint hardening
- 🟠 AMBER (next): API key auth, structured errors, graceful degradation
- 🟡 YELLOW (before pilot): UI overhaul, compliance mapping, audit export
- 🟢 GREEN (pilot gate): Versioning, metering, onboarding docs, release checklist
