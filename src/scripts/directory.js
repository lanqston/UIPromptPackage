const directory = document.querySelector('[data-directory]');
if (directory) {
  const search = document.getElementById('directory-search');
  const category = document.getElementById('directory-category');
  const view = document.getElementById('directory-view');
  const update = () => {
    const cards = [...document.querySelectorAll(directory.dataset.directory === 'projects' ? '[data-project]' : '[data-resource]')];
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
    const empty = document.getElementById('directory-empty');
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
  search.addEventListener('input', update);
  category.addEventListener('change', update);
  view?.addEventListener('change', update);
  document.addEventListener('digivated:collection-updated', update);
  update();
}

