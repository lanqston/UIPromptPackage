const status = document.getElementById('status');
const button = document.getElementById('connect');
let csrf;
async function json(url, options = {}) {
  const response = await fetch(url, { ...options, cache: 'no-store', credentials: 'same-origin' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Connection unavailable.');
  return data;
}
async function init() {
  try {
    const session = await json('/api/admin');
    csrf = session.csrf;
    const connection = await json('/api/x-connect');
    status.textContent = connection.connected ? `Connected to @${connection.username}. Posting is off.${connection.accessTokenExpired ? ' Access token expired; reconnect before use.' : ''}` : 'Ready to connect @digivatedx.';
    button.textContent = connection.connected ? 'Reconnect with X' : 'Connect with X';
    button.disabled = false;
  } catch (error) { status.textContent = error.message; }
}
button.addEventListener('click', async () => {
  button.disabled = true;
  try {
    const data = await json('/api/x-connect', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-CSRF': csrf }, body: JSON.stringify({ action: 'connect' }) });
    const destination = new URL(data.authorizationUrl);
    if (destination.origin !== 'https://x.com' || destination.pathname !== '/i/oauth2/authorize') throw new Error('Unexpected authorization destination.');
    location.assign(destination.href);
  } catch (error) { status.textContent = error.message; button.disabled = false; }
});
init();
