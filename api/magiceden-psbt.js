// Vercel serverless function to proxy Magic Eden PSBT API requests and handle CORS
export default async function handler(req, res) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Referer');
    res.status(200).end();
    return;
  }

  try {
    // Get the endpoint from query parameter
    const { endpoint } = req.query;
    
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint parameter is required' });
    }

    // Validate endpoint to prevent SSRF attacks
    const allowedEndpoints = [
      'get_sweeping',
      'sweeping',
      'get_batch_listing',
      'batch_listing',
    ];
    if (!allowedEndpoints.includes(endpoint)) {
      return res.status(400).json({ error: 'Invalid endpoint' });
    }

    // Build the full Magic Eden API URL
    const baseUrl = 'https://api-mainnet.magiceden.us/v2/ord/btc/psbt';
    const targetUrl = `${baseUrl}/${endpoint}`;

    // Prepare headers for the request
    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json;charset=UTF-8',
      'Origin': 'https://magiceden.us',
      'Referer': 'https://magiceden.us/',
    };

    // Parse request body - Vercel may not auto-parse large bodies, so handle raw body
    let bodyString = null;
    
    if (req.method === 'POST') {
      // Log what we received for debugging
      console.log('Request body type:', typeof req.body);
      console.log('Request body keys:', req.body ? Object.keys(req.body).slice(0, 5) : 'no body');
      console.log('Request headers:', req.headers['content-type']);
      
      // Check if body exists and handle different formats
      if (req.body) {
        // If body is already a string (raw JSON string from fetch), use it directly
        if (typeof req.body === 'string') {
          bodyString = req.body;
          console.log('Using body as string, length:', bodyString.length);
        }
        // If body is already an object (Vercel auto-parsed), stringify it
        else if (typeof req.body === 'object') {
          // Stringify with no spaces to match original format
          bodyString = JSON.stringify(req.body);
          console.log('Stringified body object, length:', bodyString.length);
          // Log a sample of the body to verify structure
          console.log('Body sample (first 200 chars):', bodyString.substring(0, 200));
          // Log key fields to verify they're present
          if (req.body.signedFundsPreparationPSBTBase64) {
            console.log('Has signedFundsPreparationPSBTBase64:', req.body.signedFundsPreparationPSBTBase64.substring(0, 50) + '...');
          }
          if (req.body.unsignedFundsPreparationPSBTBase64) {
            console.log('Has unsignedFundsPreparationPSBTBase64:', req.body.unsignedFundsPreparationPSBTBase64.substring(0, 50) + '...');
          }
        }
        // For other types, convert to string
        else {
          bodyString = String(req.body);
          console.log('Converted body to string, length:', bodyString.length);
        }
      } else {
        console.log('No body received in req.body');
      }
    }

    // Make the request to the target API
    const fetchOptions = {
      method: req.method,
      headers,
    };

    // Add body for POST requests (only if we have a valid body)
    if (req.method === 'POST') {
      if (!bodyString || bodyString.length === 0) {
        console.error('No valid body string found for POST request');
        return res.status(400).json({ 
          error: 'Request body is required',
          receivedBodyType: typeof req.body,
          hasBody: !!req.body,
        });
      }
      
      // For sweeping endpoint, validate required fields
      if (endpoint === 'sweeping' && typeof req.body === 'object') {
        const requiredFields = [
          'buyerAddress',
          'buyerPublicKey',
          'signedFundsPreparationPSBTBase64',
          'unsignedFundsPreparationPSBTBase64',
        ];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        if (missingFields.length > 0) {
          console.error('Missing required fields for sweeping:', missingFields);
          return res.status(400).json({
            error: 'Missing required fields',
            missingFields: missingFields,
          });
        }
        
        // Validate PSBT fields are not empty
        if (!req.body.signedFundsPreparationPSBTBase64 || req.body.signedFundsPreparationPSBTBase64.length === 0) {
          console.error('signedFundsPreparationPSBTBase64 is empty');
          return res.status(400).json({
            error: 'signedFundsPreparationPSBTBase64 is required and cannot be empty',
          });
        }
      }
      
      fetchOptions.body = bodyString;
    }

    // Log request details for debugging
    console.log('Making request to Magic Eden:', {
      url: targetUrl,
      method: req.method,
      hasBody: !!bodyString,
      bodyLength: bodyString ? bodyString.length : 0,
    });

    const response = await fetch(targetUrl, fetchOptions);

    // Get the response data
    const data = await response.text();
    
    // Log response for debugging (including full error message)
    console.log('Magic Eden response:', {
      status: response.status,
      statusText: response.statusText,
      dataLength: data.length,
      data: data, // Log the actual response data
    });
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Referer');
    
    // Forward the status code
    res.status(response.status);
    
    // Try to parse as JSON, fallback to text
    try {
      const jsonData = JSON.parse(data);
      // Forward the response as-is (including error responses from Magic Eden)
      // If it's an error response, log it for debugging
      if (!response.ok) {
        console.error('Magic Eden API error (JSON):', JSON.stringify(jsonData, null, 2));
      }
      res.json(jsonData);
    } catch (parseError) {
      // If status is not OK, log the error and forward it
      if (!response.ok) {
        console.error('Magic Eden API error response (not JSON):', data);
        // Try to send as JSON with error details, but if that fails, send as text
        try {
          res.status(response.status).json({
            error: 'Magic Eden API error',
            status: response.status,
            statusText: response.statusText,
            message: data,
          });
        } catch (e) {
          res.status(response.status).send(data);
        }
      } else {
        res.send(data);
      }
    }
    
  } catch (error) {
    console.error('Magic Eden PSBT proxy error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      endpoint: req.query.endpoint,
      method: req.method,
    });
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ 
      error: 'Proxy request failed', 
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}

