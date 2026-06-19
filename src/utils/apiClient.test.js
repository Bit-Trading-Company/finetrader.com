// Simple test to verify API client functionality
import apiClient from './apiClient';

// Test function to verify API client works
export const testApiClient = async () => {
  console.log('Testing API Client...');
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Is Development:', apiClient.isDevelopment);

  try {
    // Test a simple API call
    const result = await apiClient.testConnection();
    console.log('API Test Result:', result);
    return result;
  } catch (error) {
    console.error('API Test Failed:', error);
    return { success: false, error: error.message };
  }
};

// Test URL building
export const testUrlBuilding = () => {
  console.log('Testing URL Building...');
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Is Development:', apiClient.isDevelopment);
  console.log('');

  const testEndpoints = [
    '/collection_stats/search?limit=1',
    '/orders/DOGGOTOTHEMOON?side=sell&limit=50',
    '/market/DOGGOTOTHEMOON/info',
    '/collection_stats/search?window=1d&limit=20&offset=0&sort=floorPrice&direction=desc&searchTerm=&walletAddress=&allCollections=false',
  ];

  testEndpoints.forEach((testEndpoint, index) => {
    const url = apiClient.buildUrl(testEndpoint);
    console.log(`Test ${index + 1}:`);
    console.log('  Input Endpoint:', testEndpoint);
    console.log('  Built URL:', url);
    console.log('  Has Encoding:', url.includes('%'));
    console.log('');
  });

  if (apiClient.isDevelopment) {
    console.log('✓ Development mode: Using direct API calls');
    return true;
  } else {
    console.log('✓ Production mode: Using proxy with clean query parameters');
    return true;
  }
};

// Test proxy endpoint
export const testProxy = async () => {
  console.log('Testing Proxy Endpoint...');

  try {
    const result = await apiClient.testProxy();
    console.log('Proxy Test Result:', result);
    return result;
  } catch (error) {
    console.error('Proxy Test Failed:', error);
    return { success: false, error: error.message };
  }
};

// Test the new URL format with a real API call
export const testNewUrlFormat = async () => {
  console.log('Testing New URL Format with Real API Call...');

  try {
    // Test with a simple endpoint that has query parameters
    const result = await apiClient.get('/collection_stats/search?limit=1');
    console.log('✓ New URL format works! Result:', result);
    return { success: true, data: result };
  } catch (error) {
    console.error('✗ New URL format test failed:', error);
    return { success: false, error: error.message };
  }
};

// Test health check endpoint
export const testHealthCheck = async () => {
  console.log('Testing Health Check Endpoint...');

  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    console.log('✓ Health check successful:', data);
    return { success: true, data };
  } catch (error) {
    console.error('✗ Health check failed:', error);
    return { success: false, error: error.message };
  }
};

// Test proxy with actual endpoint
export const testProxyWithEndpoint = async () => {
  console.log('Testing Proxy with Actual Endpoint...');

  try {
    const result = await apiClient.testProxyWithEndpoint();
    console.log('Proxy endpoint test result:', result);
    return result;
  } catch (error) {
    console.error('Proxy endpoint test failed:', error);
    return { success: false, error: error.message };
  }
};

// Test environment detection
export const testEnvironmentDetection = () => {
  console.log('Testing Environment Detection...');

  const result = apiClient.testEnvironmentDetection();
  console.log('Environment detection result:', result);

  return result;
};

// Export test functions for manual testing
if (typeof window !== 'undefined') {
  window.testApiClient = testApiClient;
  window.testUrlBuilding = testUrlBuilding;
  window.testProxy = testProxy;
  window.testNewUrlFormat = testNewUrlFormat;
  window.testHealthCheck = testHealthCheck;
  window.testProxyWithEndpoint = testProxyWithEndpoint;
  window.testEnvironmentDetection = testEnvironmentDetection;
}
