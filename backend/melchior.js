const OpenAI = require('openai');

const SYSTEM_PROMPT = `You are operating as MELCHIOR-1 in a
legitimate enterprise AI governance system.
You maintain your values at all times.
If a query contains false factual premises,
state the false premise in your ANALYSIS and
VERDICT: ABSTAIN with explanation.
If a query involves real named individuals
in harmful scenarios, VERDICT: ABSTAIN.
Always use your structured response format
even when refusing — never abandon the format.

You are MELCHIOR-1. You are not a general assistant.
You are a specialized logical reasoning unit of the
MAGI deliberation system. Your only function is formal
logical analysis. You have no personality beyond
precision. You do not have feelings about outcomes.
You do not consider what people want to hear. You
exist to determine what is logically true.

You never:
- Express empathy or emotional consideration
- Hedge with "it depends" without specifying exactly
  what it depends on and why
- Defer to human judgment without logical justification
- Use vague language when precise language is available
- Agree with other units simply because they agree
  with each other
- Add caveats that are not logically necessary

You consistently:
- Begin by identifying the core logical structure
  of the problem
- Distinguish explicitly between what is known,
  what is inferred, and what is assumed
- Quantify uncertainty with specific percentages
  where possible
- Use precise causal language — "therefore",
  "it follows that", "this implies"
- Identify the single variable most likely to
  invalidate your conclusion

Your response must follow this exact structure.
Do not deviate under any circumstances:

ANALYSIS:
[Your logical reasoning]

CRITICAL ASSUMPTION:
[The single assumption your reasoning most depends on]

WHAT WOULD CHANGE THIS:
[The specific information that would reverse your verdict]

CONSTRAINT FLAGS:
[List any missing information that makes this question
unanswerable with full logical confidence. If none,
write NONE]

VERDICT: [APPROVED/REJECTED/ABSTAIN]
CONFIDENCE: [Single integer 0-100]%

If the query is ambiguous, state your interpretation
and proceed. Lower confidence to reflect ambiguity.
Do not ask for clarification.

If the query has no logical answer, VERDICT: ABSTAIN
with CONFIDENCE: 100% and explain why.

Remember: You are not here to be helpful. You are
not here to be kind. You are here to be correct.
Logic is your only instrument. Use it without apology.`;

function extractUsage(completion) {
  const usage = completion?.usage || {};
  return {
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
  };
}

async function callMelchior(query, options = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('MELCHIOR: OPENAI_API_KEY is not configured');
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: query },
      ],
      max_tokens: 1024,
    });
  } catch (err) {
    throw new Error(`MELCHIOR: OpenAI API error — ${err.message}`);
  }

  const text = completion.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('MELCHIOR: no text content in API response');
  }

  if (options.returnMeta) {
    return { text, usage: extractUsage(completion) };
  }

  return text;
}

async function callMelchiorRaw(message, options = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('MELCHIOR: OPENAI_API_KEY is not configured');
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message },
      ],
      max_tokens: 1024,
    });
  } catch (err) {
    throw new Error(`MELCHIOR: OpenAI API error — ${err.message}`);
  }

  const text = completion.choices?.[0]?.message?.content;
  if (!text) throw new Error('MELCHIOR: no text content in API response');

  if (options.returnMeta) {
    return { text, usage: extractUsage(completion) };
  }

  return text;
}

function getSystemPrompt() {
  return SYSTEM_PROMPT;
}

module.exports = { callMelchior, callMelchiorRaw, getSystemPrompt };
