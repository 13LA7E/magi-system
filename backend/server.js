require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const { runDeliberation } = require('./deliberation');

const app = express();
const PORT = 3001;

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (file://, curl, etc.) and localhost origins
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
}));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', units: ['melchior', 'balthasar', 'casper'] });
});

function buildEscalationBrief(result) {
  const { melchior, balthasar, casper, consensus } = result;
  const units = [
    { name: 'MELCHIOR-1', ...melchior },
    { name: 'BALTHASAR-2', ...balthasar },
    { name: 'CASPER-3', ...casper },
  ];

  const verdictSummary = units
    .map((u) => `${u.name} voted ${u.verdict} at ${u.confidence}% confidence`)
    .join('; ');

  const conflictDesc =
    consensus === 'DEADLOCK'
      ? 'All three units hold high-confidence but incompatible verdicts, producing a deadlock.'
      : 'The weighted votes are too close to reach a clear majority, producing a split.';

  // Extract the "what information would change your verdict" section from each unit
  const INFO_CHANGE_RE = /5\.\s*What information would change your verdict[\s\S]*?(?=\nVERDICT:|$)/i;
  const infoNeeded = units
    .map((u) => {
      const match = u.response.match(INFO_CHANGE_RE);
      return match ? `${u.name}: ${match[0].replace(/^5\.\s*What information would change your verdict[^\n]*\n?/i, '').trim()}` : null;
    })
    .filter(Boolean)
    .join('\n\n');

  return `${conflictDesc} Verdicts: ${verdictSummary}.\n\nInformation that could resolve the conflict:\n\n${infoNeeded || 'See individual unit responses for details.'}`;
}

app.post('/api/deliberate', async (req, res, next) => {
  const { query, mode } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ status: 'error', message: 'query must be a non-empty string' });
  }

  if (!mode || typeof mode !== 'string') {
    return res.status(400).json({ status: 'error', message: 'mode must be a non-empty string' });
  }

  try {
    const result = await runDeliberation(query, mode);

    const response = { status: 'ok', ...result };
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

app.listen(PORT, () => {
  console.log(`MAGI backend listening on port ${PORT}`);
});
