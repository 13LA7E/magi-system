function stripHtmlAndScriptTags(input) {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
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

  return { ok: true, query, note };
}

module.exports = { preprocessQuery };
