# Sprint 06 — Productization + Pilot Readiness

**Goal:** First paying pilot can onboard without founder involvement. Ship MAGI v1.0.
**Length:** 2 weeks
**Prerequisite:** Sprints 1–5 complete

> For exact copy-paste prompts, see `.claude/commands/plan.md` Sprint 6 section.

---

## Stories

### S6-01 — API Versioning
**File:** `backend/server.js`

Add `/v1/` route prefix:
- `GET /v1/health`
- `POST /v1/deliberate`
- `GET /v1/audit`
- `GET /v1/audit/export`
- `GET /v1/metrics`
- `GET /v1/usage`

Keep unversioned routes as aliases with deprecation headers:
```
Deprecation: true
Sunset: [3 months from ship date]
Link: </v1/deliberate>; rel="successor-version"
```

Version declared in response header on all `/v1/` routes:
```
X-MAGI-Version: 1.0
```

Done when:
- All `/v1/` routes return identical responses to current unversioned routes
- Unversioned routes return deprecation headers
- Version header present on all v1 responses

---

### S6-02 — Usage Metering Hooks
**Files:** `backend/db.js`, `backend/server.js`

New MongoDB collection: `usage_records`
Schema:
```js
{
  apiKey: String,          // first 8 chars of hash only
  date: Date,              // day granularity (midnight UTC)
  deliberationCount: Number,
  tokensPrompt: Number,
  tokensCompletion: Number,
  estimatedCostUSD: Number,
  searchCount: Number,
}
```

Increment on each deliberation (upsert by apiKey + date).
For public (no-auth) deliberations: bucket under `apiKey: "public"`.

New endpoint `GET /v1/usage` (developer role):
```json
{
  "period": "30d",
  "deliberations": 142,
  "tokensTotal": 285000,
  "estimatedCostUSD": 1.84,
  "searchUsed": 48
}
```

Done when:
- Usage record created/updated on every deliberation
- `/v1/usage` returns accurate aggregated data for the requesting key's usage
- Admin can see all keys' usage via `/v1/metrics`

---

### S6-03 — Pilot Onboarding Package
**New file:** `docs/pilot-onboarding.md`

Content (plain English, no NGE references):

```markdown
# MAGI Pilot Onboarding

## What MAGI Does (1 page)
Multi-agent AI governance middleware. Three independent AI units deliberate on your query
and produce a structured, auditable consensus — or escalate to human review.

## Quick Start
### 1. Get an API key
Contact [founder contact] to receive your developer API key.

### 2. Submit a query
curl -X POST https://trymagi.tech/v1/deliberate \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_KEY" \
  -d '{"query": "Should we approve this loan application for a first-time borrower with a 680 credit score?"}'

### 3. Read the result
[Walk through response fields: consensus, confidence, synthesis, escalate]

## Interpreting Results

### Consensus Values
| Value | Meaning | Recommended Action |
|-------|---------|-------------------|
| APPROVED | All or majority of units agree: proceed | Proceed with logging |
| REJECTED | All or majority of units advise against | Review before action |
| SPLIT | Units disagree significantly | Human review recommended |
| DEADLOCK | High-confidence disagreement | Escalate to human — required |
| INSUFFICIENT_CONTEXT | Query too ambiguous or system degraded | Rephrase or escalate |

### Escalation Flag
When `escalate: true`, the `escalationBrief` field contains a plain-English summary
of why human review is required. Always route escalated decisions to a human reviewer.

### Synthesis Panel
`verdictRationale` explains the reasoning behind the consensus.
`convergencePoints` show what all units agreed on.
`divergencePoints` show where units disagreed.

## Rate Limits + Cost
- [Insert current limits from env config]
- Standard deliberation: ~$0.006
- With web search: ~$0.016

## Accessing Your Audit Log
GET /v1/audit — last 10 deliberations
GET /v1/audit/export?format=json&from=2026-01-01 — full export

## Support
[Contact details]
```

Done when:
- Document is self-contained: a pilot customer can onboard from it alone
- All curl examples tested and working
- No internal terminology or NGE references

---

### S6-04 — v1.0 Release Checklist
**New file:** `docs/v1-release-checklist.md`

Build the ship-it checklist:

```markdown
# MAGI v1.0 Release Checklist

## Security (Sprint 1–2)
- [ ] Helmet headers active in production
- [ ] Rate limiting active on all API routes
- [ ] Request body size limit enforced
- [ ] Debug endpoint disabled by default
- [ ] API key auth on audit + debug routes
- [ ] CORS origins from env (no hardcoded values)
- [ ] No stack traces in any response

## Reliability (Sprint 3)
- [ ] Structured error responses on all 4xx/5xx
- [ ] Single unit failure → deliberation continues (tested)
- [ ] PM2 ecosystem config deployed
- [ ] Unhandled rejection → PM2 restart (tested)
- [ ] MongoDB reconnect handling active

## UI (Sprint 4)
- [ ] CRT aesthetic fully replaced
- [ ] Compiled report format rendering all 7-stage data
- [ ] Developer console fully functional (all 5 tabs)
- [ ] Mobile layout usable at 375px
- [ ] Export transcript works

## Data Governance (Sprint 5)
- [ ] MongoDB TTL index active (90-day retention)
- [ ] /v1/audit/export works (JSON + text formats)
- [ ] Compliance mapping doc honest and reviewed

## Productization (Sprint 6)
- [ ] /v1/ routes active with version header
- [ ] Unversioned routes return deprecation headers
- [ ] Usage metering recording correctly
- [ ] Pilot onboarding doc tested end-to-end
- [ ] All smoke tests pass

## Pre-Deploy Final Checks
- [ ] .env.example up to date with all required keys
- [ ] No API keys or secrets in git history
- [ ] PM2 restart on droplet with latest code
- [ ] Cloudflare cache purged
- [ ] Manual deliberation test on production passes
- [ ] /health returns correct provider list

## Sign-Off
Founder sign-off: _______________________  Date: __________

MAGI v1.0 is shipped when all boxes above are checked.
```

Done when:
- Checklist is complete and accurate
- Every item maps to a real, testable thing that was built
- Founder has reviewed and signed off

---

## Exit Criteria
- [ ] `/v1/` routes all return correct responses
- [ ] Unversioned routes include deprecation headers
- [ ] Usage records updating correctly in MongoDB
- [ ] `/v1/usage` returns accurate usage data
- [ ] Pilot onboarding doc tested by running through it cold
- [ ] v1.0 release checklist is complete and signed off

---

## Post-v1.0 Backlog (not in scope for this sprint)
- NVIDIA NIM model integration (MELCHIOR fallback to open-source)
- Enterprise SDK (npm package wrapping the API)
- On-premise deployment profile
- Advanced policy engine (domain-specific governance templates)
- Fine-tuned deliberation models
- Exist Gründerstipendium application materials
