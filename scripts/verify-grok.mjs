// Read-only provider validation during production build. Never print credentials.
if (process.env.VERCEL_ENV === 'production') {
  if (!process.env.XAI_API_KEY) throw new Error('Missing production XAI_API_KEY');
  const response = await fetch('https://api.x.ai/v1/models', { headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}` }, signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!response.ok) {
    let code = '';
    try {
      const body = await response.json();
      const candidate = body?.code || body?.error?.code;
      if (typeof candidate === 'string' && /^[a-z0-9_-]{1,80}$/i.test(candidate)) code = ` (${candidate})`;
    } catch {}
    throw new Error(`Grok model access check failed: HTTP ${response.status}${code}`);
  }
  const data = await response.json();
  const names = data.data.flatMap(m => [m.id, ...(m.aliases || [])]);
  const model = process.env.XAI_MODEL || 'grok-4.7';
  if (!names.includes(model)) throw new Error(`Configured Grok model unavailable: ${model}. Available models: ${names.join(', ')}`);
  console.info('Grok API credential and configured model verified. Generation and X Search still require a research run.');
}
