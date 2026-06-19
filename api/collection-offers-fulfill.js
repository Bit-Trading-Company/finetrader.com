// Vercel serverless function to proxy Magic Eden Collection Offers Fulfill PSBT API
export default async function handler(req, res) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Referer');
    res.status(200).end();
    return;
  }

  // Only handle POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Build the target URL
    const baseUrl = 'https://api-mainnet.magiceden.us/v2/ord/btc/collection-offers/psbt/fulfill';

    // Parse request body
    let bodyString = null;
    
    if (req.body) {
      if (typeof req.body === 'string') {
        bodyString = req.body;
      } else if (typeof req.body === 'object') {
        bodyString = JSON.stringify(req.body);
      } else {
        bodyString = String(req.body);
      }
    }

    if (!bodyString || bodyString.length === 0) {
      return res.status(400).json({ 
        error: 'Request body is required',
      });
    }

    // Prepare headers for the request
    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      'Origin': 'https://magiceden.us',
      'Referer': 'https://magiceden.us/',
    };

    // Make the request to the target API
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: bodyString,
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
    console.error('Collection offers fulfill proxy error:', error);
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ 
      error: 'Proxy request failed', 
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}
