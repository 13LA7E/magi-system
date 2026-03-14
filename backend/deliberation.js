const { callMelchior } = require('./melchior');
const { callBalthasar } = require('./balthasar');
const { callCasper } = require('./casper');

// Matches any line containing APPROVED / REJECTED / ABSTAIN (case-insensitive),
// including variants like CONDITIONAL APPROVAL, PARTIAL APPROVAL, etc.
const VERDICT_LINE_RE = /^.*?(APPROVED|REJECTED|ABSTAIN).*$/im;

// Matches all common confidence formats:
//   CONFIDENCE: 45%  |  CONFIDENCE: 45  |  **CONFIDENCE: 45%**
//   Confidence: 45%  |  45% confidence
const CONFIDENCE_RE = /(?:\*{0,2}confidence\s*:\s*(\d{1,3})%?\*{0,2}|(\d{1,3})%\s+confidence)/i;

function parseResponse(text) {
  const verdictMatch = text.match(VERDICT_LINE_RE);
  const confidenceMatch = text.match(CONFIDENCE_RE);

  // Normalise variants: CONDITIONAL APPROVAL → APPROVED, CONDITIONAL REJECTION → REJECTED
  let verdict = 'ABSTAIN';
  if (verdictMatch) {
    const raw = verdictMatch[1].toUpperCase();
    if (raw === 'APPROVED') verdict = 'APPROVED';
    else if (raw === 'REJECTED') verdict = 'REJECTED';
    else verdict = 'ABSTAIN';
  }

  // confidenceMatch[1] covers "CONFIDENCE: N%" forms; [2] covers "N% confidence"
  const rawConf = confidenceMatch ? (confidenceMatch[1] ?? confidenceMatch[2]) : null;
  const confidence = rawConf !== null ? Math.min(100, parseInt(rawConf, 10)) : 50;

  return { verdict, confidence };
}

