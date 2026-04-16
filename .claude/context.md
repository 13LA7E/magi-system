# Claude Context

## Current Task

- Align workspace behavior with MAGI April 2026 product specification.

## Key Facts

- Root instruction file: `CLAUDE.md`
- Slash commands live in `.claude/commands/`
- The app is a Node.js backend that serves a static frontend
- Product spec text is saved at `.claude/product-spec-from-pdf.txt`
- Sprint planning pack is in `.claude/sprints/`
- Execution plan: `.claude/sprints/execution-plan.md`
- Security workstream: `.claude/sprints/security-workstream.md`
- Current sprint backlog: `.claude/sprints/sprint-01-backlog.md`
- Core protocol: seven-stage Crucible with triage, collaborative search, two-stage deliberation, consensus, deadlock detection, synthesis, audit
- Classifications: `PERSONAL`, `FACTUAL`, `CURRENT`
- Key API endpoints: `/`, `/health`, `/api/deliberate`, `/api/audit`, `/api/debug/last`

## Open Items

- Keep this file updated with newest product constraints and implementation priorities.
