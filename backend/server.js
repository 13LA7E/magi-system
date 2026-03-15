const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');
const fs = require('fs');
const { runDeliberation } = require('./deliberation');
const { preprocessQuery } = require('./triage');
const { connectDB, getDailyCount, logDeliberation, getRecentLogs } = require('./db');

const app = express();
const PORT = 3001;
const DAILY_LIMIT = 100;

function hasEnvValue(key) {
  return typeof process.env[key] === 'string' && process.env[key].trim().length > 0;
}

function logApiKeyStatus() {
  const apiKeys = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY'];
  for (const key of apiKeys) {
    console.log(`${key}: ${hasEnvValue(key) ? 'found' : 'missing'}`);
  }
}

logApiKeyStatus();

const allowedOrigins = [
  'http://localhost:3001',
  'http://127.0.0.1:5500',
  'https://13la7e.github.io',
  'https://trymagi.tech',
  'https://www.trymagi.tech',
];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
  credentials: true,
}));
app.use(express.json());

app.use(express.static(path.join(__dirname, '../docs')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../docs/index.html'));
});

app.get('/health', async (req, res, next) => {
  try {
    const used = await getDailyCount();
    res.json({
      status: 'ok',
      units: ['melchior', 'balthasar', 'casper'],
      providers: {
        melchior: 'Anthropic',
        balthasar: 'Google',
        casper: 'OpenAI',
      },
      queriesUsedToday: used,
      queriesRemainingToday: Math.max(0, DAILY_LIMIT - used),
    });
  } catch (err) {
    return next(err);
  }
});

app.get('/api/audit', async (req, res, next) => {
  try {
    const logs = await getRecentLogs(10);
    const formatted = logs.map((e) => {
      const stage2 = e.stage2 || {};
      return {
        timestamp: e.timestamp,
        query: e.query ? e.query.slice(0, 80) + (e.query.length > 80 ? '…' : '') : '',
        mode: e.mode || '',
        consensus: e.consensus || '',
        escalate: !!e.escalate,
        durationMs: e.durationMs ?? e.duration ?? null,
        units: {
          melchior:  stage2.melchior  || e.melchior  || null,
          balthasar: stage2.balthasar || e.balthasar || null,
          casper:    stage2.casper    || e.casper    || null,
        },
      };
    });
    res.json({ status: 'ok', count: formatted.length, entries: formatted });
  } catch (err) {
    return next(err);
  }
});

function summarizeText(text, maxLength = 220) {
  if (!text || typeof text !== 'string') return '';
  const flattened = text.replace(/\s+/g, ' ').trim();
  if (!flattened) return '';
  return flattened.length > maxLength ? `${flattened.slice(0, maxLength).trim()}...` : flattened;
}

function extractCriticalAssumption(response) {
  if (!response || typeof response !== 'string') return '';

  const patterns = [
    /(?:^|\n)\s*4[\).\s-]*\s*critical assumption\s*[:\-]?\s*([\s\S]*?)(?=\n\s*(?:5[\).\s-]*\s*what would change|constraint flags|verdict\s*:|confidence\s*:|$))/i,
    /(?:^|\n)\s*critical assumption\s*[:\-]?\s*([\s\S]*?)(?=\n\s*(?:5[\).\s-]*\s*what would change|constraint flags|verdict\s*:|confidence\s*:|$))/i,
  ];

  for (const pattern of patterns) {
    const match = response.match(pattern);
    if (match && match[1]) {
      return summarizeText(match[1]);
    }
  }

  return '';
}

function topUnitByVerdict(units, verdict) {
  return units
    .filter((u) => u.verdict === verdict)
    .sort((a, b) => b.confidence - a.confidence)[0] || null;
}