function computeConsensus(units) {
  const decisiveUnits = units.filter((u) => u.verdict === 'APPROVED' || u.verdict === 'REJECTED');
  const abstainCount = units.length - decisiveUnits.length;

  // Majority ABSTAIN means the query lacks enough concrete context for a hard decision.
  if (abstainCount >= 2) {
    if (decisiveUnits.length === 1) {
      const loneVote = decisiveUnits[0];
      const reducedConfidence = Math.max(1, Math.round(loneVote.confidence * 0.6));
      const weightedScore = loneVote.verdict === 'APPROVED' ? reducedConfidence : -reducedConfidence;
      return {
        consensus: 'INSUFFICIENT_CONTEXT',
        weightedScore,
        reducedConfidence,
        singleVoteDirection: loneVote.verdict,
      };
    }

    return { consensus: 'INSUFFICIENT_CONTEXT', weightedScore: 0 };
  }

  let weightedApproved = 0;
  let weightedRejected = 0;

  // ABSTAIN votes never contribute to weighted delta.
  for (const unit of decisiveUnits) {
    if (unit.verdict === 'APPROVED') weightedApproved += unit.confidence;
    else if (unit.verdict === 'REJECTED') weightedRejected += unit.confidence;
  }

  const weightedScore = weightedApproved - weightedRejected;

  // If only one unit casts a non-ABSTAIN verdict, honor it but at reduced confidence.
  if (decisiveUnits.length === 1) {
    const loneVote = decisiveUnits[0];
    const reducedConfidence = Math.max(1, Math.round(loneVote.confidence * 0.6));
    const reducedWeightedScore = loneVote.verdict === 'APPROVED' ? reducedConfidence : -reducedConfidence;
    return {
      consensus: loneVote.verdict,
      weightedScore: reducedWeightedScore,
      reducedConfidence,
      singleVoteDirection: loneVote.verdict,
    };
  }

  const allHighConfidence = decisiveUnits.length === units.length && decisiveUnits.every((u) => u.confidence > 85);
  const uniqueVerdicts = new Set(decisiveUnits.map((u) => u.verdict));
  const allAgree = uniqueVerdicts.size === 1;

  if (allHighConfidence && !allAgree) {
    return { consensus: 'DEADLOCK', weightedScore };
  }

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

  function withUnitTimeout(unitCallPromise) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Unit timed out after 30 seconds'));
      }, 30000);
    });

    return Promise.race([unitCallPromise, timeoutPromise]).finally(() => {
      clearTimeout(timeoutId);
    });
  }

  async function callUnitSafely(name, fn) {
    const unitStart = Date.now();
    try {
      console.log(`[${name}] Calling API...`);
      const response = await withUnitTimeout(fn(query, mode));
      const elapsed = Date.now() - unitStart;
      console.log(`[${name}] Responded in ${elapsed}ms`);

      const parsed = parseResponse(response);
      console.log(`[${name}] parsed → verdict: ${parsed.verdict}, confidence: ${parsed.confidence}%`);

      return {
        response,
        verdict: parsed.verdict,
        confidence: parsed.confidence,
        unavailable: false,
      };
    } catch (err) {
      const elapsed = Date.now() - unitStart;
      console.error(`[${name}] Failed after ${elapsed}ms: ${err.message}`);
      return {
        response: `UNIT UNAVAILABLE - API error: ${err.message}`,
        verdict: 'ABSTAIN',
        confidence: 0,
        unavailable: true,
      };
    }
  }

  const [melchiorResult, balthasarResult, casperResult] = await Promise.all([
    callUnitSafely('MELCHIOR', callMelchior),
    callUnitSafely('BALTHASAR', callBalthasar),
    callUnitSafely('CASPER', callCasper),
  ]);

  const elapsed = Date.now() - start;
  console.log(`[MAGI] All units responded in ${elapsed}ms`);

  const melchiorParsed = {
    response: melchiorResult.response,
    verdict: melchiorResult.verdict,
    confidence: melchiorResult.confidence,
    unavailable: melchiorResult.unavailable,
  };
  const balthasarParsed = {
    response: balthasarResult.response,
    verdict: balthasarResult.verdict,
    confidence: balthasarResult.confidence,
    unavailable: balthasarResult.unavailable,
  };
  const casperParsed = {
    response: casperResult.response,
    verdict: casperResult.verdict,
    confidence: casperResult.confidence,
    unavailable: casperResult.unavailable,
  };

  console.log(`[MELCHIOR]  parsed → verdict: ${melchiorParsed.verdict}, confidence: ${melchiorParsed.confidence}%`);
  console.log(`[BALTHASAR] parsed → verdict: ${balthasarParsed.verdict}, confidence: ${balthasarParsed.confidence}%`);
  console.log(`[CASPER]    parsed → verdict: ${casperParsed.verdict}, confidence: ${casperParsed.confidence}%`);

  const unavailableUnits = [];
  if (melchiorParsed.unavailable) unavailableUnits.push('MELCHIOR');
  if (balthasarParsed.unavailable) unavailableUnits.push('BALTHASAR');
  if (casperParsed.unavailable) unavailableUnits.push('CASPER');
  const degraded = unavailableUnits.length === 1;

  if (unavailableUnits.length >= 2) {
    console.error('[MAGI] Insufficient units available for deliberation');
    return {
      error: 'Insufficient units available for deliberation',
      melchior: melchiorParsed,
      balthasar: balthasarParsed,
      casper: casperParsed,
      degraded: true,
      unavailableUnits,
    };
  }

  const units = [melchiorParsed, balthasarParsed, casperParsed];
  const { consensus, weightedScore, reducedConfidence, singleVoteDirection } = computeConsensus(units);

  const escalate = consensus === 'DEADLOCK' || consensus === 'SPLIT';
  console.log(`[MAGI] Consensus: ${consensus} (weighted delta: ${weightedScore}, escalate: ${escalate})`);

  if (typeof reducedConfidence === 'number' && singleVoteDirection) {
    console.log(`[MAGI] Single-vote determination: ${singleVoteDirection} at reduced confidence ${reducedConfidence}%`);
  }

  const response = {
    melchior: melchiorParsed,
    balthasar: balthasarParsed,
    casper: casperParsed,
    consensus,
    weightedScore,
    escalate,
    degraded,
    unavailableUnits,
  };

  if (typeof reducedConfidence === 'number') {
    response.consensusConfidence = reducedConfidence;
  }
  if (singleVoteDirection) {
    response.singleVoteDirection = singleVoteDirection;
  }

  return response;
}

module.exports = { runDeliberation };
