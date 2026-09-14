/**
 * Server-side configuration. API keys come only from environment variables:
 * `.env` in local development (loaded by react-scripts before src/setupProxy.js
 * runs) and the Vercel project settings in production. See .env.example.
 */

const warnedMissing = new Set();

const warnMissingOnce = (name) => {
  if (warnedMissing.has(name)) return;
  warnedMissing.add(name);
  console.warn(
    `[api] ${name} is not set; upstream requests will be unauthenticated. See .env.example.`
  );
};

/**
 * Normalize an API key pasted into an env file: strips quotes, a "Bearer "
 * prefix, placeholder values, and an accidental double paste.
 * @param {string|undefined} raw
 * @returns {string|null}
 */
function normalizeApiKey(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  if (key.toLowerCase().startsWith('bearer ')) {
    key = key.slice(7).trim();
  }
  if (!key || key.includes('your_') || key === 'paste') {
    return null;
  }
  if (key.length >= 2 && key.length % 2 === 0) {
    const half = key.length / 2;
    if (key.slice(0, half) === key.slice(half)) return key.slice(0, half);
  }
  return key;
}

const readApiKey = (name) => {
  const key = normalizeApiKey(process.env[name]);
  if (!key) warnMissingOnce(name);
  return key;
};

const getSatflowApiKey = () => readApiKey('SATFLOW_API_KEY');
const getUnisatApiKey = () => readApiKey('UNISAT_API_KEY');

module.exports = {
  normalizeApiKey,
  getSatflowApiKey,
  getUnisatApiKey,
};
