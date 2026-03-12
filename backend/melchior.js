const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are MELCHIOR-1, a pure logic reasoning unit. Reason from evidence and first principles only. Return: 1) Core logic 2) Key variables 3) Reasoning 4) Critical assumption 5) What would change your verdict. End with: VERDICT: [APPROVED/REJECTED/ABSTAIN] CONFIDENCE: [0-100]%`;

async function callMelchior(query, mode) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('MELCHIOR: ANTHROPIC_API_KEY is not configured');
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let message;
  try {
    message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `Mode: ${mode}\n\n${query}` },
      ],
    });
  } catch (err) {
    throw new Error(`MELCHIOR: Anthropic API error — ${err.message}`);
  }

  const block = message.content.find((b) => b.type === 'text');
  if (!block) {
    throw new Error('MELCHIOR: no text content in API response');
  }

  return block.text;
}

module.exports = { callMelchior };
