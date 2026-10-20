const FOUNDING_CHECKOUT = 'https://digivated.gumroad.com/l/founding-member-pass';

const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};

function slugFromLocation() {
  const query = new URLSearchParams(location.search).get('slug');
  if (query) return query;
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'carousels' && parts[1] && parts[1] !== 'read') return decodeURIComponent(parts[1]);
  return '';
}

function mediaUrl(slug, number) {
  return `/api/carousels?slug=${encodeURIComponent(slug)}&slide=${number}&media=1`;
}

async function loadJson(url) {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

function card(item) {
  const article = el('article', undefined, 'carousel-card');
  const title = el('h2');
  const link = el('a', item.title);
  link.href = `/carousels/${encodeURIComponent(item.slug)}`;
  title.append(link);
  article.append(
    title,
    el('p', item.summary),
    el('p', `${item.previewCount} of ${item.slideCount} slides open to everyone`, 'carousel-meta'),
  );
  return article;
}

function renderList(target, items) {
  target.replaceChildren(...items.map(card));
}

function initReader(root) {
  const track = root.querySelector('[data-carousel-track]');
  const slides = [...root.querySelectorAll('[data-carousel-slide]')];
  const controls = root.querySelector('[data-carousel-controls]');
  const previous = root.querySelector('[data-carousel-prev]');
  const next = root.querySelector('[data-carousel-next]');
  const position = root.querySelector('[data-carousel-position]');
  if (!track || !slides.length || !controls || !previous || !next || !position || root.dataset.carouselReady) return;
  root.dataset.carouselReady = 'true';
  let current = 0;
  let frame;
  const update = () => {
    frame = undefined;
    const left = track.getBoundingClientRect().left;
    current = slides.reduce((best, slide, index) => Math.abs(slide.getBoundingClientRect().left - left) < Math.abs(slides[best].getBoundingClientRect().left - left) ? index : best, 0);
    previous.disabled = current === 0;
    next.disabled = current === slides.length - 1;
    position.textContent = `Slide ${current + 1} of ${slides.length}`;
  };
  const move = index => {
    const nextIndex = Math.max(0, Math.min(slides.length - 1, index));
    const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
    track.scrollTo({ left: track.scrollLeft + slides[nextIndex].getBoundingClientRect().left - track.getBoundingClientRect().left, behavior });
  };
  previous.addEventListener('click', () => move(current - 1));
  next.addEventListener('click', () => move(current + 1));
  track.addEventListener('scroll', () => { if (frame === undefined) frame = requestAnimationFrame(update); }, { passive: true });
  track.addEventListener('keydown', event => {
    if (event.target !== track) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    move(event.key === 'Home' ? 0 : event.key === 'End' ? slides.length - 1 : current + (event.key === 'ArrowRight' ? 1 : -1));
  });
  window.addEventListener('resize', update, { passive: true });
  controls.hidden = false;
  update();
}

function slideArticle(slide, total) {
  const article = el('article', undefined, 'founding-carousel-slide carousel-detail-slide');
  article.dataset.carouselSlide = '';
  article.setAttribute('aria-roledescription', 'slide');
  article.setAttribute('aria-label', `${slide.number} of ${total}`);
  const top = el('div', undefined, 'founding-carousel-slide-top');
  top.append(el('span', 'Preview'), el('span', String(slide.number).padStart(2, '0')));
  article.append(top);
  if (slide.image === mediaUrl(slide.slug, slide.number)) {
    const image = el('img');
    image.src = slide.image;
    image.alt = slide.alt || '';
    article.append(image);
  }
  article.append(el('p', slide.text, 'carousel-detail-copy'));
  return article;
}

function renderDetail(root, payload) {
  const item = payload.item;
  document.title = `${item.title} · Digivated`;
  const heading = document.getElementById('carousel-title');
  const summary = document.getElementById('carousel-summary');
  const status = document.getElementById('carousel-status');
  if (heading) heading.textContent = item.title;
  if (summary) summary.textContent = item.summary;
  if (status) status.textContent = '';
  const reader = el('section', undefined, 'founding-carousel-reader');
  reader.dataset.carouselReader = '';
  reader.setAttribute('aria-label', item.title);
  reader.setAttribute('aria-roledescription', 'carousel');
  const track = el('div', undefined, 'founding-carousel-track');
  track.id = 'carousel-slides';
  track.dataset.carouselTrack = '';
  track.tabIndex = 0;
  track.setAttribute('aria-label', 'Carousel slides. Swipe, scroll, or use the arrow buttons.');
  for (const slide of item.slides) track.append(slideArticle({ ...slide, slug: item.slug }, item.slides.length));
  const controls = el('div', undefined, 'founding-carousel-controls');
  controls.dataset.carouselControls = '';
  controls.hidden = true;
  const previous = el('button', '← Previous', 'button');
  previous.type = 'button';
  previous.dataset.carouselPrev = '';
  previous.setAttribute('aria-controls', track.id);
  previous.setAttribute('aria-label', 'Previous slide');
  const position = el('span', `Slide 1 of ${item.slides.length}`);
  position.dataset.carouselPosition = '';
  position.setAttribute('role', 'status');
  position.setAttribute('aria-live', 'polite');
  const next = el('button', 'Next →', 'button');
  next.type = 'button';
  next.dataset.carouselNext = '';
  next.setAttribute('aria-controls', track.id);
  next.setAttribute('aria-label', 'Next slide');
  controls.append(previous, position, next);
  reader.append(track, controls);
  const transcript = el('details', undefined, 'founding-carousel-transcript');
  transcript.append(el('summary', 'Read the preview slides as text'));
  for (const slide of item.slides) {
    const section = el('section');
    section.append(el('h3', `Slide ${slide.number}`), el('p', slide.text));
    transcript.append(section);
  }
  reader.append(transcript);
  const locked = el('section', undefined, 'carousel-locked');
  if (item.locked) {
    locked.append(el('h2', item.locked.message), el('p', `${item.locked.count} more slides are included with the Founding Member Pass. The collection grows as carousels are added.`));
    const buy = el('a', 'Get the Founding Member Pass', 'button');
    buy.href = FOUNDING_CHECKOUT;
    buy.target = '_blank';
    buy.rel = 'noopener noreferrer';
    locked.append(buy);
    locked.append(el('p', 'Already purchased? Sign in below with your license key or purchase email.'));
  } else locked.hidden = true;
  const references = el('section', undefined, 'carousel-references');
  if (payload.member && item.references?.length) {
    references.append(el('h2', 'References'));
    const list = el('ul');
    for (const reference of item.references) {
      if (!reference.url?.startsWith('https://')) continue;
      const itemNode = el('li');
      const link = el('a', reference.label);
      link.href = reference.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      itemNode.append(link);
      if (reference.note) itemNode.append(el('p', reference.note));
      list.append(itemNode);
    }
    references.append(list);
  } else references.hidden = true;
  root.replaceChildren(reader, locked, references);
  initReader(reader);
  const form = document.getElementById('founding-access-form');
  const signOut = document.getElementById('founding-sign-out');
  if (form) form.hidden = !!payload.member;
  if (signOut) signOut.hidden = !payload.member;
}

async function bindAccess() {
  const form = document.getElementById('founding-access-form');
  if (!form || form.dataset.ready) return;
  form.dataset.ready = 'true';
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const status = document.getElementById('founding-access-status');
    const license = form.querySelector('[name=license]').value.trim();
    const email = form.querySelector('[name=email]').value.trim();
    if ((license && email) || (!license && !email)) {
      if (status) status.textContent = 'Enter a license key or a purchase email.';
      return;
    }
    if (status) status.textContent = 'Checking your purchase…';
    try {
      const response = await fetch('/api/founding-access', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(license ? { license } : { email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { if (status) status.textContent = data.error || 'That purchase could not be verified.'; return; }
      location.reload();
    } catch { if (status) status.textContent = 'We couldn’t check founding access right now. Please try again shortly.'; }
  });
  document.getElementById('founding-sign-out')?.addEventListener('click', async () => {
    await fetch('/api/founding-logout', { method: 'POST', credentials: 'same-origin' });
    location.reload();
  });
}

async function loadIndex() {
  const list = document.getElementById('carousel-index');
  const status = document.getElementById('carousel-index-status');
  if (!list) return;
  try {
    const { ok, data } = await loadJson('/api/carousels');
    if (!ok) throw new Error('unavailable');
    if (!data.items?.length) { if (status) status.textContent = 'No educational carousels have been published yet.'; return; }
    if (status) status.textContent = '';
    renderList(list, data.items);
  } catch { if (status) status.textContent = 'Carousels are temporarily unavailable. Please try again shortly.'; }
}

async function loadDetail() {
  const root = document.getElementById('carousel-detail');
  if (!root) return;
  const slug = slugFromLocation();
  const status = document.getElementById('carousel-status');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { if (status) status.textContent = 'This carousel could not be found.'; return; }
  try {
    const { ok, status: code, data } = await loadJson(`/api/carousels?slug=${encodeURIComponent(slug)}`);
    if (!ok) { if (status) status.textContent = code === 404 ? 'This carousel is not available.' : 'This carousel is temporarily unavailable. Please try again shortly.'; return; }
    renderDetail(root, data);
    bindAccess();
  } catch { if (status) status.textContent = 'This carousel is temporarily unavailable. Please try again shortly.'; }
}

async function loadShelf() {
  const shelf = document.querySelector('[data-carousel-shelf]');
  if (!shelf) return;
  try {
    const { ok, data } = await loadJson('/api/carousels');
    if (!ok || !data.items?.length) return;
    const section = shelf.closest('section');
    if (section) section.hidden = false;
    renderList(shelf, data.items.map(item => ({ ...item, title: item.title })));
  } catch { /* The resources page keeps its existing guides when carousels cannot load. */ }
}

async function loadFoundingInventory() {
  const list = document.getElementById('founding-inventory-list');
  if (!list) return;
  try {
    const { ok, data } = await loadJson('/api/carousels');
    if (!ok || !data.items?.length) return;
    list.replaceChildren(...data.items.map(item => {
      const row = el('li');
      const link = el('a', item.title);
      link.href = `/carousels/${encodeURIComponent(item.slug)}`;
      row.append(link);
      return row;
    }));
    list.hidden = false;
    const empty = document.getElementById('founding-inventory-empty');
    if (empty) empty.hidden = true;
    const form = document.getElementById('founding-access-form');
    if (form && data.member) form.hidden = true;
    const signOut = document.getElementById('founding-sign-out');
    if (signOut) signOut.hidden = !data.member;
  } catch { /* Keep the empty collection message when the list cannot load. */ }
}

loadIndex();
loadDetail();
loadShelf();
loadFoundingInventory();
bindAccess();
