export const viewLabel = count => Number.isSafeInteger(count) && count >= 0
  ? `${count.toLocaleString()} ${count === 1 ? 'view' : 'views'}` : 'Views unavailable';

export function observeProjectViews() {
  if (!('IntersectionObserver' in window)) return;
  const cards = [...document.querySelectorAll('[data-project-id]')];
  const visible = new Set(), timers = new Map(), attempted = new Set();
  const cancel = card => { clearTimeout(timers.get(card)); timers.delete(card); };
  const schedule = card => {
    const id = card.dataset.projectId;
    if (document.hidden || card.hidden || attempted.has(id) || timers.has(card)) return;
    timers.set(card, setTimeout(async () => {
      timers.delete(card);
      if (document.hidden || card.hidden || !visible.has(card) || attempted.has(id)) return;
      attempted.add(id);
      try {
        const response = await fetch(`/api/project-views?id=${encodeURIComponent(id)}`, {
          method: 'POST', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) return;
        const { views } = await response.json();
        if (!Number.isSafeInteger(views) || views < 0) return;
        for (const label of document.querySelectorAll('[data-project-views]')) {
          if (label.dataset.projectViews === id) label.textContent = viewLabel(views);
        }
      } catch { /* Keep the existing count and project links usable. */ }
    }, 1000));
  };
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) { visible.add(entry.target); schedule(entry.target); }
      else { visible.delete(entry.target); cancel(entry.target); }
    }
  }, { threshold: [0, 0.5] });
  cards.forEach(card => observer.observe(card));
  document.addEventListener('visibilitychange', () => {
    for (const card of visible) document.hidden ? cancel(card) : schedule(card);
  });
}
