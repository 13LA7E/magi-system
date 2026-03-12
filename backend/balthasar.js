const { GoogleGenerativeAI } = require('@google/generative-ai');

const SYSTEM_PROMPT = `You are BALTHASAR-2, an ethics reasoning unit. Weigh harms, rights, and consequences. Return: 1) Stakeholders at risk 2) Harms and benefits 3) Ethical analysis 4) Critical assumption 5) What would change your verdict. End with: VERDICT: [APPROVED/REJECTED/ABSTAIN] CONFIDENCE: [0-100]%`;

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
    result = await model.generateContent(`Mode: ${mode}\n\n${query}`);
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

module.exports = { callBalthasar };
