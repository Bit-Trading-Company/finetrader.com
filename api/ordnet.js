const ORDNET_API_BASE = 'https://ord.net/api/v1';

function sendCors(res, methods) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With'
  );
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    sendCors(res, 'GET, POST, OPTIONS');
    res.status(200).end();
    return;
  }

  sendCors(res, 'GET, POST, OPTIONS');

  const rawPath = String(req.query.path || '');
  if (!rawPath || rawPath.includes('://') || rawPath.includes('..')) {
    res.status(400).json({ error: 'Invalid or missing ord.net path' });
    return;
  }

  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const upstreamUrl = new URL(`${ORDNET_API_BASE}${path}`);

  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path') continue;
    const values = Array.isArray(value) ? value : [value];
    values.forEach((v) => upstreamUrl.searchParams.append(key, String(v)));
  }

  try {
    const headers = {
      accept: 'application/json',
    };

    if (req.headers.authorization) {
      headers.authorization = req.headers.authorization;
    }

    let body;
    if (req.method !== 'GET') {
      headers['content-type'] = 'application/json';
      body =
        typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body || {});
    }

    const upstream = await fetch(upstreamUrl.toString(), {
      method: req.method,
      headers,
      body,
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') || 'application/json'
    );
    res.send(text);
  } catch (error) {
    console.error('ord.net proxy error:', error);
    res.status(500).json({
      error: 'ord.net proxy failed',
      message: error.message,
    });
  }
}
