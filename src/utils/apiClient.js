// API Client utility for making API calls

class ApiClient {
  constructor() {
    // Base URL for MagicEden API
    this.baseUrl = 'https://api-mainnet.magiceden.dev/v2/ord/btc/runes';

    // Determine if we're in development or production
    // Check multiple ways to detect development mode
    this.isDevelopment =
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === 'dev' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('localhost');

    // API key for MagicEden - only used in development mode
    // In production, the proxy will use its own API key
    this.apiKey = '93d5a8eb-be8e-4c68-9bdf-12655672928d';

    console.log('API Client initialized:', {
      isDevelopment: this.isDevelopment,
      hostname: window.location.hostname,
      nodeEnv: process.env.NODE_ENV,
    });
  }

  // Build the URL - use proxy in production, direct calls in development
  buildUrl(endpoint) {
    if (this.isDevelopment) {
      // Use direct calls in development
      return `${this.baseUrl}${endpoint}`;
    } else {
      // Use proxy in production to avoid CORS issues
      // Parse the endpoint to separate path and query parameters
      const [path, queryString] = endpoint.split('?');

      // Build the proxy URL with clean parameters
      let proxyUrl = `/api/proxy?endpoint=${path}`;

      if (queryString) {
        // Add the original query string directly without re-encoding
        proxyUrl += `&${queryString}`;
      }

      return proxyUrl;
    }
  }

  // Get headers for API requests
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    // Only add Authorization header in development mode
    // In production, the proxy will use its own API key
    if (this.isDevelopment) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  // Make a GET request with proper headers and error handling
  async get(endpoint, options = {}) {
    const url = this.buildUrl(endpoint);

    const requestOptions = {
      method: 'GET',
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
      ...options,
    };

    try {
      console.log('Making API request to:', url);
      console.log('Request options:', requestOptions);
      console.log('Environment:', process.env.NODE_ENV);
      console.log('Is development:', this.isDevelopment);

      const response = await fetch(url, requestOptions);

      console.log('Response received:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API request failed with status:', response.status);
        console.error('Error response:', errorText);
        throw new Error(
          `HTTP error! status: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      console.log('API request successful, data received:', data);
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      console.error('Request URL was:', url);
      throw error;
    }
  }

  // Make a POST request with proper headers and error handling
  async post(endpoint, body, options = {}) {
    const url = this.buildUrl(endpoint);

    const requestOptions = {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
      body: JSON.stringify(body),
      ...options,
    };

    try {
      console.log('Making API POST request to:', url);
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API POST request failed:', error);
      throw error;
    }
  }

  // Test the API connection
  async testConnection() {
    try {
      const data = await this.get('/collection_stats/search?limit=1');
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Test the proxy endpoint specifically
  async testProxy() {
    try {
      console.log('Testing proxy endpoint...');
      const response = await fetch('/api/health');
      const data = await response.json();
      console.log('Proxy test result:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Proxy test failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Test the actual proxy function with a simple endpoint
  async testProxyWithEndpoint() {
    try {
      console.log('Testing proxy with endpoint...');
      const testUrl = '/api/proxy?endpoint=/collection_stats/search&limit=1';
      console.log('Testing URL:', testUrl);

      const response = await fetch(testUrl);
      console.log('Response status:', response.status);
      console.log(
        'Response headers:',
        Object.fromEntries(response.headers.entries())
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Proxy endpoint test failed:', errorText);
        return { success: false, error: errorText };
      }

      const data = await response.json();
      console.log('Proxy endpoint test result:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Proxy endpoint test failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Test environment detection
  testEnvironmentDetection() {
    console.log('=== Environment Detection Test ===');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('Hostname:', window.location.hostname);
    console.log('Is Development:', this.isDevelopment);
    console.log('Headers being sent:', this.getHeaders());
    console.log('Sample URL:', this.buildUrl('/test'));
    console.log('==================================');

    return {
      nodeEnv: process.env.NODE_ENV,
      hostname: window.location.hostname,
      isDevelopment: this.isDevelopment,
      headers: this.getHeaders(),
      sampleUrl: this.buildUrl('/test'),
    };
  }
}

// Create and export a singleton instance
const apiClient = new ApiClient();
export default apiClient;
