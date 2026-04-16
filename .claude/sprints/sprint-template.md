# GLOBAL INIT - Run this once at session start

/remember "Project summary, stack, source-of-truth, non-negotiable business rules, security constraints, and test gates."

Read CLAUDE.md carefully before taking any action. That file is authoritative. Do not deviate without explicit approval.

# SPRINT X - <Name>
Days <n-m> | <Objective>

## Sx-BUILD-01: <Title>

/plan

Build <primary file or module> first because it unblocks later items.

Create/Update:
- <path>
- <path>

Exports:
- <symbol: signature>
- <symbol: signature>

Implementation flow:
1. <step>
2. <step>
3. <step>

Failure behavior:
- On <error>: <required outcome>

Constraints:
- <non-negotiable>
- <non-negotiable>

## Sx-BUILD-02: <Title>

/plan

Build <module>. No external API calls unless explicitly required.

Data sources:
1. <source>
2. <source>

Return type:
- <type shape>

Performance/cost guardrails:
- <bound>

Fixtures:
- Add <n> fixtures under <path>

## Sx-BUILD-03: <Title>

/plan

Build <module> with explicit two-pass or staged logic if needed.

Export:
- <symbol: signature>

Critical privacy/security note:
- <must never happen>

## Sx-BUILD-04: <Title>

/plan

Build ingestion/worker pipeline.

Components:
1. <component 1>
2. <component 2>
3. <component 3>

Concurrency, backoff, idempotency:
- <rules>

Audit logging:
- event=<name>, metadata={<fields>}

## Sx-TEST: Run after all build prompts complete

Write and run tests:
1. <test file> - <assertions>
2. <test file> - <assertions>
3. <test file> - <assertions>

Run:
- <typecheck command>
- <test command>

Expected:
- All tests pass
- Typecheck: 0 errors
