import { makePublicHandler } from './public-community.mjs';
import { makeSavedItemHandler } from './saved-items.mjs';
import { makeProjectViewHandler } from './project-views.mjs';
import { makeResourceViewHandler } from './resource-views.mjs';
import { makeCardInteractionHandler } from './card-interactions.mjs';
import { makeCarouselHandler, makeCarouselPublishHandler } from './carousels.mjs';
import { makeFoundingAccessHandler, makeFoundingLogoutHandler } from './founding-access.mjs';
import { makeProjectAccountHandler } from './project-account.mjs';
import { makeReturnEmailHandler, makeWeeklyDigestHandler } from './return-emails.mjs';

// Share one deployment entry point; each handler retains its validation and response.
// Carousel routes stay on this router so the deployment does not add a serverless function.
export function defaultPublicHandlers(overrides = {}) {
  return {
    content: makePublicHandler('content'),
    'saved-item': makeSavedItemHandler(),
    'project-views': makeProjectViewHandler(),
    'resource-views': makeResourceViewHandler(),
    'card-interactions': makeCardInteractionHandler(),
    carousels: makeCarouselHandler(),
    'carousel-publish': makeCarouselPublishHandler(),
    'founding-access': makeFoundingAccessHandler(),
    'founding-logout': makeFoundingLogoutHandler(),
    'project-account': makeProjectAccountHandler(),
    'return-emails': makeReturnEmailHandler(),
    'weekly-digest': makeWeeklyDigestHandler(),
    ...overrides,
  };
}
export function makePublicRouter(handlers = defaultPublicHandlers()) {
  return (req, res) => {
    const path = new URL(req.url, 'https://digivated.invalid').pathname;
    const route = /^\/api\/([^/]+)$/.exec(path)?.[1];
    if (route && Object.hasOwn(handlers, route)) return handlers[route](req, res);
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: 'Not found.' }));
  };
}
