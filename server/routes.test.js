/**
 * @jest-environment node
 */
// Development (src/setupProxy.js) and production (vercel.json + api/) must
// expose the same /api routes backed by the same handlers.
const fs = require('fs');
const path = require('path');
const vercelConfig = require('../vercel.json');
const { DEV_ROUTES } = require('./routes');

const API_DIR = path.join(__dirname, '..', 'api');

const functionHandlers = Object.fromEntries(
  fs
    .readdirSync(API_DIR)
    .filter((file) => file.endsWith('.js') && !file.startsWith('_'))
    .map((file) => [
      `/api/${path.basename(file, '.js')}`,
      require(path.join(API_DIR, file)),
    ])
);

const resolveProductionRoute = (routePath) => {
  const rewrite = vercelConfig.rewrites.find((r) => r.source === routePath);
  const [functionPath, queryString] = (
    rewrite ? rewrite.destination : routePath
  ).split('?');
  return {
    handler: functionHandlers[functionPath],
    query: Object.fromEntries(new URLSearchParams(queryString || '')),
  };
};

const devPaths = DEV_ROUTES.map((route) => route.path);

describe('API route parity', () => {
  it.each(DEV_ROUTES.map((route) => [route.path, route]))(
    '%s uses the same handler in production',
    (routePath, route) => {
      const production = resolveProductionRoute(routePath);
      expect(typeof production.handler).toBe('function');
      expect(production.handler).toBe(route.handler);
      expect(production.query).toEqual(route.query);
    }
  );

  it('mounts every vercel.json rewrite in development', () => {
    vercelConfig.rewrites.forEach((rewrite) => {
      expect(devPaths).toContain(rewrite.source);
    });
  });

  it('mounts every api/ function in development', () => {
    Object.keys(functionHandlers).forEach((functionPath) => {
      expect(devPaths).toContain(functionPath);
    });
  });
});
