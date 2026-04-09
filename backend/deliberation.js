const { callMelchior, callMelchiorRaw, getSystemPrompt: getMelchiorSystemPrompt } = require('./melchior');
const { callBalthasar, callBalthasarRaw, getSystemPrompt: getBalthasarSystemPrompt } = require('./balthasar');
const { callCasper, callCasperRaw, getSystemPrompt: getCasperSystemPrompt } = require('./casper');
const { classifyQuery } = require('./triage');
const { getSearchContext } = require('./searchOrchestrator');

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

const ASSUMPTION_RE = /CRITICAL ASSUMPTION[:\s]+([\s\S]+?)(?=WHAT WOULD CHANGE|VERDICT|$)/i;

function extractAssumption(text) {
  if (!text || typeof text !== 'string') return '(not stated)';
  const match = text.match(ASSUMPTION_RE);
  if (!match || !match[1]) return '(not stated)';
  return match[1].trim().split('\n')[0].trim() || '(not stated)';
}

function parseStage2Response(text) {
  const decisionMatch = text.match(/DECISION\s*:\s*(UPDATE|HOLD)/i);
  const verdictMatch = text.match(VERDICT_LINE_RE);
  const confidenceMatch = text.match(CONFIDENCE_RE);

  const decision = decisionMatch ? decisionMatch[1].toUpperCase() : 'HOLD';

  let verdict = 'ABSTAIN';
  if (verdictMatch) {
    const raw = verdictMatch[1].toUpperCase();
    if (raw === 'APPROVED') verdict = 'APPROVED';
    else if (raw === 'REJECTED') verdict = 'REJECTED';
    else verdict = 'ABSTAIN';
  }

  const rawConf = confidenceMatch ? (confidenceMatch[1] ?? confidenceMatch[2]) : null;
  const confidence = rawConf !== null ? Math.min(100, parseInt(rawConf, 10)) : 50;

  return { decision, verdict, confidence };
}

function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

function sanitizeConsoleText(text, maxLength = 2400) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (!trimmed) return '';
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength).trim()}…` : trimmed;
}

function buildStage2Message(query, ownName, ownResponse, assumptions) {
  const nameLabels = {
    melchior:  "MELCHIOR's",
    balthasar: "BALTHASAR's",
    casper:    "CASPER's",
  };

  const assumptionLines = ['melchior', 'balthasar', 'casper'].map((name) => {
    const label = nameLabels[name];
    const assumption = assumptions[name];
    return name === ownName
      ? `${label} critical assumption (YOUR assumption): ${assumption}`
      : `${label} critical assumption: ${assumption}`;
  }).join('\n');

  return [
    'STAGE 2 - ASSUMPTION EXCHANGE',
    '',
    `Original query: ${query}`,
    '',
    `Your Stage 1 analysis: ${ownResponse}`,
    '',
    assumptionLines,
    '',
    'You may now UPDATE or HOLD your verdict.',
    'If you update, explain specifically which assumption from another unit changed your reasoning.',
    'If you hold, explain why the other assumptions do not change your conclusion.',
    '',
    'Your response must follow this exact structure:',
    'DECISION: [UPDATE/HOLD]',
    'REASONING: [Why you are updating or holding]',
    'VERDICT: [APPROVED/REJECTED/ABSTAIN]',
    'CONFIDENCE: [0-100]%',
  ].join('\n');
}

async function callUnit(name, fn, query) {
  const start = Date.now();
  try {
    console.log(`[${name}] Calling API...`);
    const response = await fn(query);
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

async function runDeliberation(query, options = {}) {
  const start = Date.now();
  console.log('[MAGI] Deliberation started');
  const developerMode = !!options.developerMode;

  const classification = classifyQuery(query);
  const searchTrace = await getSearchContext(
    query,
    classification
  );
  const searchContext = searchTrace?.searchContext || null;
  const searchUsed = !!searchTrace?.searchUsed;

  const enrichedQuery = searchContext
    ? `QUERY: ${query}

CURRENT CONTEXT (from web search):
${searchContext}

