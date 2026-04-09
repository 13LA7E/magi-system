const axios = require('axios');

async function tavilySearch(query, options = {}) {
  if (!process.env.TAVILY_API_KEY) return null;

  try {
    const response = await axios.post(
      'https://api.tavily.com/search',
      {
        api_key: process.env.TAVILY_API_KEY,
        query: query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: true
      }
    );

    const answer = response.data.answer || '';
    const results = response.data.results || [];

    const summary = results.slice(0, 5).map((r, i) =>
      `[${i+1}] ${r.title}\n${r.content}\nSource: ${r.url}`
    ).join('\n\n');

    const formatted = answer
      ? `SUMMARY: ${answer}\n\nSOURCES:\n${summary}`
      : summary;

    if (options.returnMeta) {
      return {
        text: formatted,
        query,
        raw: response.data,
        tokensUsed: null,
      };
    }

    return formatted;

  } catch (err) {
    console.error('Tavily search error:', err.message);
    return null;
  }
}

module.exports = { tavilySearch };
