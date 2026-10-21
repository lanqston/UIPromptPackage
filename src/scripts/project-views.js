export const viewLabel = count => Number.isSafeInteger(count) && count >= 0
  ? `${count.toLocaleString()} ${count === 1 ? 'view' : 'views'}` : 'Views unavailable';

let disconnect;
export function observeProjectViews() {
  disconnect?.();
  if (!('IntersectionObserver' in window)) return;
  const cards = [...document.querySelectorAll('[data-project-id]')];
  const visible = new Set(), timers = new Map(), pending = new Set(), lastSuccess = new Map(), failures = new Map(), stopped = new Set();
  const controller = new AbortController();
  const cancel = card => { clearTimeout(timers.get(card)); timers.delete(card); };
  const eligible = card => !document.hidden && !card.hidden && card.isConnected && visible.has(card);
  const schedule = card => {
    const id = card.dataset.projectId;
    if (!eligible(card) || pending.has(id) || stopped.has(id) || timers.has(card)) return;
    const wait = Math.max((failures.get(id) || 0) >= 3 ? 60000 : 1000 * 2 ** (failures.get(id) || 0), (lastSuccess.get(id) || 0) + 60000 - Date.now());
    timers.set(card, setTimeout(async () => {
      timers.delete(card);
      if (!eligible(card) || pending.has(id)) return;
      pending.add(id);
      try {
        const response = await fetch(`/api/project-views?id=${encodeURIComponent(id)}`, {
          method: 'POST', credentials: 'omit', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        });
        if ([400,403,404,405].includes(response.status)) { stopped.add(id); return; }
        if (!response.ok) throw new Error('Views unavailable');
        const { views } = await response.json();
        if (views === null) { stopped.add(id); return; } // Bot traffic is intentionally excluded.
        if (!Number.isSafeInteger(views) || views < 0) throw new Error('Invalid count');
        lastSuccess.set(id, Date.now()); failures.delete(id);
        for (const label of document.querySelectorAll('[data-project-views]')) {
          if (label.dataset.projectViews === id) label.textContent = viewLabel(views);
        }
        for (const card of cards) {
          if (card.dataset.projectId === id) card.dataset.projectViewsTotal = String(views);
        }
      } catch {
        if (!controller.signal.aborted) failures.set(id, Math.min(3, (failures.get(id) || 0) + 1));
        // Preserve the last known count; retry transient errors with a bounded backoff.
      } finally {
        pending.delete(id);
        if (!controller.signal.aborted) schedule(card);
      }
    }, wait));
  };
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) { visible.add(entry.target); schedule(entry.target); }
      else { visible.delete(entry.target); cancel(entry.target); }
    }
  }, { threshold: [0, 0.5] });
  cards.forEach(card => observer.observe(card));
  const resume = () => { for (const card of visible) { if(document.hidden) cancel(card); else { failures.delete(card.dataset.projectId); schedule(card); } } };
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('online', resume);
  const cleanup = () => { controller.abort(); observer.disconnect(); timers.forEach(clearTimeout); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume); window.removeEventListener('pagehide', cleanup); };
  window.addEventListener('pagehide', cleanup, { once:true });
  disconnect = cleanup;
}
// A restored back/forward-cache page needs observers again after pagehide cleanup.
window.addEventListener('pageshow', event => { if(event.persisted) observeProjectViews(); });
