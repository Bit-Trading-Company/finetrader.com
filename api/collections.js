// Vercel serverless function to proxy Magic Eden Collections API with caching
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds

// Simple in-memory cache
const cache = new Map();

// Clean up old cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
}, 60000); // Clean up every minute

export default async function handler(req, res) {
  console.log('=== COLLECTIONS PROXY FUNCTION CALLED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Query:', req.query);
  console.log('Timestamp:', new Date().toISOString());
  console.log('==========================================');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.status(200).end();
    return;
  }

  // Only handle GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get query parameters
    const { endpoint, ...otherParams } = req.query;
    
    // Build cache key from query parameters
    const cacheKey = JSON.stringify({ endpoint, ...otherParams });
    
    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('Serving from cache');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached.data);
    }
    
    console.log('Cache miss or expired, fetching from API');
    
    // Build the target URL
    const baseUrl = 'https://api-mainnet.magiceden.dev/collection_stats/search/bitcoin';
    
    // Build query string from otherParams
    const queryParams = [];
    for (const [key, value] of Object.entries(otherParams)) {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.push(`${key}=${encodeURIComponent(value)}`);
      }
    }
    
    let targetUrl = baseUrl;
    if (queryParams.length > 0) {
      targetUrl += `?${queryParams.join('&')}`;
    }
    
    console.log('Target URL:', targetUrl);

    // Prepare headers for the request
    const headers = {
      'User-Agent': 'Fine-Trading-App/1.0',
      'Accept': 'application/json',
    };

    // Use environment variable API key if available
    if (process.env.MAGIC_EDEN_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.MAGIC_EDEN_API_KEY}`;
    } else {
      // Fallback to hardcoded API key if no environment variable is set
      headers['Authorization'] = 'Bearer 93d5a8eb-be8e-4c68-9bdf-12655672928d';
    }

    // Make the request to the target API
    console.log('Making request to Magic Eden Collections API:', {
      url: targetUrl,
      method: req.method,
      headers: headers
    });
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
    });

    console.log('Magic Eden API response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    // Get the response data
    const data = await response.json();
    console.log('Successfully fetched collections data');
    
    // Store in cache
    cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('X-Cache', 'MISS');
    
    res.status(200).json(data);
    
  } catch (error) {
    console.error('Collections proxy error:', error);
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ 
      error: 'Proxy request failed', 
      message: error.message 
    });
  }
}