function buildEscalationBrief(result) {
  const { consensus } = result;
  const stage2 = result.stage2 || {};
  const assumptions = result.assumptions || {};
  const units = [
    { name: 'MELCHIOR-1',  ...(stage2.melchior  || {}), assumption: assumptions.melchior  || '' },
    { name: 'BALTHASAR-2', ...(stage2.balthasar || {}), assumption: assumptions.balthasar || '' },
    { name: 'CASPER-3',    ...(stage2.casper    || {}), assumption: assumptions.casper    || '' },
  ];

  const conflictDesc = consensus === 'DEADLOCK'
    ? 'High-confidence deadlock detected.'
    : 'Split decision detected.';

  const disagreementBuckets = ['APPROVED', 'REJECTED', 'ABSTAIN']
    .map((verdict) => ({
      verdict,
      members: units
        .filter((u) => u.verdict === verdict)
        .map((u) => `${u.name} (${u.confidence}%)`),
    }))
    .filter((bucket) => bucket.members.length > 0);

  const disagreementPoint = disagreementBuckets.length > 1
    ? disagreementBuckets.map((bucket) => `${bucket.verdict}: ${bucket.members.join(', ')}`).join(' | ')
    : 'Weighted confidence is too close to support a clear majority.';

  const assumptionBreakdown = units
    .map((u) => `${u.name}: ${u.assumption || 'Assumption not explicitly stated.'}`)
    .join('\n');

  const topApproved = topUnitByVerdict(units, 'APPROVED');
  const topRejected = topUnitByVerdict(units, 'REJECTED');
  const topAbstain = topUnitByVerdict(units, 'ABSTAIN');

  let reviewerQuestion;
  if (topApproved && topRejected) {
    reviewerQuestion = `Which assumption is better supported by current evidence: ${topApproved.name} (${topApproved.assumption || 'approval assumption not explicitly stated'}) or ${topRejected.name} (${topRejected.assumption || 'rejection assumption not explicitly stated'})?`;
  } else if (topAbstain) {
    reviewerQuestion = `Which missing fact from ${topAbstain.name}'s constraint flags can be verified first to move ABSTAIN to a decision?`;
  } else {
    reviewerQuestion = 'Which single missing fact, if verified now, would most likely break this conflict?';
  }

  return `${conflictDesc}\nExact point of disagreement between units:\n${disagreementPoint}\n\nDiffering unit assumptions:\n${assumptionBreakdown}\n\nQuestion for human reviewer:\n${reviewerQuestion}`;
}

async function generateSynthesisSummary(stage1, stage2, consensus) {
  const fallback = {
    keyContributions: { melchior: '', balthasar: '', casper: '' },
    convergencePoints: [],
    divergencePoints: [],
    dominantTheme: '',
    verdictRationale: '',
  };

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const s1 = stage1 || {};
    const s2 = stage2 || {};

    const prompt = `You are the synthesis engine of the MAGI deliberation system.
Analyze these three AI unit responses and extract a structured summary.

MELCHIOR Stage 1: ${(s1.melchior || {}).response || ''}
BALTHASAR Stage 1: ${(s1.balthasar || {}).response || ''}
CASPER Stage 1: ${(s1.casper || {}).response || ''}

MELCHIOR Stage 2 decision: ${(s2.melchior || {}).response || ''}
BALTHASAR Stage 2 decision: ${(s2.balthasar || {}).response || ''}
CASPER Stage 2 decision: ${(s2.casper || {}).response || ''}

Final consensus: ${consensus || ''}

Respond ONLY in this exact JSON format with no preamble or markdown:
{
  "keyContributions": {
    "melchior": "one sentence summary of MELCHIOR key argument",
    "balthasar": "one sentence summary of BALTHASAR key argument",
    "casper": "one sentence summary of CASPER key argument"
  },
  "convergencePoints": [
    "point all units agreed on",
    "another point of agreement"
  ],
  "divergencePoints": [
    "specific point of disagreement",
    "another point of conflict"
  ],
  "dominantTheme": "one sentence describing the overall pattern",
  "verdictRationale": "one paragraph explaining why this consensus was reached or why it deadlocked"
}`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content.find((b) => b.type === 'text')?.text || '{}';
    try {
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  } catch (err) {
    console.error('[MAGI] Synthesis summary generation failed:', err.message);
    return fallback;
  }
}

