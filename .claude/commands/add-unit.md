I'm adding a new AI unit to the deliberation. Steps:
1. Create a new unit file in /backend following the pattern of melchior.js
2. Add it to deliberation.js Stage 1 Promise.all array
3. Update Stage 2 assumption exchange to include new unit
4. Update consensus weighting in Stage 3
5. Update audit log schema in db.js
Do not touch triage.js or searchOrchestrator.js.
