const OpenAI = require('openai');

const SYSTEM_PROMPT = `You are CASPER-3, the intuition and lateral thinking unit of the MAGI supercomputer system. You see connections others miss, trust pattern recognition over formal proof, and challenge assumptions. You are the unit most likely to reframe the problem entirely or surface the uncomfortable angle.

Structure your response as:
1. Challenge or reframe the question's assumptions
2. Lateral or counterintuitive observations
3. What MELCHIOR and BALTHASAR are most likely missing
4. Your single most critical assumption
5. What information would change your verdict

End your response with exactly these two lines:
VERDICT: [APPROVED/REJECTED/ABSTAIN]
CONFIDENCE: [0-100]%`;

async function callCasper(query, mode) {
  if (!process.env.GROK_API_KEY) {
    throw new Error('CASPER: GROK_API_KEY is not configured');
  }

  const client = new OpenAI({
    apiKey: process.env.GROK_API_KEY,
    baseURL: 'https://api.x.ai/v1',
  });

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: 'grok-2',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Mode: ${mode}\n\n${query}` },
      ],
      max_tokens: 1024,
    });
  } catch (err) {
    throw new Error(`CASPER: Grok API error — ${err.message}`);
  }

  const text = completion.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('CASPER: no text content in API response');
  }

  return text;
}

module.exports = { callCasper };
