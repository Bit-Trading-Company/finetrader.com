/**
 * Normalize UNISAT_API_KEY from env (dev proxy + Vercel use the same rules).
 * @param {string|undefined} raw
 * @returns {string|null}
 */
function normalizeUnisatApiKey(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  if (trimmed.toLowerCase().startsWith('bearer ')) {
    trimmed = trimmed.slice(7).trim();
  }
  if (!trimmed || trimmed.includes('your_') || trimmed === 'paste') {
    return null;
  }

  // Accidental double-paste (same token concatenated twice) → invalid token upstream
  if (trimmed.length >= 2 && trimmed.length % 2 === 0) {
    const half = trimmed.length / 2;
    const a = trimmed.slice(0, half);
    const b = trimmed.slice(half);
    if (a === b) return a;
  }

  return trimmed;
}

function getUnisatApiKeyFromEnv() {
  return normalizeUnisatApiKey(process.env.UNISAT_API_KEY);
}

module.exports = {
  normalizeUnisatApiKey,
  getUnisatApiKeyFromEnv,
};
