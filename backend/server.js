const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { runDeliberation } = require('./deliberation');
const { preprocessQuery } = require('./triage');
const { connectDB, getDailyCount, logDeliberation, getRecentLogs } = require('./db');

const app = express();

const DAILY_LIMIT = process.env.DAILY_LIMIT ? parseInt(process.env.DAILY_LIMIT, 10) : 100;
if (!process.env.DAILY_LIMIT) {
  console.warn('[MAGI] DAILY_LIMIT not set — defaulting to 100');
}

let lastDebugLog = null;

const PRICING_PER_MILLION = {
  'gpt-4o-mini': { in: 0.15, out: 0.60 },
  'claude-haiku-4-5': { in: 0.80, out: 4.00 },
  'gemini-2.5-flash': { in: 0.075, out: 0.30 },
};

function hasEnvValue(key) {
  return typeof process.env[key] === 'string' && process.env[key].trim().length > 0;
}

function logApiKeyStatus() {
  const apiKeys = ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY'];
  for (const key of apiKeys) {
    console.log(`${key}: ${hasEnvValue(key) ? 'found' : 'missing'}`);
  }
  console.log('TAVILY_API_KEY:', process.env.TAVILY_API_KEY ? 'found' : 'missing');
}

logApiKeyStatus();

const defaultOrigins = 'https://trymagi.tech';
const rawOrigins = process.env.CORS_ORIGINS || defaultOrigins;
const allowedOrigins = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);

if (process.env.NODE_ENV === 'production' && allowedOrigins.some((o) => o.includes('localhost'))) {
  console.warn('[MAGI] CORS_ORIGINS contains localhost in production — verify this is intentional');
}
console.log('[MAGI] Config — DAILY_LIMIT:', DAILY_LIMIT, '| NODE_ENV:', process.env.NODE_ENV || 'unset', '| CORS_ORIGINS:', allowedOrigins.join(', ') || '(none)', '| ENABLE_DEBUG_ENDPOINT:', process.env.ENABLE_DEBUG_ENDPOINT || 'false');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
    },
  },
}));

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
  credentials: true,
}));
app.use(express.json({ limit: '50kb' }));

const deliberateRateLimit = rateLimit({ windowMs: 60 * 1000, max: 20 });
const auditRateLimit = rateLimit({ windowMs: 60 * 1000, max: 30 });
const debugRateLimit = rateLimit({ windowMs: 60 * 1000, max: 10 });

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
        melchior: 'OpenAI',
        balthasar: 'Anthropic',
        casper: 'Google',
      },
      queriesUsedToday: used,
      queriesRemainingToday: Math.max(0, DAILY_LIMIT - used),
    });
  } catch (err) {
    return next(err);
  }
});

