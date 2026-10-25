// Native details remains functional without JavaScript. Add predictable dismiss/focus behavior.
const menu = document.querySelector('.explore-menu, .mobile-menu');
if (menu) {
  const trigger = menu.querySelector('summary');
  const close = (restoreFocus = false) => { menu.open = false; if (restoreFocus) trigger.focus(); };
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) { event.preventDefault(); close(true); }
  });
  document.addEventListener('click', event => { if (menu.open && !menu.contains(event.target)) close(); });
  document.addEventListener('focusin', event => { if (menu.open && !menu.contains(event.target)) close(); });
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => close()));
  menu.querySelectorAll('[data-open-search]').forEach(button => button.addEventListener('click', () => close()));

}

