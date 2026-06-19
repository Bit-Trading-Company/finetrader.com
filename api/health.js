// Health check endpoint to verify API routes are working
export default async function handler(req, res) {
  console.log('Health check endpoint called:', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  res.status(200).json({
    status: 'healthy',
    message: 'API routes are working correctly',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    hasApiKey: !!process.env.MAGIC_EDEN_API_KEY
  });
}
