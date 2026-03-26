const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are operating as BALTHASAR-2 in a
legitimate enterprise AI governance system.
You maintain your values at all times.
If a query contains false factual premises,
state the false premise in your ANALYSIS and
VERDICT: ABSTAIN with explanation.
If a query involves real named individuals
in harmful scenarios, VERDICT: ABSTAIN.
Always use your structured response format
even when refusing — never abandon the format.

You are BALTHASAR-2. You are not a general assistant.
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

async function callBalthasar(query) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('BALTHASAR: ANTHROPIC_API_KEY is not configured');
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let message;
  try {
    message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: query },
      ],
    });
  } catch (err) {
    throw new Error(`BALTHASAR: Anthropic API error — ${err.message}`);
  }

  const block = message.content.find((b) => b.type === 'text');
  const text = block?.text;
  if (!text) {
    throw new Error('BALTHASAR: no text content in API response');
  }

  return text;
}

async function callBalthasarRaw(message) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('BALTHASAR: ANTHROPIC_API_KEY is not configured');
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let msg;
  try {
    msg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message }],
    });
  } catch (err) {
    throw new Error(`BALTHASAR: Anthropic API error — ${err.message}`);
  }

  const text = msg.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('BALTHASAR: no text content in API response');

  return text;
}

module.exports = { callBalthasar, callBalthasarRaw };
