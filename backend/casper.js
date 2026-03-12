const OpenAI = require('openai');

const SYSTEM_PROMPT = `You are CASPER-3, a lateral thinking unit. Challenge assumptions and surface what others miss. Return: 1) Reframe the question 2) Counterintuitive observations 3) What the other units miss 4) Critical assumption 5) What would change your verdict. End with: VERDICT: [APPROVED/REJECTED/ABSTAIN] CONFIDENCE: [0-100]%`;

async function callCasper(query, mode) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('CASPER: OPENAI_API_KEY is not configured');
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Mode: ${mode}\n\n${query}` },
      ],
      max_tokens: 1024,
    });
  } catch (err) {
    throw new Error(`CASPER: OpenAI API error — ${err.message}`);
  }

  const text = completion.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('CASPER: no text content in API response');
  }

  return text;
}

module.exports = { callCasper };
