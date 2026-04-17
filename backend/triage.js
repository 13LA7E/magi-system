const CURRENT_EVENTS_PATTERNS = [
  /\b(war|conflict|invasion|attack|coup|sanction|treaty|election|protest|revolution|crisis)\b/i,
  /\b(stock|market|inflation|recession|GDP|interest rate|crypto|bitcoin|oil price|trade war|tariff)\b/i,
  /\b[A-Z][a-z]{2,}\s[A-Z][a-z]{2,}\b/,
  /\b(Iran|Israel|Gaza|Ukraine|Russia|China|Taiwan|North Korea|Sudan|Syria|Yemen|Middle East|EU|NATO)\b/i,
  /\b(current|latest|recent|now|today|this week|this month|this year|2025|2026|ongoing|happening|just|breaking)\b/i,
  /\b(trend|viral|movement|protest|demographic|poll|survey|report)\b/i,
  /\b(earnings|IPO|acquisition|merger|layoffs|regulation|ban|lawsuit|ruling)\b/i
];

const PERSONAL_PATTERNS = [
  /\b(should I|should we|my|our|personally|for me|in my case|my situation)\b/i,
  /\b(ethical|moral|right|wrong|good|bad|justify|justified)\b/i,
  /\b(hypothetical|imagine|suppose|what if|trolley|scenario)\b/i
];

function classifyQuery(query) {
  const isPersonal = PERSONAL_PATTERNS
    .some(p => p.test(query));
  const needsCurrent = CURRENT_EVENTS_PATTERNS
    .some(p => p.test(query));
  if (isPersonal && !needsCurrent) return 'PERSONAL';
  if (needsCurrent) return 'CURRENT';
  return 'FACTUAL';
}

function preprocessQuery(query) {
  if (!query || typeof query !== 'string') {
    return { error: 'Invalid query' };
  }
  const trimmed = query.trim();
  const clean = trimmed
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 2000);
  if (clean.length < 10) {
    return { error: 'Query too short for meaningful deliberation' };
  }
  const note = trimmed.length > 2000 ? 'Query truncated to 2000 chars' : null;
  const classification = classifyQuery(clean);
  return { query: clean, note, classification };
}

module.exports = { preprocessQuery, classifyQuery };
