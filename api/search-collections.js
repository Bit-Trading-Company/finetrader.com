// Vercel serverless function to proxy Magic Eden Search API
export default async function handler(req, res) {
  console.log('=== SEARCH COLLECTIONS PROXY FUNCTION CALLED ===');
  console.log('Method:', req.method);
  console.log('Body:', req.body);
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================');

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
    // Get request body
    const { pattern, chains = ['bitcoin'], limit = 50, offset = 0 } = req.body;

    if (!pattern || !pattern.trim()) {
      return res.status(400).json({ error: 'Pattern parameter is required' });
    }

    // Build the target URL
    const targetUrl = 'https://api-mainnet.magiceden.us/v4/search/search';

    console.log('Target URL:', targetUrl);
    console.log('Request payload:', { pattern, chains, limit, offset });

    // Prepare headers for the request (matching Magic Eden's expected headers)
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'Origin': 'https://magiceden.us',
      'Referer': 'https://magiceden.us/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
    };

    // Prepare request body
    const requestBody = {
      pattern: pattern.trim(),
      chains: Array.isArray(chains) ? chains : [chains],
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    };

    // Make the request to the target API
    console.log('Making request to Magic Eden Search API:', {
      url: targetUrl,
      method: 'POST',
      headers: headers,
      body: requestBody,
    });

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    console.log('Magic Eden API response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error response:', errorText);
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    // Get the response data
    const data = await response.json();
    console.log('Successfully fetched search results');

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Referer');

    res.status(200).json(data);
  } catch (error) {
    console.error('Search collections proxy error:', error);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({
      error: 'Proxy request failed',
      message: error.message,
    });
  }
}
