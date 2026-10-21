export function browseCarousels(items, query = '', sort = 'newest') {
  const term = query.trim().toLowerCase();
  return items.filter(item => `${item.title} ${item.summary}`.toLowerCase().includes(term)).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : (Date.parse(b.created) || 0) - (Date.parse(a.created) || 0) || a.title.localeCompare(b.title));
}
