# Deploy Server

Deploy the current committed changes to the MAGI droplet and restart the backend.

First:

- read `CLAUDE.md`
- read `.claude/context.md`
- read `ADMIN_ENDPOINT_SETUP.md`
- confirm the working tree is committed or intentionally clean
- confirm the current branch before deploying

Then:

- push the current branch to `origin`
- call the protected admin endpoint on `https://trymagi.tech/admin/restart`
- use `action: pull-and-deploy` so the droplet runs `git pull` and restarts PM2
- require `MAGI_ADMIN_TOKEN` to be available in the shell environment; do not print or persist the token

Use this request shape:

```bash
curl -sS -X POST https://trymagi.tech/admin/restart \
  -H "Content-Type: application/json" \
  -H "x-admin-token: $MAGI_ADMIN_TOKEN" \
  -d '{"action":"pull-and-deploy"}'
```

If the push fails, stop and report the git error before attempting deployment.
If the admin call fails, report the HTTP status and response body.
