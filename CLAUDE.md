# MAGI — Multi-Agent Governance Intelligence
Live: https://trymagi.tech | Repo: github.com/13la7e/magi-system

## Stack
- Backend: Node.js + Express v20 LTS
- Database: MongoDB v7.0 (local on droplet)
- Hosting: DigitalOcean Frankfurt ($6/mo)
- CDN/SSL: Cloudflare
- Process: PM2
- Search: Tavily API
- Frontend: Vanilla HTML/CSS/JS (single file: docs/index.html)

## AI Units
- MELCHIOR-1: OpenAI gpt-4o-mini — Logic & Scientific Reasoning
- BALTHASAR-2: Anthropic claude-haiku-4-5 — Ethics & Harm Modeling
- CASPER-3: Google gemini-2.5-flash — Lateral/Adversarial Thinking
- SYNTHESIS: Anthropic claude-haiku-4-5 — Post-deliberation summary

## File Structure
/backend
	server.js          — Express, routes, CORS, daily limit
	deliberation.js    — 7-stage Crucible protocol
	melchior.js        — OpenAI unit
	balthasar.js       — Anthropic unit
	casper.js          — Google unit
	triage.js          — Query classification + sanitisation
	search.js          — Tavily integration
	searchOrchestrator.js — Collaborative search query formation
	db.js              — MongoDB schema
/docs
	index.html         — Full frontend

## API Endpoints
- GET  /          — Frontend
- GET  /health    — Status, unit providers, daily query count
- POST /api/deliberate — Full 7-stage deliberation
- GET  /api/audit — Last 10 deliberations
- GET  /api/debug/last — Full debug log (token-protected)

## The Crucible — 7 Stages
0: Triage (classify: PERSONAL/FACTUAL/CURRENT, XSS strip, no API calls)
0b: Collaborative search (CURRENT only — 1 Claude Haiku call → 1 Tavily call)
1: Blind parallel deliberation (Promise.all, all 3 units)
2: Assumption exchange (each unit sees other two's critical assumptions only)
3: Confidence-weighted consensus (±20 delta threshold)
4: Deadlock detection (all 3 units >85% confidence + disagreeing = hard escalate)
5: Synthesis (1 Haiku call)
6: Escalation brief (if escalate=true)
7: Audit log → MongoDB

## Consensus Output Values
APPROVED | REJECTED | SPLIT | DEADLOCK | INSUFFICIENT_CONTEXT

## Cost Targets
- Standard deliberation: ~$0.006
- With web search: ~$0.016
- Daily limit: 100 queries (429 on exceeded)

## Current Status (April 2026)
COMPLETE: 7-stage Crucible, production deploy, MongoDB audit log, Tavily search, triage, collaborative search
IN PROGRESS: Developer console, UI overhaul
PLANNED: NVIDIA NIM integration, API v1 with auth

## Rules
- Never modify triage classification logic without checking all 3 query type flows
- Tavily max 1 call per deliberation — enforced in searchOrchestrator.js
- Stage 1 must always run via Promise.all (parallel, not sequential)
- Stage 2 passes only critical assumptions between units — not full responses
- Graceful degradation: if 1 unit fails, reduce to 2-unit deliberation
- When a step fails, stop and report full error before attempting any fix
- Read the relevant unit file before editing any unit's prompt

