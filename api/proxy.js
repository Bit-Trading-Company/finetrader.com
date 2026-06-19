// Vercel serverless function to proxy API requests and handle CORS
export default async function handler(req, res) {
  console.log('=== PROXY FUNCTION CALLED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Query:', req.query);
  console.log('Headers:', req.headers);
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.status(200).end();
    return;
  }

  try {
    // Get the endpoint and other query parameters
    const { endpoint, ...otherParams } = req.query;
    
    console.log('Query parameters received:', req.query);
    console.log('Endpoint received:', endpoint);
    console.log('Other parameters:', otherParams);
    
    if (!endpoint) {
      console.log('No endpoint provided');
      return res.status(400).json({ error: 'Endpoint parameter is required' });
    }

    // Build the full Magic Eden API URL
    const baseUrl = 'https://api-mainnet.magiceden.dev/v2/ord/btc/runes';
    
    // Build the target URL by combining endpoint with other parameters
    let targetUrl = `${baseUrl}${endpoint}`;
    
    // Add other parameters as query string
    const queryParams = [];
    for (const [key, value] of Object.entries(otherParams)) {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.push(`${key}=${encodeURIComponent(value)}`);
      }
    }
    
    if (queryParams.length > 0) {
      targetUrl += `?${queryParams.join('&')}`;
    }
    
    console.log('Target URL:', targetUrl);

    // Prepare headers for the request
    const headers = {
      'User-Agent': 'Fine-Trading-App/1.0',
      'Accept': 'application/json',
    };

    // Use environment variable API key if no authorization header is provided
    // This allows the proxy to work with a default API key for development
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    } else if (process.env.MAGIC_EDEN_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.MAGIC_EDEN_API_KEY}`;
    } else {
      // Fallback to hardcoded API key if no environment variable is set
      headers['Authorization'] = 'Bearer 93d5a8eb-be8e-4c68-9bdf-12655672928d';
    }

    // Forward content-type header if present
    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'];
    }

    // Make the request to the target API
    console.log('Making request to Magic Eden API:', {
      url: targetUrl,
      method: req.method,
      headers: headers
    });
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    console.log('Magic Eden API response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    // Get the response data
    const data = await response.text();
    console.log('Response data length:', data.length);
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    // Forward the status code
    res.status(response.status);
    
    // Try to parse as JSON, fallback to text
    try {
      const jsonData = JSON.parse(data);
      console.log('Successfully parsed JSON response');
      res.json(jsonData);
    } catch (parseError) {
      console.log('Failed to parse JSON, sending as text:', parseError.message);
      res.send(data);
    }
    
  } catch (error) {
    console.error('Proxy error:', error);
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ 
      error: 'Proxy request failed', 
      message: error.message 
    });
  }
}