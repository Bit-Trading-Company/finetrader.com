/**
 * The public /api route table.
 *
 * Production: each route is either an api/ function file or a vercel.json
 * rewrite onto one (with `?op=` selecting the operation).
 * Development: src/setupProxy.js mounts every entry below on the dev server.
 *
 * server/routes.test.js fails if this table and vercel.json drift apart.
 */
const { handleSatflow, SATFLOW_OPERATIONS } = require('./satflow');
const { handleMagicEden, MAGIC_EDEN_ROUTES } = require('./magiceden');
const { handleUnisat } = require('./unisat');
const { handleOrdnet } = require('./ordnet');
const { handleHealth } = require('./health');

/** @type {{ path: string, handler: Function, query: Record<string, string> }[]} */
const DEV_ROUTES = [
  ...SATFLOW_OPERATIONS.map((op) => ({
    path: `/api/satflow-${op}`,
    handler: handleSatflow,
    query: { op },
  })),
  ...Object.entries(MAGIC_EDEN_ROUTES).map(([path, op]) => ({
    path,
    handler: handleMagicEden,
    query: { op },
  })),
  { path: '/api/satflow', handler: handleSatflow, query: {} },
  { path: '/api/magiceden', handler: handleMagicEden, query: {} },
  { path: '/api/unisat', handler: handleUnisat, query: {} },
  { path: '/api/ordnet', handler: handleOrdnet, query: {} },
  { path: '/api/health', handler: handleHealth, query: {} },
];

module.exports = { DEV_ROUTES };
