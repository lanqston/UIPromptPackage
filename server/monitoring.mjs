import * as Sentry from '@sentry/node';
import { sanitizeEvent } from '../src/lib/monitoring-privacy.mjs';

let initialized = false;
export async function reportServerFailure({ action, phase, status }) {
  if (!process.env.SENTRY_DSN || status < 500) return;
  try {
    if (!initialized) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.VERCEL_ENV || 'development',
        release: process.env.VERCEL_GIT_COMMIT_SHA,
        defaultIntegrations: false,
        skipOpenTelemetrySetup: true,
        sendDefaultPii: false,
        tracesSampleRate: 0,
        beforeSend: event => sanitizeEvent(event, 'server'),
      });
      initialized = true;
    }
    Sentry.captureMessage('PromptCove server failure', {
      level: 'error', tags: { action, phase, status: String(status) },
    });
    await Sentry.flush(1500);
  } catch {
    // An unavailable monitoring provider must not change the access response.
  }
}
