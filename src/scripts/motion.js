// Timings and easing from the editable Digivated Figma motion tracks.
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let toast, toastTimer;
export function cardFeedback(button, message, positive = true) {
  if (!toast) {
    toast = document.createElement('p');
    toast.className = 'motion-toast';
    toast.setAttribute('role', 'status');
    toast.hidden = true;
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
  const icon = button?.querySelector('svg') || button;
  if (positive && icon?.animate && !reduced.matches) {
    icon.getAnimations().forEach(animation => animation.cancel());
    icon.animate([
      {scale:'1', offset:0, easing:'ease-out'},
      {scale:'1.16', offset:.375, easing:'ease-out'},
      {scale:'1', offset:1},
    ], {duration:320});
  }
}

for (const nav of document.querySelectorAll('.project-collections, .resource-topics')) {
  const indicator = document.createElement('span');
  indicator.className = 'motion-tab-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  nav.append(indicator);
  let initialized = false;
  const sync = () => {
    const active = nav.querySelector('button[aria-pressed="true"]');
    if (!active) return;
    indicator.style.width = `${active.offsetWidth}px`;
    indicator.style.translate = `${active.offsetLeft}px 0`;
    if (!initialized) {
      requestAnimationFrame(() => nav.classList.add('has-motion-tabs'));
      initialized = true;
    }
  };
  const observer = new MutationObserver(sync);
  observer.observe(nav, {attributes:true, subtree:true, attributeFilter:['aria-pressed']});
  const resize = new ResizeObserver(sync);
  resize.observe(nav);
  for (const button of nav.querySelectorAll('button')) resize.observe(button);
  document.fonts.ready.then(sync);
  sync();
}
