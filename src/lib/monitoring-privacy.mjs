const errorTypes = new Set(['Error', 'TypeError', 'ReferenceError', 'RangeError', 'SyntaxError', 'URIError', 'EvalError', 'AggregateError']);
const actions = new Set(['activate', 'edition', 'logout']);
const phases = new Set(['request', 'configuration', 'rate_limit', 'purchase_verification', 'edition_read', 'session']);
const environments = new Set(['production', 'preview', 'development', 'test']);

// Allow only application source locations, never arbitrary URLs, source text or variables.
function safeFrame(frame) {
  const name = String(frame.filename || '').split(/[?#]/)[0];
  const match = name.match(/(?:\/_astro\/|\/server\/|\/src\/)[a-zA-Z0-9_./-]+\.(?:m?js|astro)$/);
  if (!match) return null;
  return {
    filename: match[0],
    ...(Number.isInteger(frame.lineno) ? { lineno: frame.lineno } : {}),
    ...(Number.isInteger(frame.colno) ? { colno: frame.colno } : {}),
  };
}

export function sanitizeEvent(event, source) {
  const verification = event.tags?.monitoring_verification === 'true';
  const clean = {
    level: verification ? 'info' : 'error',
    platform: source === 'browser' ? 'javascript' : 'node',
    tags: { source: source === 'browser' ? 'browser' : 'server' },
  };
  if (/^[a-f0-9]{32}$/.test(event.event_id || '')) clean.event_id = event.event_id;
  if (Number.isFinite(event.timestamp)) clean.timestamp = event.timestamp;
  if (environments.has(event.environment)) clean.environment = event.environment;
  if (/^[a-f0-9]{40}$/.test(event.release || '')) clean.release = event.release;
  if (verification) clean.tags.monitoring_verification = 'true';
  if (source === 'server') {
    clean.message = verification ? 'PromptCove Sentry setup verification' : 'PromptCove server failure';
    if (actions.has(event.tags?.action)) clean.tags.action = event.tags.action;
    if (phases.has(event.tags?.phase)) clean.tags.phase = event.tags.phase;
    if (/^5\d\d$/.test(String(event.tags?.status))) clean.tags.status = String(event.tags.status);
  } else {
    clean.exception = {
      values: (event.exception?.values || [{}]).slice(0, 3).map(value => ({
        type: errorTypes.has(value.type) ? value.type : 'Error',
        value: 'Browser error (message omitted for privacy)',
        stacktrace: { frames: (value.stacktrace?.frames || []).map(safeFrame).filter(Boolean).slice(-30) },
      })),
    };
  }
  // Request data, cookies, user identity, breadcrumbs, custom contexts, locals and
  // raw exception messages are intentionally absent from this allowlisted object.
  return clean;
}
