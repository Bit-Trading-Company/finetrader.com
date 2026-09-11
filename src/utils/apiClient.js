/**
 * Client for the Magic Eden runes API, used by the runes panels.
 *
 * Every request goes through the same-origin `/api/proxy` route
 * (server/magiceden.js), which adds the API key server-side, in both
 * development and production.
 */
class ApiClient {
  /**
   * Proxy URL for a runes endpoint.
   * @param {string} endpoint e.g. "/market/SYMBOL/info" or "/collection_stats/search?limit=20"
   */
  buildUrl(endpoint) {
    const [path, queryString] = String(endpoint).split('?');
    const url = `/api/proxy?endpoint=${encodeURIComponent(path)}`;
    return queryString ? `${url}&${queryString}` : url;
  }

  async request(endpoint, { method = 'GET', body, headers, ...options } = {}) {
    const response = await fetch(this.buildUrl(endpoint), {
      ...options,
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    return response.json();
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }
}

const apiClient = new ApiClient();
export default apiClient;
