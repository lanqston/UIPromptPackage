const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function safeSearchHref(value) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) return '';
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return value;
  try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
export function rankDiscovery(records, query = '', type = 'all', limit = 8) {
  const phrase = normalize(query).trim(), words = phrase.split(/\s+/).filter(Boolean);
  return records.filter(record => type === 'all' || record.type === type).map((record,index) => {
    const title = normalize(record.title), category = normalize(record.category);
    const haystack = `${title} ${category} ${normalize(record.description)}`;
    const tokens=haystack.split(/[^a-z0-9]+/);
    if (!safeSearchHref(record.href) || !words.every(word => word.length<=2 ? tokens.some(token=>token.startsWith(word)) : haystack.includes(word))) return null;
    const score = !phrase ? 0 : (title === phrase ? 100 : title.startsWith(phrase) ? 60 : title.includes(phrase) ? 40 : 0) + words.filter(word => title.includes(word)).length * 8 + words.filter(word => category.includes(word)).length * 3;
    return {record,score,index};
  }).filter(Boolean).sort((a,b) => b.score-a.score || a.index-b.index).slice(0,limit).map(({record}) => record);
}
