/**
 * Health check: confirms the API layer is reachable and which upstream API
 * keys are configured (never their values).
 */
const http = require('./lib/http');

async function handleHealth(req, res) {
  if (http.handlePreflight(req, res, 'GET, OPTIONS')) return;

  const configured = (name) => Boolean(process.env[name]);
  res.status(200).json({
    status: 'healthy',
    message: 'API routes are working correctly',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    apiKeys: {
      satflow: configured('SATFLOW_API_KEY'),
      unisat: configured('UNISAT_API_KEY'),
    },
  });
}

module.exports = { handleHealth };
