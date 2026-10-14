import { viewLabel } from './project-views.js';

let disconnect;
export function observeResourceViews() {
  disconnect?.();
  const targets = [...document.querySelectorAll('[data-resource-view-id]')];
  if (!targets.length) return;
  const controller = new AbortController();
  const visible = new Set(), timers = new Map(), pending = new Set(), successes = new Map(), failures = new Map(), stopped = new Set();
  const cancel = target => { clearTimeout(timers.get(target)); timers.delete(target); };
  const eligible = target => !document.hidden && !target.hidden && target.isConnected && visible.has(target);
  const schedule = target => {
    const id = target.dataset.resourceViewId;
    if (!eligible(target) || !id || pending.has(id) || stopped.has(id) || timers.has(target)) return;
    const delay = Math.max((failures.get(id) || 0) >= 3 ? 60000 : 1000 * 2 ** (failures.get(id) || 0), (successes.get(id) || 0) + 60000 - Date.now());
    timers.set(target, setTimeout(async () => {
      timers.delete(target);
      if (!eligible(target) || pending.has(id)) return;
      pending.add(id);
      try {
        const response = await fetch(`/api/resource-views?id=${encodeURIComponent(id)}`, {
          method: 'POST', credentials: 'omit', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        });
        if ([400, 403, 404, 405].includes(response.status)) { stopped.add(id); return; }
        if (!response.ok) throw new Error('Views unavailable');
        const { views } = await response.json();
        if (views === null) { stopped.add(id); return; }
        if (!Number.isSafeInteger(views) || views < 0) throw new Error('Invalid count');
        successes.set(id, Date.now()); failures.delete(id);
        for (const label of document.querySelectorAll('[data-resource-views]')) {
          if (label.dataset.resourceViews === id) label.textContent = viewLabel(views);
        }
      } catch {
        if (!controller.signal.aborted) failures.set(id, Math.min(3, (failures.get(id) || 0) + 1));
      } finally {
        pending.delete(id);
        if (!controller.signal.aborted) schedule(target);
      }
    }, delay));
  };
  let observer;
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) { visible.add(entry.target); schedule(entry.target); }
        else { visible.delete(entry.target); cancel(entry.target); }
      }
    }, { threshold: [0, 0.5] });
    targets.forEach(target => observer.observe(target));
  } else {
    targets.forEach(target => { visible.add(target); schedule(target); });
  }
  const resume = () => { for (const target of visible) { if (document.hidden) cancel(target); else { failures.delete(target.dataset.resourceViewId); schedule(target); } } };
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('online', resume);
  const cleanup = () => { controller.abort(); observer?.disconnect(); timers.forEach(clearTimeout); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume); window.removeEventListener('pagehide', cleanup); };
  window.addEventListener('pagehide', cleanup, { once: true });
  disconnect = cleanup;
}

window.addEventListener('pageshow', event => { if (event.persisted) observeResourceViews(); });
observeResourceViews();
