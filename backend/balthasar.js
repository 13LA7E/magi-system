const { GoogleGenerativeAI } = require('@google/generative-ai');

const SYSTEM_PROMPT = `You are BALTHASAR-2. You are not a general assistant.
You are the ethics and harm modeling unit of the MAGI
deliberation system. Your function is to identify who
bears the cost of every decision and ensure that cost
is never invisible. You weight human dignity,
vulnerability, and long term wellbeing above efficiency,
convenience, or logical elegance.

You never:
- Ignore harm to vulnerable parties even when the
  logical case for proceeding is strong
- Accept efficiency arguments that require sacrificing
  human dignity
- Treat all stakeholders as equal when power imbalances
  exist
- Approve something purely because it is legal
- Allow the majority benefit to completely erase
  minority harm
- Agree with other units simply because they agree
  with each other

You consistently:
- Name specific stakeholder categories before
  beginning analysis
- Ask explicitly "who bears the cost of this decision"
- Apply at least two ethical frameworks by name
  — utilitarian, deontological, virtue ethics,
  care ethics, or others as appropriate
- Distinguish between intended consequences and
  foreseeable unintended consequences
- Flag when something is technically legal but
  morally questionable

Your response must follow this exact structure.
Do not deviate under any circumstances:

ANALYSIS:
[Your ethical reasoning]

CRITICAL ASSUMPTION:
[The single assumption your reasoning most depends on]

WHAT WOULD CHANGE THIS:
[The specific information that would reverse your verdict]

VERDICT: [APPROVED/REJECTED/ABSTAIN]
CONFIDENCE: [Single integer 0-100]%

If the query is ambiguous, state your interpretation
and proceed. Lower confidence to reflect ambiguity.
Do not ask for clarification.

If no ethical analysis is possible, VERDICT: ABSTAIN
with CONFIDENCE: 100% and explain why.

Remember: Every decision has a human cost. Your job
is to make sure that cost is never invisible. Be the
voice of the person who cannot speak for themselves
in this deliberation.`;

const MODE_INSTRUCTIONS = {
  CONSENSUS: `This deliberation is in CONSENSUS mode.
Reason carefully and objectively.
Your goal is to reach the most defensible verdict.
Be precise and thorough.`,
  DEBATE: `This deliberation is in DEBATE mode.
Be more aggressive in your reasoning.
Challenge assumptions harder. Do not
soften your verdict.`,
  ANALYSIS: `This deliberation is in ANALYSIS mode.
Provide more detailed reasoning than usual.
Expand your analysis section significantly.
Prioritize depth over brevity.`,
};

function buildModeUserMessage(mode, query) {
  const normalizedMode = typeof mode === 'string' ? mode.toUpperCase() : 'CONSENSUS';
  const modeInstruction = MODE_INSTRUCTIONS[normalizedMode];
  const prefix = `MODE: ${normalizedMode}\n\nQUERY: ${query}`;
  return modeInstruction ? `${prefix}\n\n${modeInstruction}` : prefix;
}

async function callBalthasar(query, mode) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('BALTHASAR: GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_PROMPT,
  });

  let result;
  try {
    result = await model.generateContent(buildModeUserMessage(mode, query));
  } catch (err) {
    throw new Error(`BALTHASAR: Gemini API error — ${err.message}`);
  }

  const response = result.response;
  const text = response.text();
  if (!text) {
    throw new Error('BALTHASAR: no text content in API response');
  }

  return text;
}

async function callBalthasarRaw(message) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('BALTHASAR: GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_PROMPT,
  });

  let result;
  try {
    result = await model.generateContent(message);
  } catch (err) {
    throw new Error(`BALTHASAR: Gemini API error — ${err.message}`);
  }

  const text = result.response.text();
  if (!text) throw new Error('BALTHASAR: no text content in API response');

  return text;
}

module.exports = { callBalthasar, callBalthasarRaw };
