/**
 * Server-side proxy: ordinals.com output metadata (inscriptions on an outpoint).
 * Browsers cannot call ordinals.com directly due to CORS; fee UTXO safety uses this route.
 *
 * GET /api/ordinals-output?txid=<64 hex>&vout=<n>
 * → https://ordinals.com/api/output/<txid>:<vout>
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With'
  );

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const txid = String(req.query.txid || '').trim();
  const voutRaw = req.query.vout;
  const vout =
    voutRaw === undefined || voutRaw === null
      ? NaN
      : parseInt(String(voutRaw), 10);

  if (!/^[0-9a-fA-F]{64}$/.test(txid)) {
    res.status(400).json({ error: 'Invalid txid' });
    return;
  }
  if (!Number.isInteger(vout) || vout < 0) {
    res.status(400).json({ error: 'Invalid vout' });
    return;
  }

  const upstreamUrl = `https://ordinals.com/api/output/${txid}:${vout}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'user-agent': 'Fine-Trading-App/1.0',
      },
    });

    const text = await upstream.text();
    const ct = upstream.headers.get('content-type') || 'application/json';

    if (!upstream.ok) {
      res.status(upstream.status).setHeader('Content-Type', ct).send(text);
      return;
    }

    res.setHeader('Content-Type', ct.includes('json') ? 'application/json' : ct);
    res.status(200).send(text);
  } catch (err) {
    console.error('[ordinals-output] proxy error:', err);
    res.status(502).json({
      error: 'Failed to fetch ordinals.com output',
      message: err && err.message ? String(err.message) : String(err),
    });
  }
}
