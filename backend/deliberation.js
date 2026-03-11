const { callMelchior } = require('./melchior');
const { callBalthasar } = require('./balthasar');
const { callCasper } = require('./casper');

const VERDICT_RE = /^VERDICT:\s*(APPROVED|REJECTED|ABSTAIN)/m;
const CONFIDENCE_RE = /^CONFIDENCE:\s*(\d{1,3})%/m;

function parseResponse(text) {
  const verdictMatch = text.match(VERDICT_RE);
  const confidenceMatch = text.match(CONFIDENCE_RE);

  const verdict = verdictMatch ? verdictMatch[1] : 'ABSTAIN';
  const confidence = confidenceMatch ? Math.min(100, parseInt(confidenceMatch[1], 10)) : 0;

  return { verdict, confidence };
}

function computeConsensus(units) {
  const allHighConfidence = units.every((u) => u.confidence > 85);
  const uniqueVerdicts = new Set(units.map((u) => u.verdict));
  const allAgree = uniqueVerdicts.size === 1;

  if (allHighConfidence && !allAgree) {
    return { consensus: 'DEADLOCK', weightedScore: 0 };
  }

  let weightedApproved = 0;
  let weightedRejected = 0;

  for (const unit of units) {
    if (unit.verdict === 'APPROVED') weightedApproved += unit.confidence;
    else if (unit.verdict === 'REJECTED') weightedRejected += unit.confidence;
  }

  const weightedScore = weightedApproved - weightedRejected;

  let consensus;
  if (weightedScore > 20) consensus = 'APPROVED';
  else if (weightedScore < -20) consensus = 'REJECTED';
  else consensus = 'SPLIT';

  return { consensus, weightedScore };
}

async function callUnit(name, fn, query, mode) {
  const start = Date.now();
  try {
    console.log(`[${name}] Calling API...`);
    const response = await fn(query, mode);
    const elapsed = Date.now() - start;
    console.log(`[${name}] Responded in ${elapsed}ms`);
    return { response, error: null };
  } catch (err) {
    const elapsed = Date.now() - start;
    console.error(`[${name}] Failed after ${elapsed}ms: ${err.message}`);
    return {
      response: `[${name} ERROR] ${err.message}`,
      error: err.message,
    };
  }
}

async function runDeliberation(query, mode) {
  const start = Date.now();
  console.log(`[MAGI] Deliberation started — mode: ${mode}`);

  const [melchiorResult, balthasarResult, casperResult] = await Promise.all([
    callUnit('MELCHIOR', callMelchior, query, mode),
    callUnit('BALTHASAR', callBalthasar, query, mode),
    callUnit('CASPER', callCasper, query, mode),
  ]);

  const elapsed = Date.now() - start;
  console.log(`[MAGI] All units responded in ${elapsed}ms`);

  const melchiorParsed = parseResponse(melchiorResult.response);
  const balthasarParsed = parseResponse(balthasarResult.response);
  const casperParsed = parseResponse(casperResult.response);

  const units = [melchiorParsed, balthasarParsed, casperParsed];
  const { consensus, weightedScore } = computeConsensus(units);

  const escalate = consensus === 'DEADLOCK' || consensus === 'SPLIT';
  console.log(`[MAGI] Consensus: ${consensus} (weighted delta: ${weightedScore}, escalate: ${escalate})`);

  return {
    melchior: { response: melchiorResult.response, ...melchiorParsed },
    balthasar: { response: balthasarResult.response, ...balthasarParsed },
    casper: { response: casperResult.response, ...casperParsed },
    consensus,
    weightedScore,
    escalate,
  };
}

module.exports = { runDeliberation };
