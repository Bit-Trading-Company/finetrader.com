/**
 * Development API server.
 *
 * react-scripts calls this with the dev server's Express app. It mounts the
 * same handlers the Vercel functions in api/ use (route table: server/routes.js),
 * so every /api/* route behaves the same under `npm start` as in production.
 * API keys are read from .env (see .env.example).
 *
 * Changes to this file or server/ require restarting `npm start`.
 */
const express = require('express');
const { DEV_ROUTES } = require('../server/routes');

module.exports = function setupProxy(app) {
  const parseJson = express.json({ limit: '5mb' });
  const parseText = express.text({ type: 'text/*', limit: '5mb' });

  DEV_ROUTES.forEach(({ path, handler, query }) => {
    app.use(path, parseJson, parseText, (req, res, next) => {
      Object.assign(req.query, query);
      Promise.resolve(handler(req, res)).catch(next);
    });
  });
};
