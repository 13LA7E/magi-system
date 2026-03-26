# MAGI System

A three-unit AI deliberation system inspired by the MAGI supercomputer from Neon Genesis Evangelion. Three independent AI units — MELCHIOR (logic), BALTHASAR (ethics), and CASPER (intuition) — each powered by a different AI provider, deliberate on a query and produce a confidence-weighted consensus. Includes synthesis summary generation, audit logging, and intelligent query preprocessing.

## Live Webpage

[https://trymagi.tech](https://trymagi.tech)

## System Features

- **Multi-Unit Deliberation**: Three independent AI units with distinct reasoning styles
- **Synthesis Summary**: Automatic generation of convergence/divergence analysis after deliberation
- **Audit Logging**: MongoDB-backed persistent storage of all deliberations with tester tracking
- **Query Preprocessing**: Intelligent detection of recent events and named individuals with contextual cautions
- **Persona Resilience**: Built-in safeguards against false premises and harmful content scenarios
- **Unified Domain**: Both frontend and backend served from same domain (https://trymagi.tech)
- **CRT Aesthetic**: Terminal-style UI with green scanlines and Orbitron typography

## Architecture

| Unit | Role | AI Provider | Model |
|------|------|-------------|-------|
| MELCHIOR-1 | Logic & scientific reasoning | OpenAI | gpt-4o-mini |
| BALTHASAR-2 | Ethics & harm modeling | Anthropic | claude-haiku-4-5 |
| CASPER-3 | Intuition & lateral thinking | OpenAI | gpt-4o-mini |

## Setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root with your API keys:

```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

You need active API keys from:
- [OpenAI API Keys](https://platform.openai.com/api-keys)
- [Anthropic Console](https://console.anthropic.com/)

### 3. Set up MongoDB

Ensure MongoDB is running on your machine:

```bash
# Start MongoDB (default: localhost:27017)
mongod
```

The system will connect to `mongodb://localhost:27017/magi` automatically.

### 4. Start the backend server

```bash
cd backend
node server.js
```

The server runs on **http://localhost:80** and serves both the API and frontend. You should see:

```
MAGI backend listening on port 80
MongoDB connected
```

Verify it's running:

```bash
curl http://localhost/health
```

Expected response:

```json
{
  "status": "ok",
  "units": {
    "melchior": "OpenAI",
    "balthasar": "Anthropic",
    "casper": "OpenAI"
  }
}
```

### 5. Open the frontend

The frontend is automatically served by the backend. Navigate to:

- **Local**: http://localhost
- **Deployed**: https://trymagi.tech

## Usage

1. **Enter Tester ID** (optional): Add your identifier to track your deliberations
2. **Type a query** into the text area
3. **Select a deliberation mode**: Standard, Emergency, Critical, or Advisory
4. **Click INITIATE DELIBERATION** (or press Ctrl+Enter)
5. **View results**:
   - Stage 1 verdicts from all three units (simultaneous deliberation)
   - Stage 2 post-exchange verdicts after units review each other's reasoning
   - Synthesis summary with key contributions, convergence/divergence analysis, and dominant theme
6. **Check audit log** to see all past deliberations and consensus outcomes

## API Endpoints

### POST /api/deliberate

Initiate a deliberation with all three MAGI units.

**Request:**
```json
{
  "query": "Should we proceed with Project X?",
  "mode": "STANDARD",
  "testerId": "user-123"
}
```

**Response:**
```json
{
  "query": "...",
  "mode": "STANDARD",
  "stage1": {
    "melchior": { "verdict": "...", "confidence": 0.85 },
    "balthasar": { "verdict": "...", "confidence": 0.90 },
    "casper": { "verdict": "...", "confidence": 0.78 }
  },
  "stage2": {
    "melchior": { "verdict": "...", "confidence": 0.87, "decision": "UPDATE" },
    "balthasar": { "verdict": "...", "confidence": 0.92, "decision": "HOLD" },
    "casper": { "verdict": "...", "confidence": 0.80, "decision": "UPDATE" }
  },
  "assumptions": ["...", "..."],
  "consensus": "APPROVE",
  "escalate": false,
  "synthesis": {
    "keyContributions": ["...", "..."],
    "convergencePoints": ["...", "..."],
    "divergencePoints": ["...", "..."],
    "dominantTheme": "...",
    "verdictRationale": "..."
  },
  "duration": 2345
}
```

### GET /api/audit

Retrieve recent deliberations from the audit log.

**Response:**
```json
[
  {
    "_id": "...",
    "timestamp": "2026-03-22T10:30:00Z",
    "query": "Should we proceed with Project X?",
    "mode": "STANDARD",
    "testerId": "user-123",
    "consensus": "APPROVE",
    "duration": 2345
  }
]
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "units": {
    "melchior": "OpenAI",
    "balthasar": "Anthropic",
    "casper": "OpenAI"
  }
}
```

## Query Preprocessing

The system includes intelligent query analysis:

- **Recent Event Detection**: Identifies queries referencing recent events (time markers, years, news keywords) and appends a caution note about training data cutoffs
- **Named Individual Detection**: Flags queries that reference specific named individuals and advises careful handling
- **Safeguard Prompts**: All units include persona-specific resilience paragraphs addressing false premises and harmful scenarios

## Project Structure

```
magi-system/
├── backend/
│   ├── server.js           # Express app & main API endpoints
│   ├── db.js               # MongoDB schema & persistence layer
│   ├── melchior.js         # MELCHIOR-1 logic unit (OpenAI)
│   ├── balthasar.js        # BALTHASAR-2 ethics unit (Anthropic)
│   ├── casper.js           # CASPER-3 intuition unit (OpenAI)
│   ├── triage.js           # Query preprocessing & validation
│   ├── deliberation.js     # Deliberation orchestration logic
│   └── package.json
└── docs/
    ├── index.html          # Frontend UI (CRT-styled terminal)
    ├── style.css           # Styling & animations
    └── app.js              # Frontend JavaScript logic
```

## Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js with Express.js
- **Database**: MongoDB with Mongoose ODM
- **AI Providers**: OpenAI API, Anthropic API
- **Styling**: Orbitron font, green terminal theme, scanline effects

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key (for MELCHIOR & CASPER) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key (for BALTHASAR) |
| `MONGODB_URI` | No | MongoDB connection string (default: `mongodb://localhost:27017/magi`) |
| `PORT` | No | Server port (default: `80`) |

## Troubleshooting

**MongoDB connection error**: Ensure MongoDB is running and accessible at localhost:27017

**API key errors**: Verify your .env file contains valid OPENAI_API_KEY and ANTHROPIC_API_KEY

**CORS issues**: If accessing from a different domain, ensure the backend is configured to accept requests

**Query timeout**: Some queries may take longer if units are exchanging multiple rounds of reasoning

## Notes

- The synthesis summary is generated automatically after all three units complete both deliberation stages
- Audit logs are stored persistently in MongoDB with full deliberation context
- Tester ID tracking allows analysis of deliberation patterns across different users
- Query preprocessing runs before deliberation to ensure all units receive context-aware inputs
