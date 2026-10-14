import { makePublicHandler } from './public-community.mjs';
import { makeSavedItemHandler } from './saved-items.mjs';
import { makeProjectViewHandler } from './project-views.mjs';
import { makeCardInteractionHandler } from './card-interactions.mjs';

// Share one deployment entry point; each handler retains its validation and response.
export function makePublicRouter(handlers = {
  content: makePublicHandler('content'),
  'saved-item': makeSavedItemHandler(),
  'project-views': makeProjectViewHandler(),
  'card-interactions': makeCardInteractionHandler(),
}) {
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
