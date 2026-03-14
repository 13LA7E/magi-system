# MAGI System

A three-unit AI deliberation system inspired by the MAGI supercomputer from Neon Genesis Evangelion. Three independent AI units — MELCHIOR (logic), BALTHASAR (ethics), and CASPER (intuition) — each powered by a different AI provider, deliberate on a query and produce a confidence-weighted consensus.

## Live Webpage

[https://13la7e.github.io/magi-system/](https://13la7e.github.io/magi-system/)

## Architecture

| Unit | Role | AI Provider |
|------|------|-------------|
| MELCHIOR-1 | Logic & scientific reasoning | Anthropic (Claude) |
| BALTHASAR-2 | Ethics & harm modeling | Google (Gemini) |
| CASPER-3 | Intuition & lateral thinking | xAI (Grok) |

## Setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure API keys

Copy the `.env` file in the project root and fill in your API keys:

```
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AI...
GROK_API_KEY=xai-...
```

You need active API keys from:
- [Anthropic Console](https://console.anthropic.com/)
- [Google AI Studio](https://aistudio.google.com/apikey)
- [xAI Console](https://console.x.ai/)

### 3. Start the backend

```bash
cd backend
node server.js
```

The server runs on **http://localhost:3001**. You should see:

```
MAGI backend listening on port 3001
```

Verify it's running:

```bash
curl http://localhost:3001/health
```

### 4. Open the frontend

Open `frontend/index.html` directly in your browser (no web server needed):

- On Windows: double-click the file, or run `start frontend/index.html`
- On macOS: `open frontend/index.html`
- On Linux: `xdg-open frontend/index.html`

### Usage

1. Type a query into the text area
2. Select a deliberation mode (Standard, Emergency, Critical, Advisory)
3. Click **INITIATE DELIBERATION** (or press Ctrl+Enter)
4. All three MAGI units respond simultaneously
5. The synthesis panel shows the confidence-weighted consensus

### API

**POST /api/deliberate**

```json
{
  "query": "Should we proceed with Project X?",
  "mode": "STANDARD"
}
```

**GET /health**

```json
{
  "status": "ok",
  "units": ["melchior", "balthasar", "casper"]
}
```
