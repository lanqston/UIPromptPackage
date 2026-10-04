import * as Sentry from '@sentry/node';
import { sanitizeEvent } from '../src/lib/monitoring-privacy.mjs';

// Explicit one-time verification, never a public error endpoint.
if (process.env.SENTRY_SETUP_VERIFY !== '1' || process.env.VERCEL_ENV !== 'production') {
  console.info('Sentry: one-time ingestion verification skipped.');
  process.exit(0);
}
if (!process.env.SENTRY_DSN) throw new Error('SENTRY_DSN is missing.');
let accepted = false;
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: 'production',
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  defaultIntegrations: false,
  skipOpenTelemetrySetup: true,
  sendDefaultPii: false,
  beforeSend: event => sanitizeEvent(event, 'server'),
  transport: options => {
    const transport = Sentry.makeNodeTransport(options);
    return {
      send: async envelope => {
        const result = await transport.send(envelope);
        accepted = result.statusCode >= 200 && result.statusCode < 300;
        console.info('Sentry ingestion HTTP status:', result.statusCode);
        return result;
      },
      flush: timeout => transport.flush(timeout),
    };
  },
});
const id = Sentry.captureMessage('PromptCove Sentry setup verification', {
  level: 'info', tags: { monitoring_verification: 'true' },
});
await Sentry.flush(5000);
if (!accepted) throw new Error('Sentry did not accept the setup event.');
console.info('Sentry accepted setup event:', id);
