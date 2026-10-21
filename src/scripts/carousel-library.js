import { cardIconMarkup } from '../lib/card-icons.mjs';
import { viewLabel } from './project-views.js';
import { observeResourceViews } from './resource-views.js';
import { browseCarousels } from '../lib/carousel-browse.mjs';
import { carouselReading } from '../lib/carousel-reading.mjs';

const VIEW_LABEL = 'Approximate views. Repeat views from the same network count once every 24 hours.';
const knownViews = new Map();
const carouselIds = new Set();
let refreshingViews = false;
let viewRefreshTimer;

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

function icon(name, className) {
  const node = el('span', undefined, className);
  node.innerHTML = cardIconMarkup(name);
  return node;
}

function showStoredViews(views) {
  if (!views) return;
  for (const [id, count] of Object.entries(views)) {
    if (Number.isSafeInteger(count) && count >= 0) knownViews.set(id, Math.max(knownViews.get(id) ?? 0, count));
  }
  for (const label of document.querySelectorAll('[data-resource-views]')) {
    const count = views[label.dataset.resourceViews];
    if (!Number.isSafeInteger(count) || count < 0) continue;
    const shown = /\d/.test(label.textContent) ? Number(label.textContent.replace(/[^\d]/g, '')) : -1;
    if (!Number.isSafeInteger(shown) || count >= shown) label.textContent = viewLabel(knownViews.get(label.dataset.resourceViews));
  }
}

async function refreshCarouselViews() {
  if (document.hidden || refreshingViews) return;
  const ids = [...new Set([...document.querySelectorAll('[data-resource-views]')].map(node => node.dataset.resourceViews).filter(id => carouselIds.has(id)))];
  if (!ids.length) return;
  refreshingViews = true;
  try {
    // The read endpoint accepts at most 40 IDs per request.
    for (let offset = 0; offset < ids.length; offset += 40) {
      const query = ids.slice(offset, offset + 40).map(id => `id=${encodeURIComponent(id)}`).join('&');
      const response = await fetch(`/api/resource-views?${query}`, { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(10000) });
      if (response.ok) showStoredViews((await response.json())?.views);
    }
  } catch { /* Keep the last known totals while the connection recovers. */ }
  finally { refreshingViews = false; }
}

function bindCarouselViews(ids) {
  ids.filter(Boolean).forEach(id => carouselIds.add(id));
  observeResourceViews();
  refreshCarouselViews();
  if (!viewRefreshTimer) viewRefreshTimer = setInterval(refreshCarouselViews, 60000);
}

document.addEventListener('visibilitychange', refreshCarouselViews);
window.addEventListener('focus', refreshCarouselViews);
window.addEventListener('online', refreshCarouselViews);
window.addEventListener('pageshow', refreshCarouselViews);

function viewStat(id) {
  const stat = el('span', undefined, 'card-stat');
  stat.title = VIEW_LABEL;
  const label = el('span', viewLabel(knownViews.get(id)));
  label.dataset.resourceViews = id;
  stat.append(icon('eye', 'stat-icon'), label);
  return stat;
}

function card(item) {
  const href = `/carousels/${encodeURIComponent(item.slug)}`;
  const article = el('article', undefined, 'resource-card carousel-resource-card');
  article.dataset.resourceViewId = item.slug;
  const cover = el('a', undefined, 'carousel-cover');
  cover.href = href;
  cover.tabIndex = -1;
  cover.setAttribute('aria-hidden', 'true');
  const image = el('img');
  image.src = mediaUrl(item.slug, 1);
  image.alt = '';
  image.loading = 'lazy';
  image.decoding = 'async';
  cover.append(image);
  const copy = el('div', undefined, 'resource-copy');
  const topic = el('div', undefined, 'card-topic');
  topic.append(icon('book', 'topic-icon'), el('span', 'Educational carousel', 'tag'));
  const title = el('h3');
  const link = el('a', item.title);
  link.href = href;
  title.append(link);
  const stats = el('div', undefined, 'card-stats');
  stats.setAttribute('aria-label', 'Carousel details');
  const stat = el('span', undefined, 'card-stat');
  stat.title = 'Slides open without Founding Membership';
  stat.append(icon('layers', 'stat-icon'), el('span', `${item.previewCount} of ${item.slideCount} slides free`));
  stats.append(stat, viewStat(item.slug));
  const timestamp = Date.parse(item.created);
  if (Number.isFinite(timestamp)) {
    const date = el('time', `Added ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(timestamp)}`, 'carousel-added');
    date.dateTime = new Date(timestamp).toISOString();
    copy.append(date);
  }
  const footer = el('div', undefined, 'card-footer');
  const actions = el('div', undefined, 'card-actions');
  actions.setAttribute('role', 'group');
  actions.setAttribute('aria-label', `Actions for ${item.title}`);
  const share = el('button', undefined, 'card-icon');
  share.type = 'button';
  share.dataset.shareUrl = href;
  share.setAttribute('aria-label', `Share ${item.title}`);
  share.title = 'Share';
  share.append(icon('share'));
  const save = el('button', undefined, 'card-icon card-save');
  save.type = 'button';
  save.dataset.saveType = 'carousel';
  save.dataset.saveId = item.slug;
  save.setAttribute('aria-label', 'Save to collection');
  save.title = 'Save to collections';
  save.append(icon('save'), el('span', 'Save', 'sr-only'));
  save.lastElementChild.dataset.saveLabel = '';
  actions.append(share, save);
  const open = el('a', undefined, 'card-open');
  open.href = href;
  open.append(el('span', 'View carousel'), icon('arrow', 'button-arrow'));
  footer.append(actions, open);
  copy.append(topic, title, el('p', item.summary, 'resource-description'), stats, footer);
  article.append(cover, copy);
  return article;
}

