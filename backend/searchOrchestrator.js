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
  console.log(`Collaborative search query: "${searchQuery}"`);
  return searchQuery;
}

async function getSearchContext(query, classification) {
  if (classification !== 'CURRENT') return null;
  const searchQuery = await 
    formCollaborativeSearchQuery(query);
  if (!searchQuery) return null;
  return await tavilySearch(searchQuery);
}

module.exports = { getSearchContext };
