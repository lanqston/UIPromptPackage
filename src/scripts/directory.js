const directory = document.querySelector('[data-directory]');
if (directory) {
  const search = document.getElementById('directory-search');
  const category = document.getElementById('directory-category');
  const view = document.getElementById('directory-view');
  const sort = document.getElementById('directory-sort');
  const clear = document.querySelector('[data-directory-clear]');
  const isProjects = directory.dataset.directory === 'projects';
  const goalButtons = [...document.querySelectorAll('[data-goal-filter]')];
  let goal = '';
  let layout = 'grid';
  const defaultSort = sort?.value || 'newest';
  let lastOrderedCards = [];
  const setLayout = value => {
    layout = value;
    const list = document.querySelector(isProjects ? '[data-live-projects] [data-live-list]' : '[data-live-resources] [data-live-list]');
    if (list) list.dataset.layout = layout;
    for (const button of document.querySelectorAll('[data-directory-layout]')) button.setAttribute('aria-pressed', String(button.dataset.directoryLayout === layout));
  };
  const setGoal = value => { goal = value; for (const button of goalButtons) button.setAttribute('aria-pressed',String(button.dataset.goalFilter === goal)); };
  const syncFilters = () => {
    const url = new URL(location.href);
    const values = [['category',category.value],['q',search.value.trim()],['sort',sort?.value === defaultSort ? '' : sort?.value],['layout',layout === 'grid' ? '' : layout]];
    if (isProjects) values.push(['view',view?.value === 'featured' ? '' : view?.value]);
    else values.push(['path',goal]);
    for (const [key,value] of values) { if(value) url.searchParams.set(key,value); else url.searchParams.delete(key); }
    history.replaceState(null,'',url);
  };
  const update = () => {
    const cards = [...document.querySelectorAll(directory.dataset.directory === 'projects' ? '[data-project]' : '[data-resource]')];
    if (sort) {
      const ordered = [...cards].sort((a, b) => {
        if (!isProjects && sort.value === 'recommended') return Number(a.dataset.resourceOrder ?? 9999) - Number(b.dataset.resourceOrder ?? 9999);
        if (sort.value === 'name') return (a.dataset[isProjects ? 'projectName' : 'resourceName'] || '').localeCompare(b.dataset[isProjects ? 'projectName' : 'resourceName'] || '');
        if (!isProjects && sort.value === 'quick') return (Number(a.dataset.resourceReadingTime) || Infinity) - (Number(b.dataset.resourceReadingTime) || Infinity);
        if (sort.value === 'views') return Number(b.dataset.projectViewsTotal || 0) - Number(a.dataset.projectViewsTotal || 0);
        return (b.dataset[isProjects ? 'projectDate' : 'resourceDate'] || '').localeCompare(a.dataset[isProjects ? 'projectDate' : 'resourceDate'] || '');
      });
      const list = document.querySelector(isProjects ? '[data-live-projects] [data-live-list]' : '[data-live-resources] [data-live-list]');
      if (list && (ordered.length !== lastOrderedCards.length || ordered.some((card,index) => card !== lastOrderedCards[index]))) {
        for (const card of ordered) list.appendChild(card);
        lastOrderedCards = ordered;
      }
    }
    let count = 0;
    const query = search.value.trim().toLowerCase();
    for (const card of cards) {
      const visible = (!goal || card.dataset.learningGoal === goal) && card.dataset.search.includes(query) && (!category.value || card.dataset.category === category.value) && (!view || view.value === 'newest' || (view.value === 'featured' && card.dataset.featured === 'true'));
      card.hidden = !visible;
      if (visible) count++;
    }
    document.getElementById('directory-status').textContent = `${count} ${count === 1 ? directory.dataset.directory.slice(0, -1) : directory.dataset.directory} found`;
    document.getElementById('directory-empty').hidden = count > 0;
    for (const chip of document.querySelectorAll('[data-category-filter]')) chip.setAttribute('aria-pressed', String(chip.dataset.categoryFilter === category.value));
    if (isProjects) {
      const values = {
        'data-project-total': cards.length,
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
      if (heading) heading.textContent = view?.value === 'featured' ? 'Featured projects' : category.value || 'All projects';
    }
    if (clear) clear.hidden = !query && !category.value && !goal;
    const goalDescription = document.getElementById('directory-goal-description');
    if (goalDescription) {
      goalDescription.textContent = goalButtons.find(button => button.dataset.goalFilter === goal)?.dataset.goalDescription || '';
      goalDescription.hidden = !goalDescription.textContent;
    }
    const empty = document.getElementById('directory-empty');
    if (isProjects && directory.dataset.loaded !== 'true') {
      document.getElementById('directory-status').textContent = 'Loading projects…';
      if (empty) empty.hidden = true;
    }
    if (directory.dataset.failed === 'true') {
      document.getElementById('directory-status').textContent = 'Projects are temporarily unavailable. Please refresh to try again.';
      if (empty) empty.hidden = true;
    }
    if (empty && count === 0) {
      const hasFilters = Boolean(query || category.value || goal || (view && view.value !== 'newest'));
      empty.querySelector('h3').textContent = hasFilters && cards.length ? 'Nothing in this view yet.' : directory.dataset.directory === 'resources' ? 'The library is taking shape.' : 'The next discovery is still to come.';
      empty.querySelector('p').textContent = hasFilters && cards.length ? isProjects ? 'Try another search or category, or clear the filters to see all projects.' : 'Try another goal or topic, or clear the filters to see all guides.' : directory.dataset.directory === 'resources' ? 'New guides and useful tools will appear here as they’re published.' : 'Reviewed projects will appear here as the community grows.';
    }
  };
  const requestedCategory = new URLSearchParams(location.search).get('category');
  if ([...category.options].some(option => option.value === requestedCategory)) category.value = requestedCategory;
  const requestedGoal = new URLSearchParams(location.search).get('path');
  if(requestedGoal && goalButtons.some(button=>button.dataset.goalFilter === requestedGoal)) { setGoal(requestedGoal); category.value=''; }
  search.value = new URLSearchParams(location.search).get('q') || '';
  const requestedSort = new URLSearchParams(location.search).get('sort');
  if (sort && [...sort.options].some(option => option.value === requestedSort)) sort.value = requestedSort;
  const requestedLayout = new URLSearchParams(location.search).get('layout');
  setLayout(requestedLayout === 'list' ? 'list' : 'grid');
  for(const button of goalButtons) button.addEventListener('click',()=>{setGoal(button.dataset.goalFilter);category.value='';syncFilters();update();});
  for (const chip of document.querySelectorAll('[data-category-filter]')) chip.addEventListener('click', () => { category.value = chip.dataset.categoryFilter; syncFilters(); update(); });
  const requestedView = new URLSearchParams(location.search).get('view');
  if (view && isProjects) view.value = ['featured', 'newest'].includes(requestedView) ? requestedView : 'featured';
  for (const button of document.querySelectorAll('[data-directory-view]')) button.addEventListener('click', () => { if (view) view.value = button.dataset.directoryView; syncFilters(); update(); });
  for (const button of document.querySelectorAll('[data-directory-layout]')) button.addEventListener('click', () => {
    setLayout(button.dataset.directoryLayout);
    syncFilters();
  });
  clear?.addEventListener('click', () => { search.value = ''; category.value = ''; setGoal(''); syncFilters(); update(); });
  sort?.addEventListener('change', () => {syncFilters(); update();});
  search.addEventListener('input', () => {syncFilters(); update();});
  category.addEventListener('change', () => {setGoal(''); syncFilters(); update();});
  view?.addEventListener('change', () => {syncFilters(); update();});
  document.addEventListener('digivated:collection-failed', () => { if (isProjects) { directory.dataset.failed = 'true'; update(); } });
  document.addEventListener('digivated:collection-updated', () => { directory.dataset.loaded = 'true'; update(); });
  update();
}

