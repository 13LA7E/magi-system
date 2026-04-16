Read .claude/context.md first so you know the current state.

Then update .claude/context.md with:
- Active sprint name and number
- Story just completed (ID + one-line summary)
- All files changed this session (paths only)
- Checks run and their outcomes (pass / fail)
- Any blockers encountered
- Exact next action for next session (specific file + what to do)
- Detailed change log: for each file changed, what was added or modified and why
- Issues found during this session and exactly how each was fixed

Rules:
- Bullet points only, no prose
- Do not include code or diffs
- Overwrite the relevant sections, do not append duplicates

Then run:
git add -A
git commit -m "sprint: [sprint number] [story ID] - [one line summary of what was done]"
git push origin main