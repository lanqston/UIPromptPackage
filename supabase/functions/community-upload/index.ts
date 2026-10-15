// Auth is validated against Supabase Auth for every request, including token expiry.
const origins = new Set(['https://digivated.vercel.app', 'https://digitalpromptpackage-git-feature-digivated-community-langston3.vercel.app']);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') || '';
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin', ...(origins.has(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } : {}) };
  const reply = (status: number, error: string) => new Response(JSON.stringify({ error }), { status, headers });
  if (!origins.has(origin)) return reply(403, 'Please upload from Digivated.');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply(405, 'Method not allowed.');
  const token = req.headers.get('authorization') || '';
  if (!/^Bearer [\w.-]+$/.test(token)) return reply(401, 'Sign in to add an image.');
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const key = Deno.env.get('SUPABASE_ANON_KEY')!;
    const memberHeaders = { apikey: key, Authorization: token, 'Content-Type': 'application/json' };
    const auth = await fetch(`${url}/auth/v1/user`, { headers: memberHeaders, signal: AbortSignal.timeout(8000) });
    if (!auth.ok) return reply(401, 'Sign in again to add an image.');
    const user = await auth.json();
    if (!uuid.test(user.id) || !user.email_confirmed_at || user.is_anonymous) return reply(403, 'Verify your email first.');
    // Read a bounded stream, not an unbounded req.json().
    const reader = req.body?.getReader();
    if (!reader) return reply(400, 'Choose an image.');
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 2900000) { await reader.cancel(); return reply(413, 'Choose an image smaller than 2 MB.'); } chunks.push(value); }
    const data = new Uint8Array(size); let at = 0; for (const chunk of chunks) { data.set(chunk, at); at += chunk.length; }
    let body; try { body = JSON.parse(new TextDecoder().decode(data)); } catch { return reply(400, 'Choose a valid image.'); }
    const match = typeof body.image === 'string' && body.image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) return reply(400, 'Choose a JPG, PNG, or WebP image.');
    const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
    const ascii = (a: number, b: number) => new TextDecoder().decode(bytes.slice(a,b));
    const valid = match[1] === 'png' ? [137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n) : match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : ascii(0,4) === 'RIFF' && ascii(8,12) === 'WEBP';
    if (!valid || bytes.length < 12 || bytes.length > 2097152) return reply(400, 'Choose a valid image smaller than 2 MB.');
    // This RPC verifies suspension and uses the authenticated user's fixed 20/hour budget.
    const budget = await fetch(`${url}/rest/v1/rpc/community_reserve_upload`, { method: 'POST', headers: memberHeaders, body: '{}', signal: AbortSignal.timeout(8000) });
    if (!budget.ok) return reply(429, 'Uploads are unavailable for this account or the hourly limit has been reached.');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const path = `${user.id}/${crypto.randomUUID()}.${match[1]}`;
    const saved = await fetch(`${url}/storage/v1/object/community-media/${path}`, { method: 'POST', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': `image/${match[1]}` }, body: bytes, signal: AbortSignal.timeout(12000) });
    if (!saved.ok) return reply(503, 'Your image could not be uploaded. Try again.');
    return new Response(JSON.stringify({ path }), { status: 200, headers });
  } catch { return reply(503, 'Your image could not be uploaded. Please try again.'); }
});
