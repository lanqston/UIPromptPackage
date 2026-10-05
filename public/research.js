const status = document.getElementById('status'), results = document.getElementById('results');
const run = document.getElementById('run'), pause = document.getElementById('pause');
let csrf, paused = false;
const publisherStatus = document.getElementById('publisher-status');
const publisherPause = document.getElementById('publisher-pause');
let publisherPaused = false;
async function refreshPublisher() {
  const data = await json('/api/x-publish');
  publisherPaused = data.paused;
  publisherStatus.textContent = `${data.enabled ? (data.paused ? 'Replies paused.' : 'Automatic replies enabled: at most seven per rolling hour.') : 'Automatic replies disabled.'} ${data.latest ? `Last check: ${data.latest.status}. ${data.latest.error || ''}` : 'No publishing checks yet.'}`;
  publisherPause.textContent = publisherPaused ? 'Resume replies' : 'Pause replies';
  publisherPause.disabled = !data.enabled;
}
publisherPause.addEventListener('click', async () => {
  publisherPause.disabled = true;
  try {
    await json('/api/x-publish', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-CSRF': csrf }, body: JSON.stringify({ action: publisherPaused ? 'resume' : 'pause' }) });
    await refreshPublisher();
  } catch (error) { publisherStatus.textContent = error.message; publisherPause.disabled = false; }
});
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
  status.textContent = `${paused ? 'Paused.' : 'Hourly research enabled.'} ${data.latest ? `Last run: ${data.latest.status}; ${data.latest.added} drafts. ${data.latest.error || ''}` : 'No runs yet.'}`;
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
    if (data.status === 'already_ran_this_hour') status.textContent += ' This hour’s run has already been used.';
  } catch (error) { status.textContent = error.message; }
  finally { run.disabled = paused; pause.disabled = false; }
}
run.addEventListener('click', () => act('run'));
pause.addEventListener('click', () => act(paused ? 'resume' : 'pause'));
(async () => {
  try { csrf = (await json('/api/admin')).csrf; await refresh(); await refreshPublisher(); run.disabled = paused; pause.disabled = false; }
  catch (error) { status.textContent = error.message; }
})();
