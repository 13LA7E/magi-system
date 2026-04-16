# Sprint Doc Style Guide (Reference Format)

Use this standard for all new sprint documents.

## Purpose

- Keep implementation prompts executable with minimal back-and-forth.
- Encode sequence, dependencies, and non-negotiable rules in one place.
- Make each sprint runnable by copy-pasting /plan blocks.

## Required Structure

1. `GLOBAL INIT`
- One block run at session start.
- Includes stack, source-of-truth, critical business rules, and test gate.

2. `SPRINT HEADER`
- Sprint name, day range, and objective.

3. `BUILD ITEMS` in strict sequence
- Use IDs like `Sx-BUILD-01`, `Sx-BUILD-02`.
- Each item starts with `/plan` and includes exact scope, exports, flow, constraints.
- State why the item order matters when dependencies exist.

4. `TEST BLOCK`
- One consolidated sprint test section.
- Include route tests: happy path + auth failure + error case.
- Include command to run tests and expected result.

## Writing Rules

- Use imperative instructions, not discussion.
- Specify exact file paths and exported symbols.
- Include data contracts and return types where relevant.
- Declare non-negotiable constraints explicitly.
- Include edge cases and failure behavior.
- Include performance or cost guardrails if relevant.

## Prompt Design Rules

- Keep each `/plan` focused on one build item.
- Put acceptance expectations in the same block.
- Keep wording short and unambiguous.
- Do not mix unrelated refactors into a build item.

## Definition Of Done Per Build Item

- Files created/updated as specified.
- Typed exports match requested signatures.
- Failure paths implemented (not TODO).
- Tests added or updated for changed behavior.

## Definition Of Done For Sprint

- All `Sx-BUILD-*` items complete in order.
- Sprint test block passes fully.
- Typecheck and test commands pass.
- No violation of CLAUDE.md invariants.