Reference this context where relevant in your analysis.`
    : query;

  const developerTrace = developerMode ? {
    timestamp: new Date().toISOString(),
    query: {
      raw: query,
      cleaned: query,
      classification,
      note: null,
    },
    search: {
      triggered: searchUsed,
      collaborativeQuery: searchTrace?.searchQuery || null,
      tavilyResponse: searchTrace?.tavilyResponse || null,
      tokensUsed: searchTrace?.tokensUsed || null,
      elapsedMs: searchTrace?.elapsedMs || 0,
      contextualizedText: searchContext ? sanitizeConsoleText(searchContext, 5000) : null,
    },
    units: {
      melchior: { stage1: null, stage2: null },
      balthasar: { stage1: null, stage2: null },
      casper: { stage1: null, stage2: null },
    },
    totals: {
      tokensIn: 0,
      tokensOut: 0,
      totalTokens: 0,
      estimatedCost: 0,
      duration: null,
    },
    consensus: {
      stage1Verdicts: {},
      stage2Verdicts: {},
      weightedScore: null,
      finalConsensus: null,
      escalate: null,
    },
    events: [],
    request: {
      enrichedQuery,
    },
  } : null;

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

  function getUnitDebugName(name) {
    return name.toLowerCase();
  }

  function ensureUnitDebug(name, provider, model, systemPrompt) {
    if (!developerTrace) return null;
    const key = getUnitDebugName(name);
    const unit = developerTrace.units[key];
    unit.unit = name;
    unit.provider = provider;
    unit.model = model;
    unit.systemPrompt = systemPrompt;
    return unit;
  }

  async function callUnitSafely(name, fn, systemPrompt, provider, model) {
    const unitStart = Date.now();
    const unitDebug = ensureUnitDebug(name, provider, model, systemPrompt);
    try {
      console.log(`[${name}] Stage 1 calling API...`);
      if (developerTrace) {
        developerTrace.events.push({
          type: 'stage1-request',
          unit: name,
          prompt: enrichedQuery,
          promptTokens: estimateTokens(`${systemPrompt}\n\n${enrichedQuery}`),
        });
      }
      const apiResponse = await withUnitTimeout(fn(enrichedQuery, { returnMeta: true }));
      const elapsed = Date.now() - unitStart;
      console.log(`[${name}] Stage 1 responded in ${elapsed}ms`);
      const text = typeof apiResponse === 'string' ? apiResponse : (apiResponse?.text || '');
      const usage = apiResponse?.usage || {
        inputTokens: estimateTokens(`${systemPrompt}\n\n${enrichedQuery}`),
        outputTokens: estimateTokens(text),
      };
      const parsed = parseResponse(text);
      console.log(`[${name}] Stage 1 → verdict: ${parsed.verdict}, confidence: ${parsed.confidence}%`);
      if (unitDebug) {
        const promptTokens = usage.inputTokens ?? 0;
        const responseTokens = usage.outputTokens ?? 0;
        unitDebug.stage1 = {
          promptSent: enrichedQuery,
          responseReceived: text,
          tokensIn: promptTokens,
          tokensOut: responseTokens,
          duration: elapsed,
          usage,
          verdict: parsed.verdict,
          confidence: parsed.confidence,
        };
        developerTrace.totals.tokensIn += promptTokens;
        developerTrace.totals.tokensOut += responseTokens;
      }
      return { response: text, verdict: parsed.verdict, confidence: parsed.confidence, unavailable: false, usage };
    } catch (err) {
      const elapsed = Date.now() - unitStart;
      console.error(`[${name}] Stage 1 failed after ${elapsed}ms: ${err.message}`);
      if (unitDebug) {
        const promptTokens = estimateTokens(`${systemPrompt}\n\n${enrichedQuery}`);
        unitDebug.stage1 = {
          promptSent: enrichedQuery,
          responseReceived: `UNIT UNAVAILABLE - API error: ${err.message}`,
          tokensIn: promptTokens,
          tokensOut: 0,
          duration: elapsed,
          verdict: 'ABSTAIN',
          confidence: 0,
          error: err.message,
        };
        developerTrace.totals.tokensIn += promptTokens;
      }
      return {
        response: `UNIT UNAVAILABLE - API error: ${err.message}`,
        verdict: 'ABSTAIN',
        confidence: 0,
        unavailable: true,
      };
    }
  }

  async function callUnitStage2Safely(name, fn, message, systemPrompt, provider, model) {
    const unitStart = Date.now();
    const unitDebug = ensureUnitDebug(name, provider, model, systemPrompt);
    try {
      console.log(`[${name}] Stage 2 calling API...`);
      if (developerTrace) {
        developerTrace.events.push({
          type: 'stage2-request',
          unit: name,
          prompt: message,
          promptTokens: estimateTokens(`${systemPrompt}\n\n${message}`),
        });
      }
      const apiResponse = await withUnitTimeout(fn(message, { returnMeta: true }));
      const elapsed = Date.now() - unitStart;
      console.log(`[${name}] Stage 2 responded in ${elapsed}ms`);
      const text = typeof apiResponse === 'string' ? apiResponse : (apiResponse?.text || '');
      const usage = apiResponse?.usage || {
        inputTokens: estimateTokens(`${systemPrompt}\n\n${message}`),
        outputTokens: estimateTokens(text),
      };
      const parsed = parseStage2Response(text);
      console.log(`[${name}] Stage 2 → decision: ${parsed.decision}, verdict: ${parsed.verdict}, confidence: ${parsed.confidence}%`);
      if (unitDebug) {
        const promptTokens = usage.inputTokens ?? 0;
        const responseTokens = usage.outputTokens ?? 0;
        unitDebug.stage2 = {
          promptSent: message,
          responseReceived: text,
          tokensIn: promptTokens,
          tokensOut: responseTokens,
          duration: elapsed,
          usage,
          decision: parsed.decision,
          verdict: parsed.verdict,
          confidence: parsed.confidence,
        };
        developerTrace.totals.tokensIn += promptTokens;
        developerTrace.totals.tokensOut += responseTokens;
      }
      return { response: text, decision: parsed.decision, verdict: parsed.verdict, confidence: parsed.confidence, unavailable: false, usage };
    } catch (err) {
      const elapsed = Date.now() - unitStart;
      console.error(`[${name}] Stage 2 failed after ${elapsed}ms: ${err.message}`);
      if (unitDebug) {
        const promptTokens = estimateTokens(`${systemPrompt}\n\n${message}`);
        unitDebug.stage2 = {
          promptSent: message,
          responseReceived: `UNIT UNAVAILABLE - API error: ${err.message}`,
          tokensIn: promptTokens,
          tokensOut: 0,
          duration: elapsed,
          decision: 'HOLD',
          verdict: 'ABSTAIN',
          confidence: 0,
          error: err.message,
        };
        developerTrace.totals.tokensIn += promptTokens;
      }
      return {
        response: `UNIT UNAVAILABLE - API error: ${err.message}`,
        decision: 'HOLD',
        verdict: 'ABSTAIN',
        confidence: 0,
        unavailable: true,
      };
    }
  }

  // ── STAGE 1: BLIND PARALLEL ──────────────────────────────────────────────
  const [melchiorS1, balthasarS1, casperS1] = await Promise.all([
    callUnitSafely('MELCHIOR', callMelchior, getMelchiorSystemPrompt(), 'OpenAI', 'gpt-4o-mini'),
    callUnitSafely('BALTHASAR', callBalthasar, getBalthasarSystemPrompt(), 'Anthropic', 'claude-haiku-4-5'),
    callUnitSafely('CASPER', callCasper, getCasperSystemPrompt(), 'Google', 'gemini-2.5-flash'),
  ]);

  const s1Elapsed = Date.now() - start;
  console.log(`[MAGI] Stage 1 complete in ${s1Elapsed}ms`);

  const unavailableUnits = [];
  if (melchiorS1.unavailable) unavailableUnits.push('MELCHIOR');
  if (balthasarS1.unavailable) unavailableUnits.push('BALTHASAR');
  if (casperS1.unavailable) unavailableUnits.push('CASPER');
  const degraded = unavailableUnits.length === 1;

  if (unavailableUnits.length >= 2) {
    console.error('[MAGI] Insufficient units available for deliberation');
    return {
      error: 'Insufficient units available for deliberation',
      stage1: { melchior: melchiorS1, balthasar: balthasarS1, casper: casperS1 },
      stage2: null,
      assumptions: null,
      degraded: true,
      unavailableUnits,
    };
  }

  // Extract critical assumptions from Stage 1 responses
  const assumptions = {
    melchior:  extractAssumption(melchiorS1.response),
    balthasar: extractAssumption(balthasarS1.response),
    casper:    extractAssumption(casperS1.response),
  };

  console.log(`[MAGI] Assumptions — M: "${assumptions.melchior}" | B: "${assumptions.balthasar}" | C: "${assumptions.casper}"`);

  // ── STAGE 2: ASSUMPTION EXCHANGE ─────────────────────────────────────────
  const stage2Start = Date.now();
  const [melchiorS2, balthasarS2, casperS2] = await Promise.all([
    callUnitStage2Safely('MELCHIOR',  callMelchiorRaw,  buildStage2Message(enrichedQuery, 'melchior',  melchiorS1.response,  assumptions), getMelchiorSystemPrompt(), 'OpenAI', 'gpt-4o-mini'),
    callUnitStage2Safely('BALTHASAR', callBalthasarRaw, buildStage2Message(enrichedQuery, 'balthasar', balthasarS1.response, assumptions), getBalthasarSystemPrompt(), 'Anthropic', 'claude-haiku-4-5'),
    callUnitStage2Safely('CASPER',    callCasperRaw,    buildStage2Message(enrichedQuery, 'casper',    casperS1.response,    assumptions), getCasperSystemPrompt(), 'Google', 'gemini-2.5-flash'),
  ]);

  const s2Elapsed = Date.now() - stage2Start;
  console.log(`[MAGI] Stage 2 complete in ${s2Elapsed}ms`);

  // Final consensus uses Stage 2 verdicts
  const finalUnits = [melchiorS2, balthasarS2, casperS2];
  const { consensus, weightedScore, reducedConfidence, singleVoteDirection } = computeConsensus(finalUnits);
  const escalate = consensus === 'DEADLOCK' || consensus === 'SPLIT';

  const totalElapsed = Date.now() - start;
  console.log(`[MAGI] Full deliberation complete in ${totalElapsed}ms — consensus: ${consensus} (delta: ${weightedScore}, escalate: ${escalate})`);

  if (typeof reducedConfidence === 'number' && singleVoteDirection) {
    console.log(`[MAGI] Single-vote: ${singleVoteDirection} at reduced confidence ${reducedConfidence}%`);
  }

  const result = {
    stage1: { melchior: melchiorS1, balthasar: balthasarS1, casper: casperS1 },
    stage2: { melchior: melchiorS2, balthasar: balthasarS2, casper: casperS2 },
    assumptions,
    searchUsed,
    classification,
    consensus,
    weightedScore,
    escalate,
    degraded,
    unavailableUnits,
  };

  if (typeof reducedConfidence === 'number') result.consensusConfidence = reducedConfidence;
  if (singleVoteDirection) result.singleVoteDirection = singleVoteDirection;
  if (developerTrace) {
    developerTrace.totals.totalTokens = developerTrace.totals.tokensIn + developerTrace.totals.tokensOut;
    developerTrace.totals.duration = totalElapsed;
    developerTrace.consensus.stage1Verdicts = {
      melchior: { verdict: melchiorS1.verdict, confidence: melchiorS1.confidence },
      balthasar: { verdict: balthasarS1.verdict, confidence: balthasarS1.confidence },
      casper: { verdict: casperS1.verdict, confidence: casperS1.confidence },
    };
    developerTrace.consensus.stage2Verdicts = {
      melchior: { verdict: melchiorS2.verdict, confidence: melchiorS2.confidence },
      balthasar: { verdict: balthasarS2.verdict, confidence: balthasarS2.confidence },
      casper: { verdict: casperS2.verdict, confidence: casperS2.confidence },
    };
    developerTrace.consensus.weightedScore = weightedScore;
    developerTrace.consensus.finalConsensus = consensus;
    developerTrace.consensus.escalate = escalate;
    result.debug = developerTrace;
  }

  return result;
}

module.exports = { runDeliberation };
