const directory = document.querySelector('[data-directory]');
if (directory) {
  const search = document.getElementById('directory-search');
  const category = document.getElementById('directory-category');
  const view = document.getElementById('directory-view');
  const sort = document.getElementById('directory-sort');
  const clear = document.querySelector('[data-directory-clear]');
  const isProjects = directory.dataset.directory === 'projects';
  const update = () => {
    const cards = [...document.querySelectorAll(directory.dataset.directory === 'projects' ? '[data-project]' : '[data-resource]')];
    if (isProjects && sort) {
      const ordered = [...cards].sort((a, b) => {
        if (sort.value === 'name') return (a.dataset.projectName || '').localeCompare(b.dataset.projectName || '');
        if (sort.value === 'views') return Number(b.dataset.projectViewsTotal || 0) - Number(a.dataset.projectViewsTotal || 0);
        return (b.dataset.projectDate || '').localeCompare(a.dataset.projectDate || '');
      });
      const list = document.querySelector('[data-live-projects] [data-live-list]');
      if (list) for (const card of ordered) list.appendChild(card);
    }
    let count = 0;
    const query = search.value.trim().toLowerCase();
    for (const card of cards) {
      const visible = card.dataset.search.includes(query) && (!category.value || card.dataset.category === category.value) && (!view || view.value === 'newest' || (view.value === 'featured' && card.dataset.featured === 'true') || (view.value === 'picks' && card.dataset.pick === 'true'));
      card.hidden = !visible;
      if (visible) count++;
    }
    document.getElementById('directory-status').textContent = `${count} ${count === 1 ? directory.dataset.directory.slice(0, -1) : directory.dataset.directory} found`;
    document.getElementById('directory-empty').hidden = count > 0;
    for (const chip of document.querySelectorAll('[data-category-filter]')) chip.setAttribute('aria-pressed', String(chip.dataset.categoryFilter === category.value));
    if (isProjects) {
      const values = {
        'data-project-total': cards.length,
        'data-project-picks': cards.filter(card => card.dataset.pick === 'true').length,
        'data-project-featured': cards.filter(card => card.dataset.featured === 'true').length,
        'data-project-categories': new Set(cards.map(card => card.dataset.category)).size,
      };
      // Keep loading placeholders until the public collection has arrived.
      if (directory.dataset.loaded === 'true') {
        for (const [attribute, value] of Object.entries(values)) {
          for (const node of document.querySelectorAll(`[${attribute}]`)) node.textContent = String(value);
        }
        for (const node of document.querySelectorAll('[data-category-count]')) {
          const total = cards.filter(card => card.dataset.category === node.dataset.categoryCount).length;
          node.textContent = total ? String(total) : '';
        }
      }
      for (const button of document.querySelectorAll('[data-directory-view]')) button.setAttribute('aria-pressed', String(button.dataset.directoryView === view?.value));
      const heading = document.getElementById('directory-heading');
      if (heading) heading.textContent = view?.value === 'picks' ? 'Digivated Picks' : view?.value === 'featured' ? 'Featured projects' : category.value || 'All projects';
      if (clear) clear.hidden = !query && !category.value && (!view || view.value === 'newest');
    }
    const empty = document.getElementById('directory-empty');
    if (isProjects && directory.dataset.loaded !== 'true') {
      document.getElementById('directory-status').textContent = 'Loading projects…';
      if (empty) empty.hidden = true;
    }
    if (empty && count === 0) {
      const hasFilters = Boolean(query || category.value || (view && view.value !== 'newest'));
      empty.querySelector('h3').textContent = hasFilters && cards.length ? 'Nothing in this view yet.' : directory.dataset.directory === 'resources' ? 'The library is taking shape.' : 'The next discovery is still to come.';
      empty.querySelector('p').textContent = hasFilters && cards.length ? 'Try another topic or clear the search to see everything available.' : directory.dataset.directory === 'resources' ? 'New guides and useful tools will appear here as they’re published.' : 'Reviewed projects will appear here as the community grows.';
    }
  };
  const requestedCategory = new URLSearchParams(location.search).get('category');
  if ([...category.options].some(option => option.value === requestedCategory)) category.value = requestedCategory;
  for (const chip of document.querySelectorAll('[data-category-filter]')) chip.addEventListener('click', () => { category.value = chip.dataset.categoryFilter; update(); });
  const requestedView = new URLSearchParams(location.search).get('view');
  if (view && ['featured', 'picks'].includes(requestedView)) view.value = requestedView;
  for (const button of document.querySelectorAll('[data-directory-view]')) button.addEventListener('click', () => { if (view) view.value = button.dataset.directoryView; update(); });
  for (const button of document.querySelectorAll('[data-directory-layout]')) button.addEventListener('click', () => {
    const list = document.querySelector('[data-live-projects] [data-live-list]');
    if (list) list.dataset.layout = button.dataset.directoryLayout;
    for (const toggle of document.querySelectorAll('[data-directory-layout]')) toggle.setAttribute('aria-pressed', String(toggle === button));
  });
  clear?.addEventListener('click', () => { search.value = ''; category.value = ''; if (view) view.value = 'newest'; update(); });
  sort?.addEventListener('change', update);
  search.addEventListener('input', update);
  category.addEventListener('change', update);
  view?.addEventListener('change', update);
  document.addEventListener('digivated:collection-updated', () => { directory.dataset.loaded = 'true'; update(); });
  update();
}

