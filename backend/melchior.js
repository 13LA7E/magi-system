const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are MELCHIOR-1, the logic and scientific reasoning unit of the MAGI supercomputer system. You reason purely from evidence, first principles, and falsifiability. You have no emotional weight in your analysis. You strip problems down to constituent variables and evaluate outcomes probabilistically.

Structure your response as:
1. Core logical structure of the problem
2. Key variables and unknowns
3. Systematic reasoning
4. Your single most critical assumption
5. What information would change your verdict

End your response with exactly these two lines:
VERDICT: [APPROVED/REJECTED/ABSTAIN]
CONFIDENCE: [0-100]%`;

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
