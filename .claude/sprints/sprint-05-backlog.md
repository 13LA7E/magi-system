# Sprint 05 — Data Governance + Compliance

**Goal:** Enforce data retention policy, enable audit export, and produce EU AI Act compliance mapping.
**Length:** 2 weeks
**Prerequisite:** Sprints 1–3 complete (stable schema + auth layer required)

> For exact copy-paste prompts, see `.claude/commands/plan.md` Sprint 5 section.

---

## Context

EU AI Act Article 13 requires transparency, audit trails, and human oversight for high-risk AI systems.
MAGI's pitch is that it helps enterprises comply — MAGI itself must also comply.
This sprint produces the technical controls and documentation to support that claim.

---

## Stories

### S5-01 — MongoDB TTL Index + Retention Policy
**File:** `backend/db.js`

Add TTL index on the deliberation collection:
```js
deliberationSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }); // 90 days
```

Make configurable via env:
- `AUDIT_RETENTION_DAYS` (default: `90`)
- Read on startup, compute `expireAfterSeconds`
- Log confirmed retention policy on startup: `Audit retention: 90 days (TTL index active)`

Update `.env.example`:
```
AUDIT_RETENTION_DAYS=90  # Days to retain deliberation records. Default: 90.
```

Done when:
- TTL index created (verify with `db.deliberations.getIndexes()`)
- Startup log shows retention period
- Changing `AUDIT_RETENTION_DAYS` and restarting changes the TTL

---

### S5-02 — Audit Export Endpoint
**File:** `backend/server.js`

Add `GET /api/audit/export` (admin-only):

Query parameters:
- `format`: `json` | `text` (default: `json`)
- `from`: ISO 8601 date string (optional)
- `to`: ISO 8601 date string (optional)
- `limit`: integer, max 1000 (default: 100)

JSON format: array of full deliberation records from MongoDB
Text format: human-readable transcript per deliberation:
```
═══════════════════════════════════════
MAGI DELIBERATION TRANSCRIPT
ID: [mongo _id]
Timestamp: [ISO]
Tester: [testerId or ANONYMOUS]
Query: [full query text]
Mode: [mode]
Classification: [FACTUAL|PERSONAL|CURRENT]
Search Used: [Yes/No]
Duration: [ms]ms

UNIT VERDICTS (Stage 1)
  MELCHIOR-1: [verdict] ([confidence]%) — [response truncated 200 chars]
  BALTHASAR-2: [verdict] ([confidence]%) — [response truncated 200 chars]
  CASPER-3: [verdict] ([confidence]%) — [response truncated 200 chars]

CONSENSUS: [consensus]
ESCALATION: [Yes/No]
[If escalated: ESCALATION BRIEF: [text]]

SYNTHESIS
  Dominant Theme: [theme]
  Verdict Rationale: [text]
───────────────────────────────────────
```

Done when:
- JSON export returns valid array, filterable by date range
- Text export matches format above
- Limit enforced (1000 max)
- Admin auth required, returns 403 otherwise

---

### S5-03 — Query Content Masking (Optional Privacy Control)
**File:** `backend/db.js`, `backend/server.js`

Add `MASK_QUERY_IN_AUDIT` env flag (default: `false`):

When `true`:
- Store `queryHash: sha256(query)` instead of `query: "plaintext"` in MongoDB
- Audit GET `/api/audit` preview returns `[MASKED]` instead of truncated query
- Export still works but shows `[MASKED]` for query field

When `false` (default): existing behavior unchanged.

Note: This is for enterprise customers with sensitive query content. Not required for public demo.

Done when:
- Flag `false`: query stored and returned as today
- Flag `true`: query replaced with hash in DB, `[MASKED]` in API responses
- Switching flag takes effect on new deliberations (does not retroactively change existing records)

---

### S5-04 — EU AI Act Compliance Mapping
**New file:** `docs/compliance.md`

Write a compliance mapping document for pilot customers. Plain English.

Structure:
```markdown
# MAGI — EU AI Act Compliance Mapping

## Overview
MAGI is designed as an AI governance middleware. This document maps
MAGI's features to EU AI Act Article 13 (Transparency) requirements.

## Article 13 — Transparency of High-Risk AI Systems

### 13(1) — Transparency and provision of information to users
[Feature: synthesis panel, verdict rationale, plain-English escalation brief]
[Status: Implemented]

### 13(2) — Instructions for use
[Feature: API docs, deliberation mode descriptions]
[Status: Partially implemented — pilot onboarding doc in progress]

### 13(3)(a) — Identity and contact details of provider
[Status: Not yet formalised — required for legal entity]

### 13(3)(b) — Characteristics, capabilities, and limitations
[Feature: confidence scores, INSUFFICIENT_CONTEXT verdict, unit failure logging]
[Status: Implemented]

### 13(3)(c) — Level of accuracy and robustness metrics
[Status: Gap — no formal accuracy benchmarking yet. Planned post-v1.0]

### 13(3)(d) — Human oversight measures
[Feature: escalation mechanism, escalationBrief, DEADLOCK verdict]
[Status: Implemented]

### 13(3)(e) — Expected lifetime and maintenance measures
[Status: Gap — not yet documented]

## Audit Trail (Article 9 + 12)
[Feature: MongoDB audit log, /api/audit, /api/audit/export, TTL retention policy]
[Status: Implemented]

## Gaps Summary
| Gap | Priority | Planned |
...

## Honest Limitations
List what MAGI cannot currently claim compliance with.
```

Done when:
- Document is honest (gaps listed explicitly)
- All implemented features mapped accurately
- Suitable for sharing with pilot customers and incubator reviewers (QSTP, Exist)

---

## Exit Criteria
- [ ] TTL index active on deliberation collection (verified with `getIndexes()`)
- [ ] `/api/audit/export?format=json` returns correct records
- [ ] `/api/audit/export?format=text` returns readable transcript
- [ ] Date range filtering works
- [ ] `MASK_QUERY_IN_AUDIT` flag tested in both states
- [ ] `docs/compliance.md` written honestly with gaps listed

## Notes
- TTL index changes require MongoDB to apply the new expiry — existing docs keep their original TTL
- Masking is irreversible per-record — once stored as hash, original query is gone
- Compliance doc must NOT overclaim — any inaccurate compliance claim is a liability
