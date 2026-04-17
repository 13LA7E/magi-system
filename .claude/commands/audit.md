Do a thorough audit of the entire MAGI system project at c:\magi-system\.

Respect ignore rules:
- Read `.claudeignore` and `.gitignore` first.
- Skip any files or directories matched by either ignore file.
- Do not include ignored files in findings.

Read every file completely:
- backend/server.js
- backend/deliberation.js
- backend/melchior.js
- backend/balthasar.js
- backend/casper.js
- backend/triage.js
- backend/search.js
- backend/searchOrchestrator.js
- backend/db.js
- backend/auditLog.js
- docs/index.html
- docs/app.js
- docs/style.css
- frontend/app.js
- frontend/style.css
- root-level project files and configs (for example: README.md, CLAUDE.md, package files, workspace/settings files)

Also read:
- any .env.example and config files you find across the entire repository

For each file, identify ALL of the following:
1. Bugs and logic errors
2. Security vulnerabilities (injection, auth bypass, info leakage, missing validation, etc.)
3. Edge cases that are not handled
4. Code quality issues (error handling gaps, unhandled promise rejections, missing null checks, etc.)
5. API contract violations (mismatched response shapes, missing fields, etc.)

Be extremely thorough.

Report format requirements:
- Group findings by file
- Include severity: HIGH, MEDIUM, LOW
- Include exact line numbers where possible
- Do NOT fix anything; only report issues in detail

Project context:
- Node.js + Express backend
- MongoDB for audit logs
- 7-stage "Crucible" deliberation protocol
- Three AI units: Melchior (OpenAI), Balthasar (Anthropic), Casper (Google)
- Key endpoints: POST /api/deliberate, GET /api/audit, GET /api/debug/last, GET /health
- Stage 1 must run via Promise.all (parallel)
- Tavily max 1 call per deliberation
- Daily limit: 100 queries
- Classifications: PERSONAL, FACTUAL, CURRENT
