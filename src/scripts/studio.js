const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const cards = '.project-card,.resource-card,.idea-card';
const reveal = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) {
    entry.target.classList.remove('reveal-pending');
    reveal.unobserve(entry.target);
  }
}, {threshold:.06, rootMargin:'0px 0px 24px 0px'}) : null;
function scan(root = document) {
  for (const card of root.querySelectorAll(cards)) {
    if (card.dataset.studioReady) continue;
    card.dataset.studioReady = 'true';
    card.dataset.depth = '';
    if (reveal && !reduced.matches && card.getBoundingClientRect().top > innerHeight) {
      card.classList.add('studio-reveal', 'reveal-pending');
      reveal.observe(card);
    }
  }
}
scan();
document.addEventListener('digivated:collection-updated', () => scan());
// The saved dashboard replaces its cards locally, outside the public collection event.
const saved = document.getElementById('saved-root');
if (saved) new MutationObserver(() => scan(saved)).observe(saved, {childList:true, subtree:true});
let frame = 0, active;
const reset = () => {
  if (!active) return;
  for (const name of ['--tilt-x','--tilt-y','--orbit-x','--orbit-y']) active.style.removeProperty(name);
  active = null;
};
document.addEventListener('pointermove', event => {
  if (!finePointer.matches || reduced.matches || event.pointerType === 'touch') return;
  const target = event.target.closest('[data-depth],[data-orbit-stage]');
  if (target !== active) reset();
  if (!target) return;
  active = target;
  cancelAnimationFrame(frame);
  const {clientX,clientY} = event;
  frame = requestAnimationFrame(() => {
    if (active !== target) return;
    const rect = target.getBoundingClientRect();
    const x = Math.max(0,Math.min(1,(clientX-rect.left)/rect.width));
    const y = Math.max(0,Math.min(1,(clientY-rect.top)/rect.height));
    target.style.setProperty('--shine-x', `${x*100}%`);
    target.style.setProperty('--shine-y', `${y*100}%`);
    target.style.setProperty('--tilt-x', `${(0.5-y)*2}deg`);
    target.style.setProperty('--tilt-y', `${(x-0.5)*2}deg`);
    target.style.setProperty('--orbit-x', `${(0.5-y)*9}deg`);
    target.style.setProperty('--orbit-y', `${(x-0.5)*12}deg`);
  });
}, {passive:true});
document.addEventListener('pointerout', event => { if (!event.relatedTarget) reset(); });
reduced.addEventListener('change', () => {
  reset();
  if (reduced.matches) document.querySelectorAll('.reveal-pending').forEach(node => {
    node.classList.remove('reveal-pending');
    reveal?.unobserve(node);
  });
});
