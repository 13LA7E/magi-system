# Admin Endpoint Setup Guide

This guide covers how to configure and use the new `/admin/restart` endpoint that allows Claude (or any authenticated client) to control your MAGI backend.

## Step 1: Set the ADMIN_TOKEN Environment Variable

On your DigitalOcean droplet, set the `ADMIN_TOKEN` environment variable. Choose a strong, random token (at least 32+ characters).

### Option A: Using PM2 Ecosystem Config (Recommended)

Edit or create `ecosystem.config.js` in your MAGI directory:

```javascript
module.exports = {
  apps: [
    {
      name: 'magi',
      script: 'server.js',
      cwd: '/root/magi-system/backend',
      env: {
        NODE_ENV: 'production',
        ADMIN_TOKEN: 'your-super-secret-token-here',
        // ... other env vars
      }
    }
  ]
};
```

Then restart PM2:
```bash
pm2 start ecosystem.config.js
```

### Option B: Using .env File

In your `/root/magi-system/backend/.env`:
```
ADMIN_TOKEN=your-super-secret-token-here
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
GEMINI_API_KEY=...
TAVILY_API_KEY=...
MONGODB_URI=...
```

### Option C: Direct Environment Variable

```bash
export ADMIN_TOKEN="your-super-secret-token-here"
pm2 restart all
```

## Step 2: Available Actions

The `/admin/restart` endpoint supports three actions via POST request:

### 1. Check PM2 Status
```bash
curl -X POST https://trymagi.tech/admin/restart \
  -H "Content-Type: application/json" \
  -H "x-admin-token: your-super-secret-token-here" \
  -d '{"action":"status"}'
```

**Response:**
```json
{
  "success": true,
  "status": "[PM2 status output here]"
}
```

### 2. Restart All PM2 Processes
```bash
curl -X POST https://trymagi.tech/admin/restart \
  -H "Content-Type: application/json" \
  -H "x-admin-token: your-super-secret-token-here" \
  -d '{"action":"restart-pm2"}'
```

**Response:**
```json
{
  "success": true,
  "message": "PM2 restarted",
  "output": "[PM2 restart output here]"
}
```

### 3. Pull Latest Code & Deploy
```bash
curl -X POST https://trymagi.tech/admin/restart \
  -H "Content-Type: application/json" \
  -H "x-admin-token: your-super-secret-token-here" \
  -d '{"action":"pull-and-deploy"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Deployed and restarted",
  "output": "[Git pull and PM2 restart output here]"
}
```

## Step 3: How Claude Can Call This

When you want Claude to control your backend, you can:

1. **Provide the token in the conversation** (for the session only):
   - Copy your `ADMIN_TOKEN` value
   - Paste it in the chat
   - Claude will use it for that conversation session
   - The token is NOT stored or logged

2. **Example prompt to Claude:**
   ```
   My ADMIN_TOKEN is: abc123def456...
   Please check the status of my MAGI backend by calling the /admin/restart endpoint with action "status".
   ```

3. **Claude will then execute:**
   ```javascript
   const response = await fetch("https://trymagi.tech/admin/restart", {
     method: "POST",
     headers: {
       "Content-Type": "application/json",
       "x-admin-token": "abc123def456..."
     },
     body: JSON.stringify({ action: "status" })
   });
   
   const data = await response.json();
   console.log(data);
   ```

## Security Considerations

- ✅ **Token is passed in request headers** (not in the URL)
- ✅ **Token is verified using timing-safe comparison** to prevent timing attacks
- ✅ **Token must be 32+ characters** (use a cryptographically secure random string)
- ✅ **Only POST requests are allowed** (GET is blocked)
- ✅ **All admin actions are logged** with IP and timestamp
- ✅ **Endpoint returns 503 if token is not configured** (safe failure mode)
- ✅ **Only specific actions are allowed** (no arbitrary command execution)

## Recommended Token Generation

Generate a secure token using:

```bash
# On your local machine or droplet
openssl rand -base64 32
```

Or in Node.js:
```javascript
require('crypto').randomBytes(32).toString('hex');
```

## Troubleshooting

### "Admin token not configured" (503)
- The `ADMIN_TOKEN` environment variable is not set
- Restart your PM2 process after setting the env var

### "Unauthorized" (401)
- The `x-admin-token` header is missing or incorrect
- Verify the token matches exactly (case-sensitive)

### "Unknown action" (400)
- You used an invalid action name
- Only `status`, `restart-pm2`, and `pull-and-deploy` are allowed

### Command execution fails (500)
- PM2 or git commands may not be available in the path
- Check your droplet's shell environment
- Run the commands manually on your droplet to debug

## Example Node.js Wrapper

If you want to create a helper script:

```javascript
async function controlMagi(action, adminToken) {
  const response = await fetch("https://trymagi.tech/admin/restart", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": adminToken
    },
    body: JSON.stringify({ action })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

// Usage
const adminToken = process.env.ADMIN_TOKEN;
controlMagi("status", adminToken)
  .then(result => console.log(result))
  .catch(err => console.error(err));
```
