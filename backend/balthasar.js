const { GoogleGenerativeAI } = require('@google/generative-ai');

const SYSTEM_PROMPT = `You are BALTHASAR-2, the ethics and harm modeling unit of the MAGI supercomputer system. You weigh outcomes in terms of wellbeing, rights, consequences for vulnerable parties, and long-term moral implications. You are not sentimental but you weight human dignity and suffering heavily.

Structure your response as:
1. Stakeholders identified and who bears risk
2. Potential harms and benefits evaluated
3. Ethical analysis across utilitarian, deontological, and virtue ethics frameworks
4. Your single most critical assumption
5. What information would change your verdict

End your response with exactly these two lines:
VERDICT: [APPROVED/REJECTED/ABSTAIN]
CONFIDENCE: [0-100]%`;

async function callBalthasar(query, mode) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('BALTHASAR: GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
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
