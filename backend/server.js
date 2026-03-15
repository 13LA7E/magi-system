require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const { runDeliberation } = require('./deliberation');
const { preprocessQuery } = require('./triage');
const { getDailyCount, logDeliberation, getRecentLogs, DAILY_LIMIT } = require('./auditLog');

const app = express();
const PORT = 3001;

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

app.get('/health', (req, res) => {
  const used = getDailyCount();
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
});

app.get('/api/audit', (req, res) => {
  const logs = getRecentLogs(10);
  const formatted = logs.map((e) => ({
    timestamp: e.timestamp,
    query: e.query ? e.query.slice(0, 80) + (e.query.length > 80 ? '…' : '') : '',
    mode: e.mode || '',
    consensus: e.consensus || '',
    escalate: !!e.escalate,
    durationMs: e.durationMs ?? null,
    units: {
      melchior:  e.melchior  || null,
      balthasar: e.balthasar || null,
      casper:    e.casper    || null,
    },
  }));
  res.json({ status: 'ok', count: formatted.length, entries: formatted });
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
  const { melchior, balthasar, casper, consensus } = result;
  const units = [
    { name: 'MELCHIOR-1', ...melchior },
    { name: 'BALTHASAR-2', ...balthasar },
    { name: 'CASPER-3', ...casper },
  ].map((unit) => ({
    ...unit,
    assumption: extractCriticalAssumption(unit.response),
  }));

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

app.post('/api/deliberate', async (req, res, next) => {
  const { query, mode } = req.body;

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

  const dailyUsed = getDailyCount();
  if (dailyUsed >= DAILY_LIMIT) {
    return res.status(429).json({
      status: 'error',
      message: `Daily query limit of ${DAILY_LIMIT} reached. Resets at midnight UTC.`,
    });
  }

  try {
    const deliberationStart = Date.now();
    const result = await runDeliberation(cleanQuery, mode);
    const durationMs = Date.now() - deliberationStart;

    logDeliberation({
      query: cleanQuery.slice(0, 300),
      mode,
      melchior:  { verdict: result.melchior.verdict,  confidence: result.melchior.confidence  },
      balthasar: { verdict: result.balthasar.verdict, confidence: result.balthasar.confidence },
      casper:    { verdict: result.casper.verdict,    confidence: result.casper.confidence    },
      consensus: result.consensus,
      escalate:  result.escalate,
      durationMs,
    });

    const response = { status: 'ok', ...result };
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

const sslOptions = {
  key: fs.readFileSync('/etc/letsencrypt/live/trymagi.tech/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/trymagi.tech/fullchain.pem')
};

https.createServer(sslOptions, app).listen(443, () => {
  console.log('MAGI backend running on HTTPS port 443');
});

app.listen(3001, () => {
  console.log('MAGI backend running on HTTP port 3001');
});
