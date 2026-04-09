const { tavilySearch } = require('./search');
const Anthropic = require('@anthropic-ai/sdk');

async function formCollaborativeSearchQuery(query) {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Three AI units are about to deliberate 
on this query: "${query}"

MELCHIOR needs: logical facts, statistics, verified outcomes
BALTHASAR needs: stakeholder impacts, harm data, precedents
CASPER needs: trends, patterns, unexpected angles

Generate ONE optimal web search query satisfying 
all three units needs.
Respond with ONLY the search query string.
Maximum 10 words. Make it specific and current.`
    }]
  });
  const searchQuery = message.content
    .find(b => b.type === 'text')?.text?.trim() || query;
  const usage = message?.usage || {};
  const usageTokens = {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
  };
  console.log(`Collaborative search query: "${searchQuery}"`);
  return { searchQuery, usageTokens, raw: message };
}

async function getSearchContext(query, classification) {
  if (classification !== 'CURRENT') {
    return {
      searchUsed: false,
      searchQuery: null,
      searchContext: null,
      tavilyResponse: null,
      tokensUsed: null,
      elapsedMs: 0,
    };
  }

  const start = Date.now();
  const collaboration = await formCollaborativeSearchQuery(query);
  const searchQuery = collaboration?.searchQuery;
  if (!searchQuery) {
    return {
      searchUsed: false,
      searchQuery: null,
      searchContext: null,
      tavilyResponse: null,
      tokensUsed: collaboration?.usageTokens || null,
      elapsedMs: Date.now() - start,
    };
  }

  const tavily = await tavilySearch(searchQuery, { returnMeta: true });
  const searchContext = tavily?.text || null;
  return {
    searchUsed: !!searchContext,
    searchQuery,
    searchContext,
    tavilyResponse: tavily?.raw || null,
    tokensUsed: collaboration?.usageTokens || null,
    elapsedMs: Date.now() - start,
  };
}

module.exports = { getSearchContext, formCollaborativeSearchQuery };
