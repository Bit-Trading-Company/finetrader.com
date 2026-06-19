// Vercel serverless function to proxy Magic Eden Collection Offers API
export default async function handler(req, res) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Referer');
    res.status(200).end();
    return;
  }

  // Only handle GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get query parameters
    // Vercel parses status[]=valid as req.query['status[]'] = 'valid'
    const collectionSymbol = req.query.collectionSymbol || req.query['collectionSymbol'];
    const sort = req.query.sort || req.query['sort'];
    const status = req.query['status[]'] || req.query.status || 'valid';
    const offset = req.query.offset || req.query['offset'] || '0';
    
    if (!collectionSymbol) {
      return res.status(400).json({ error: 'collectionSymbol parameter is required' });
    }

    // Build the target URL
    const baseUrl = 'https://api-mainnet.magiceden.us/v2/ord/btc/collection-offers/collection';
    const targetUrl = `${baseUrl}/${encodeURIComponent(collectionSymbol)}`;

    // Build query string manually to preserve status[] format
    const queryParams = [];
    if (sort) queryParams.push(`sort=${encodeURIComponent(sort)}`);
    queryParams.push(`status[]=${encodeURIComponent(status)}`);
    if (offset) queryParams.push(`offset=${encodeURIComponent(offset)}`);
    
    const fullUrl = queryParams.length > 0 
      ? `${targetUrl}?${queryParams.join('&')}`
      : targetUrl;

    // Prepare headers for the request
    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'Origin': 'https://magiceden.us',
      'Referer': 'https://magiceden.us/',
    };

    // Make the request to the target API
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers,
    });

    // Get the response data
    const data = await response.text();
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Referer');
    
    // Forward the status code
    res.status(response.status);
    
    // Try to parse as JSON, fallback to text
    try {
      const jsonData = JSON.parse(data);
      res.json(jsonData);
    } catch (parseError) {
      if (!response.ok) {
        res.status(response.status).json({
          error: 'Magic Eden API error',
          status: response.status,
          statusText: response.statusText,
          message: data,
        });
      } else {
        res.send(data);
      }
    }
    
  } catch (error) {
    console.error('Collection offers proxy error:', error);
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ 
      error: 'Proxy request failed', 
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}
