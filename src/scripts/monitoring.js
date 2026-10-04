import * as Sentry from '@sentry/browser';
import { sanitizeEvent } from '../lib/monitoring-privacy.mjs';

if (import.meta.env.PUBLIC_SENTRY_DSN) {
  try {
    Sentry.init({
      dsn: import.meta.env.PUBLIC_SENTRY_DSN,
      environment: import.meta.env.PUBLIC_SENTRY_ENVIRONMENT,
      release: import.meta.env.PUBLIC_SENTRY_RELEASE,
      defaultIntegrations: false,
      integrations: [Sentry.globalHandlersIntegration(), Sentry.browserApiErrorsIntegration(), Sentry.dedupeIntegration()],
      sendDefaultPii: false,
      autoSessionTracking: false,
      tracesSampleRate: 0,
      beforeSend: event => sanitizeEvent(event, 'browser'),
    });
  } catch {
    // Monitoring initialization must never prevent the application from loading.
  }
}