function renderList(target, items) {
  const controls = target.closest('section')?.querySelector('[data-carousel-browse]');
  const search = controls?.querySelector('input');
  const sort = controls?.querySelector('select');
  const status = controls?.querySelector('[role=status]');
  const update = () => {
    // A view recorded by the visibility observer may be newer than the last read.
    for (const label of target.querySelectorAll('[data-resource-views]')) {
      if (!/\d/.test(label.textContent)) continue;
      const count = Number(label.textContent.replace(/[^\d]/g, ''));
      if (Number.isSafeInteger(count)) knownViews.set(label.dataset.resourceViews, Math.max(knownViews.get(label.dataset.resourceViews) ?? 0, count));
    }
    const query = (search?.value || '').trim().toLowerCase();
    const visible = browseCarousels(items, query, sort?.value);
    target.replaceChildren(...visible.map(card));
    if (status) status.textContent = visible.length ? `${visible.length} ${visible.length === 1 ? 'carousel' : 'carousels'} · ${sort?.value === 'title' ? 'Title A–Z' : 'Newest first'}` : 'No matching carousels. Try another search.';
    bindCarouselViews(visible.map(item => item.slug));
  };
  search?.addEventListener('input', update);
  sort?.addEventListener('change', update);
  update();
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

function slideArticle(slide, total, member) {
  const article = el('article', undefined, 'carousel-viewer-slide');
  article.dataset.carouselSlide = '';
  article.setAttribute('aria-roledescription', 'slide');
  article.setAttribute('aria-label', `${slide.number} of ${total}`);
  const top = el('p', undefined, 'carousel-viewer-kicker');
  top.append(el('span', member || slide.number > 4 ? `Slide ${slide.number}` : 'Preview'), el('span', `${slide.number} of ${total}`));
  article.append(top);
  if (slide.image === mediaUrl(slide.slug, slide.number)) {
    const image = el('img');
    image.src = slide.image;
    image.alt = slide.alt || '';
    article.append(image);
  }
  article.append(readingCard(slide, slide.slug));
  return article;
}

function readingCard(slide, slug) {
  const copy = carouselReading(slide, slug);
  const card = el('section', undefined, 'carousel-reading-card');
  card.setAttribute('aria-label', `Slide ${slide.number} notes`);
  const header = el('div', undefined, 'carousel-reading-heading');
  const number = el('span', String(slide.number), 'carousel-reading-number');
  number.setAttribute('aria-hidden', 'true');
  header.append(number);
  if (copy.heading) header.append(el('h3', copy.heading));
  else header.append(el('span', 'In this slide', 'carousel-reading-label'));
  card.append(header);
  for (const paragraph of copy.paragraphs) card.append(el('p', paragraph));
  return card;
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
  const intro = document.querySelector('.carousel-reader-intro');
  if (intro) intro.dataset.resourceViewId = item.slug;
  const meta = document.getElementById('carousel-meta');
  if (meta) {
    const count = el('span', viewLabel(knownViews.get(item.slug)), 'carousel-reader-views');
    count.dataset.resourceViews = item.slug;
    count.title = VIEW_LABEL;
    meta.replaceChildren(el('span', item.locked ? `${item.slides.length} of ${item.slideCount} slides free` : `All ${item.slideCount} slides`), count);
  }
  const crumb = document.querySelector('.site-breadcrumbs [aria-current="page"]');
  if (crumb) crumb.textContent = item.title;
  const reader = el('section', undefined, 'carousel-viewer');
  reader.dataset.carouselReader = '';
  reader.setAttribute('aria-label', item.title);
  reader.setAttribute('aria-roledescription', 'carousel');
  const track = el('div', undefined, 'carousel-viewer-track');
  track.id = 'carousel-slides';
  track.dataset.carouselTrack = '';
  track.tabIndex = 0;
  track.setAttribute('aria-label', 'Carousel slides. Swipe, scroll, or use the arrow buttons.');
  for (const slide of item.slides) track.append(slideArticle({ ...slide, slug: item.slug }, item.slides.length, !!payload.member));
  const controls = el('div', undefined, 'carousel-viewer-controls');
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
  const transcript = el('details', undefined, 'carousel-viewer-transcript');
  transcript.append(el('summary', payload.member ? 'Read all slides as text' : 'Read the preview slides as text'));
  for (const slide of item.slides) {
    transcript.append(readingCard(slide, item.slug));
  }
  reader.append(transcript);
  const locked = el('section', undefined, 'carousel-locked');
  if (item.locked) {
    locked.append(el('h2', item.locked.message), el('p', `${item.locked.count} more slides are included with Founding Membership, along with the full Prompt Packet and one reviewed feature. The collection grows as carousels are added.`));
    const buy = el('a', 'Get Founding Membership', 'button');
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
  bindCarouselViews([item.slug]);
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
    const button=form.querySelector('button[type=submit]');
    if(button.disabled)return;
    button.disabled=true;
    if (status) status.textContent = 'Checking your purchase…';
    try {
      const response = await fetch('/api/founding-access', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(license ? { license } : { email }), signal:AbortSignal.timeout(20000),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { if (status) status.textContent = data.error || 'That purchase could not be verified.'; return; }
      location.reload();
    } catch { if (status) status.textContent = 'We couldn’t check founding access right now. Please try again shortly.'; }
    finally { button.disabled=false; }
  });
  document.getElementById('founding-sign-out')?.addEventListener('click', async () => {
    const status=document.getElementById('founding-access-status');
    try{const response=await fetch('/api/founding-logout', { method: 'POST', credentials: 'same-origin', signal:AbortSignal.timeout(15000) });if(!response.ok)throw new Error();location.reload();}
    catch{if(status)status.textContent='We couldn’t sign you out. Please try again.';}
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
