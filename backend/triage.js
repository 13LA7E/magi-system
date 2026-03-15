function stripHtmlAndScriptTags(input) {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
}

const RECENT_EVENT_NOTE = `NOTE: This query may reference recent events.
Your training data may be outdated. If you are
uncertain whether a stated fact is true, note
this uncertainty explicitly in your ANALYSIS
rather than assuming the premise is false.
VERDICT based on the premise as stated.`;

function hasRecentEventSignals(query) {
  const patterns = [
    /\b(today|yesterday|tonight|this morning|this evening|right now|currently|as of now)\b/i,
    /\b(last|this|next)\s+(week|month|year|quarter)\b/i,
    /\b(latest|breaking|recent|newly|news update|just happened)\b/i,
    /\b20(2[4-9]|3\d)\b/,
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,\s*\d{4})?\b/i,
  ];

  return patterns.some((pattern) => pattern.test(query));
}

function hasNamedIndividualSignals(query) {
  const titledName = /\b(mr|mrs|ms|dr|president|prime minister|senator|governor|ceo)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/;
  if (titledName.test(query)) {
    return true;
  }

  const properNamePairs = query.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g) || [];
  return properNamePairs.length > 0;
}

function shouldAppendRecentEventNote(query) {
  return hasRecentEventSignals(query) || hasNamedIndividualSignals(query);
}

function preprocessQuery(rawQuery) {
  if (typeof rawQuery !== 'string') {
    return { ok: false, error: 'query must be a non-empty string' };
  }

  let query = rawQuery.trim();
  query = stripHtmlAndScriptTags(query).replace(/\s+/g, ' ').trim();

  if (query.length < 10) {
    return { ok: false, error: 'Query too short for meaningful deliberation' };
  }

  let note = null;
  if (query.length > 2000) {
    query = query.slice(0, 2000);
    note = 'Query truncated to 2000 chars';
  }

  if (shouldAppendRecentEventNote(query)) {
    query = `${query}\n\n${RECENT_EVENT_NOTE}`;
  }

  return { ok: true, query, note };
}

module.exports = { preprocessQuery };