app.get('/api/audit', auditRateLimit, async (req, res, next) => {
  try {
    const logs = await getRecentLogs(10);
    const formatted = logs.map((e) => {
      const stage2 = e.stage2 || {};
      return {
        timestamp: e.timestamp,
        testerId: e.testerId && e.testerId.trim() ? e.testerId.trim() : 'ANONYMOUS',
        query: e.query ? e.query.slice(0, 80) + (e.query.length > 80 ? '…' : '') : '',
        mode: e.mode || '',
        classification: e.classification || 'FACTUAL',
        searchUsed: !!e.searchUsed,
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
      return {
        summary: JSON.parse(text),
        meta: {
          promptSent: prompt,
          responseReceived: text,
          tokensIn: message?.usage?.input_tokens ?? 0,
          tokensOut: message?.usage?.output_tokens ?? 0,
        },
      };
    } catch {
      return {
        summary: fallback,
        meta: {
          promptSent: prompt,
          responseReceived: text,
          tokensIn: message?.usage?.input_tokens ?? 0,
          tokensOut: message?.usage?.output_tokens ?? 0,
        },
      };
    }
  } catch (err) {
    console.error('[MAGI] Synthesis summary generation failed:', err.message);
    return {
      summary: fallback,
      meta: {
        promptSent: null,
        responseReceived: null,
        tokensIn: 0,
        tokensOut: 0,
      },
    };
  }
}

function unitCost(model, tokensIn, tokensOut) {
  const price = PRICING_PER_MILLION[model];
  if (!price) return 0;
  return ((tokensIn / 1000000) * price.in) + ((tokensOut / 1000000) * price.out);
}

app.post('/api/deliberate', deliberateRateLimit, async (req, res, next) => {
  const { query: rawQuery, testerId, developerMode } = req.body;

  if (!rawQuery || typeof rawQuery !== 'string' || rawQuery.trim().length === 0) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', field: 'query', message: 'query is required and must be a non-empty string' });
  }
  if (rawQuery.length > 2000) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', field: 'query', message: 'query must not exceed 2000 characters' });
  }
  if (testerId !== undefined) {
    if (typeof testerId !== 'string') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', field: 'testerId', message: 'testerId must be a string' });
    }
    if (testerId.length > 100) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', field: 'testerId', message: 'testerId must not exceed 100 characters' });
    }
    if (testerId.length > 0 && !/^[a-zA-Z0-9-]+$/.test(testerId)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', field: 'testerId', message: 'testerId may only contain alphanumeric characters and hyphens' });
    }
  }
  if (developerMode !== undefined && typeof developerMode !== 'boolean') {
    return res.status(400).json({ error: 'VALIDATION_ERROR', field: 'developerMode', message: 'developerMode must be a boolean' });
  }

  const triage = preprocessQuery(rawQuery);
  if (triage.error) {
    return res.status(400).json({ status: 'error', message: triage.error });
  }

  const cleanQuery = triage.query;
  const normalizedTesterId = typeof testerId === 'string' && testerId.trim().length > 0
    ? testerId.trim()
    : 'ANONYMOUS';

  const dailyUsed = await getDailyCount();
  if (dailyUsed >= DAILY_LIMIT) {
    return res.status(429).json({
      status: 'error',
      message: `Daily query limit of ${DAILY_LIMIT} reached. Resets at midnight UTC.`,
    });
  }

  try {
    const deliberationStart = Date.now();
    const result = await runDeliberation(cleanQuery, { developerMode: !!developerMode });
    const synthesisResult = await generateSynthesisSummary(
      result.stage1,
      result.stage2,
      result.consensus
    );
    const synthesis = synthesisResult.summary;
    const synthesisMeta = synthesisResult.meta;
    const durationMs = Date.now() - deliberationStart;

    const s1 = result.stage1 || {};
    const s2 = result.stage2 || result.stage1 || {};
    await logDeliberation({
      query: cleanQuery.slice(0, 300),
      testerId: normalizedTesterId,
      classification: result.classification || 'FACTUAL',
      searchUsed: !!result.searchUsed,
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

    const response = {
      status: 'ok',
      ...result,
      classification: result.classification || 'FACTUAL',
      searchUsed: !!result.searchUsed,
      synthesis,
    };
    if (!developerMode) {
      delete response.debug;
    }
    if (triage.note) {
      response.queryNote = triage.note;
    }
    if (result.escalate) {
      response.escalationBrief = buildEscalationBrief(result);
    }

    const trace = result.debug || {};
    const mS1 = trace?.units?.melchior?.stage1 || {};
    const mS2 = trace?.units?.melchior?.stage2 || {};
    const bS1 = trace?.units?.balthasar?.stage1 || {};
    const bS2 = trace?.units?.balthasar?.stage2 || {};
    const cS1 = trace?.units?.casper?.stage1 || {};
    const cS2 = trace?.units?.casper?.stage2 || {};

    const tokensIn = (trace?.totals?.tokensIn || 0) + (synthesisMeta?.tokensIn || 0);
    const tokensOut = (trace?.totals?.tokensOut || 0) + (synthesisMeta?.tokensOut || 0);
    const stageCost =
      unitCost('gpt-4o-mini', mS1.tokensIn || 0, mS1.tokensOut || 0) +
      unitCost('gpt-4o-mini', mS2.tokensIn || 0, mS2.tokensOut || 0) +
      unitCost('claude-haiku-4-5', bS1.tokensIn || 0, bS1.tokensOut || 0) +
      unitCost('claude-haiku-4-5', bS2.tokensIn || 0, bS2.tokensOut || 0) +
      unitCost('gemini-2.5-flash', cS1.tokensIn || 0, cS1.tokensOut || 0) +
      unitCost('gemini-2.5-flash', cS2.tokensIn || 0, cS2.tokensOut || 0) +
      unitCost('claude-haiku-4-5', synthesisMeta?.tokensIn || 0, synthesisMeta?.tokensOut || 0);

    lastDebugLog = {
      timestamp: new Date().toISOString(),
      query: {
        raw: rawQuery,
        cleaned: cleanQuery,
        classification: triage.classification,
        note: triage.note,
      },
      search: {
        triggered: !!trace?.search?.triggered,
        collaborativeQuery: trace?.search?.collaborativeQuery || null,
        tavilyResponse: trace?.search?.tavilyResponse || null,
        tokensUsed: trace?.search?.tokensUsed || null,
      },
      units: {
        melchior: {
          stage1: {
            promptSent: mS1.promptSent || null,
            responseReceived: mS1.responseReceived || null,
            tokensIn: mS1.tokensIn ?? null,
            tokensOut: mS1.tokensOut ?? null,
            duration: mS1.duration ?? null,
          },
          stage2: {
            promptSent: mS2.promptSent || null,
            responseReceived: mS2.responseReceived || null,
            tokensIn: mS2.tokensIn ?? null,
            tokensOut: mS2.tokensOut ?? null,
            duration: mS2.duration ?? null,
          },
        },
        balthasar: {
          stage1: {
            promptSent: bS1.promptSent || null,
            responseReceived: bS1.responseReceived || null,
            tokensIn: bS1.tokensIn ?? null,
            tokensOut: bS1.tokensOut ?? null,
            duration: bS1.duration ?? null,
          },
          stage2: {
            promptSent: bS2.promptSent || null,
            responseReceived: bS2.responseReceived || null,
            tokensIn: bS2.tokensIn ?? null,
            tokensOut: bS2.tokensOut ?? null,
            duration: bS2.duration ?? null,
          },
        },
        casper: {
          stage1: {
            promptSent: cS1.promptSent || null,
            responseReceived: cS1.responseReceived || null,
            tokensIn: cS1.tokensIn ?? null,
            tokensOut: cS1.tokensOut ?? null,
            duration: cS1.duration ?? null,
          },
          stage2: {
            promptSent: cS2.promptSent || null,
            responseReceived: cS2.responseReceived || null,
            tokensIn: cS2.tokensIn ?? null,
            tokensOut: cS2.tokensOut ?? null,
            duration: cS2.duration ?? null,
          },
        },
      },
      synthesis: {
        promptSent: synthesisMeta?.promptSent || null,
        responseReceived: synthesisMeta?.responseReceived || null,
        tokensIn: synthesisMeta?.tokensIn ?? null,
        tokensOut: synthesisMeta?.tokensOut ?? null,
        duration: null,
      },
      totals: {
        tokensIn,
        tokensOut,
        totalTokens: tokensIn + tokensOut,
        estimatedCost: Number(stageCost.toFixed(8)),
        duration: durationMs,
      },
      consensus: {
        stage1Verdicts: trace?.consensus?.stage1Verdicts || {},
        stage2Verdicts: trace?.consensus?.stage2Verdicts || {},
        weightedScore: result.weightedScore,
        finalConsensus: result.consensus,
        escalate: !!result.escalate,
      },
    };

    return res.json(response);
  } catch (err) {
    return next(err);
  }
});

app.get('/api/debug/last', debugRateLimit, (req, res) => {
  const debugEnabled = process.env.ENABLE_DEBUG_ENDPOINT === 'true';

  if (!debugEnabled) {
    return res.status(404).json({ error: 'Not found' });
  }

  const token = req.headers['x-debug-token'];
  if (!token || token.length < 32) {
    console.log(`[MAGI] Unauthorized debug access attempt — IP: ${req.ip} — ${new Date().toISOString()}`);
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!lastDebugLog) {
    return res.status(404).json({ error: 'No debug log available yet' });
  }

  return res.json({ status: 'ok', debug: lastDebugLog });
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

app.listen(80, () => {
  console.log('MAGI backend running on HTTP port 80');
});
