import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  vite: {
    // Keep bundled scripts external so the existing self-only CSP can run them.
    build: { assetsInlineLimit: 0 },
    define: {
      'import.meta.env.PUBLIC_SENTRY_ENVIRONMENT': JSON.stringify(process.env.VERCEL_ENV || 'development'),
      'import.meta.env.PUBLIC_SENTRY_RELEASE': JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA || ''),
    },
  },
});
