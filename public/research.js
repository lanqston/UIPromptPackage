const status = document.getElementById('status'), results = document.getElementById('results');
const run = document.getElementById('run'), pause = document.getElementById('pause');
let csrf, paused = false;
async function json(url, options = {}) {
  const response = await fetch(url, { ...options, credentials: 'same-origin', cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Research failed. Refresh to see the last run.');
  return data;
}
async function refresh() {
  const data = await json('/api/x-research');
  paused = data.paused;
  pause.textContent = paused ? 'Resume' : 'Pause';
  status.textContent = `${paused ? 'Paused.' : 'Daily research enabled.'} ${data.latest ? `Last run: ${data.latest.status}; ${data.latest.added} drafts. ${data.latest.error || ''}` : 'No runs yet.'} Posting is off.`;
  results.replaceChildren();
  for (const item of data.items) {
    const article = document.createElement('article');
    const title = document.createElement('h2'); title.textContent = `${item.author} · ${item.niche}`;
    const original = document.createElement('p'); original.textContent = item.text;
    const reply = document.createElement('p'); reply.textContent = `Draft: ${item.reply}`;
    const a = document.createElement('a'); a.textContent = 'Read original post';
    if (/^https:\/\/(x\.com|twitter\.com)\/[\w]+\/status\/\d+$/.test(item.url)) a.href = item.url;
    a.target = '_blank'; a.rel = 'noopener noreferrer';
    article.append(title, original, reply, a); results.append(article);
  }
}
async function act(action) {
  run.disabled = pause.disabled = true;
  status.textContent = action === 'run' ? 'Researching… this may take a few minutes.' : 'Saving…';
  try {
    const data = await json('/api/x-research', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-CSRF': csrf }, body: JSON.stringify({ action }) });
    await refresh();
    if (data.status === 'already_ran_today') status.textContent += ' Today’s run has already been used.';
  } catch (error) { status.textContent = error.message; }
  finally { run.disabled = paused; pause.disabled = false; }
}
run.addEventListener('click', () => act('run'));
pause.addEventListener('click', () => act(paused ? 'resume' : 'pause'));
(async () => {
  try { csrf = (await json('/api/admin')).csrf; await refresh(); run.disabled = paused; pause.disabled = false; }
  catch (error) { status.textContent = error.message; }
})();