app.post('/api/deliberate', async (req, res, next) => {
  const { query, mode, testerId } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ status: 'error', message: 'query must be a non-empty string' });
  }

  if (!mode || typeof mode !== 'string') {
    return res.status(400).json({ status: 'error', message: 'mode must be a non-empty string' });
  }

  const triage = preprocessQuery(query);
  if (!triage.ok) {
    return res.status(400).json({ status: 'error', message: triage.error });
  }

  const cleanQuery = triage.query;

  const dailyUsed = await getDailyCount();
  if (dailyUsed >= DAILY_LIMIT) {
    return res.status(429).json({
      status: 'error',
      message: `Daily query limit of ${DAILY_LIMIT} reached. Resets at midnight UTC.`,
    });
  }

  try {
    const deliberationStart = Date.now();
    const result = await runDeliberation(cleanQuery, mode);
    const synthesis = await generateSynthesisSummary(
      result.stage1,
      result.stage2,
      result.consensus
    );
    const durationMs = Date.now() - deliberationStart;

    const s1 = result.stage1 || {};
    const s2 = result.stage2 || result.stage1 || {};
    await logDeliberation({
      query: cleanQuery.slice(0, 300),
      mode,
      testerId: typeof testerId === 'string' ? testerId : '',
      stage1: {
        melchior: {
          verdict: (s1.melchior || {}).verdict || 'ABSTAIN',
          confidence: (s1.melchior || {}).confidence || 0,
        },
        balthasar: {
          verdict: (s1.balthasar || {}).verdict || 'ABSTAIN',
          confidence: (s1.balthasar || {}).confidence || 0,
        },
        casper: {
          verdict: (s1.casper || {}).verdict || 'ABSTAIN',
          confidence: (s1.casper || {}).confidence || 0,
        },
      },
      stage2: {
        melchior: {
          verdict: (s2.melchior || {}).verdict || 'ABSTAIN',
          confidence: (s2.melchior || {}).confidence || 0,
          decision: (s2.melchior || {}).decision || 'HOLD',
        },
        balthasar: {
          verdict: (s2.balthasar || {}).verdict || 'ABSTAIN',
          confidence: (s2.balthasar || {}).confidence || 0,
          decision: (s2.balthasar || {}).decision || 'HOLD',
        },
        casper: {
          verdict: (s2.casper || {}).verdict || 'ABSTAIN',
          confidence: (s2.casper || {}).confidence || 0,
          decision: (s2.casper || {}).decision || 'HOLD',
        },
      },
      assumptions: {
        melchior: (result.assumptions || {}).melchior || '',
        balthasar: (result.assumptions || {}).balthasar || '',
        casper: (result.assumptions || {}).casper || '',
      },
      consensus: result.consensus,
      weightedScore: result.weightedScore,
      escalate:  result.escalate,
      duration: durationMs,
    });

    const response = { status: 'ok', ...result, synthesis };
    if (triage.note) {
      response.queryNote = triage.note;
    }
    if (result.escalate) {
      response.escalationBrief = buildEscalationBrief(result);
    }

    return res.json(response);
  } catch (err) {
    return next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ status: 'error', message: 'Internal server error' });
});

// const sslOptions = {
//   key: fs.readFileSync('/etc/ssl/cloudflare-key.pem'),
//   cert: fs.readFileSync('/etc/ssl/cloudflare-cert.pem')
// };

// https.createServer(sslOptions, app).listen(443, () => {
//   console.log('MAGI backend running on HTTPS port 443');
// });

connectDB().catch((err) => {
  console.error('MongoDB connection failed:', err.message);
});

app.listen(3001, () => {
  console.log('MAGI backend running on HTTP port 3001');
});

app.listen(80, () => {
  console.log('MAGI backend running on HTTP port 80');
});
