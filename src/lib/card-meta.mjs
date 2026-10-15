export function formatCardDate(value, full = false) {
  if (!value) return '';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', ...(full ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(date);
}

export const categoryIcon = category => ({
  'Technology & AI': 'cpu', 'Markets & Investing': 'chart', 'Tools & Security': 'tool',
  'Design & UX': 'tool', 'Creator Growth': 'chart', 'Digital Products': 'layers',
  'AI': 'cpu', 'Apps': 'layers', 'Design': 'tool', 'Business': 'chart',
}[category] || 'book');

export function resourceStats({ date, readingTime, views = 0, id, slug, packet, fullDate = false }) {
  const items = [];
  if (packet) {
    items.push({ icon: 'layers', text: '75 prompts', label: '75 prompts in the full packet' }, { icon: 'sparkle', text: '3 free', label: '3 free prompts to try' });
  } else {
    if (formatCardDate(date)) items.push({ icon: 'calendar', text: formatCardDate(date, fullDate), label: formatCardDate(date, true), datetime: date });
    if (readingTime) items.push({ icon: 'clock', text: `${readingTime} min`, label: `${readingTime} minute read` });
  }
  items.push({ icon: 'eye', text: Number.isSafeInteger(views) && views >= 0 ? `${views.toLocaleString('en-US')} ${views === 1 ? 'view' : 'views'}` : 'Unavailable', label: 'Approximate views. Repeat views from the same network count once every 24 hours.', viewId: id || slug });
  return items;
}
