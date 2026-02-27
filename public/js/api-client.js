/**
 * Shared API Client for FAQ Bot
 * Provides centralized error handling and header management for all API calls
 */
class ApiClient {
  constructor() {
    this.apiKey = null;
    this.baseUrl = '';
  }

  /**
   * Set the API key for all subsequent requests
   * @param {string} key - The x-api-key header value
   */
  setApiKey(key) {
    this.apiKey = key;
  }

  /**
   * Make a GET request
   * @param {string} endpoint - The API endpoint (e.g., '/metrics')
   * @returns {Promise<Object>} - Parsed JSON response
   * @throws {Error} - If response is not OK
   */
  async get(endpoint) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers,
      });

      if (!res.ok) {
        const errorText = await res.text();
        const error = new Error(`HTTP ${res.status}: ${errorText}`);
        error.status = res.status;
        console.error(`API GET error: ${error.message}`);
        throw error;
      }

      return await res.json();
    } catch (err) {
      console.error(`API GET failed for ${endpoint}:`, err);
      throw err;
    }
  }

  /**
   * Make a POST request
   * @param {string} endpoint - The API endpoint (e.g., '/search')
   * @param {Object} body - Request body
   * @returns {Promise<Object>} - Parsed JSON response
   * @throws {Error} - If response is not OK
   */
  async post(endpoint, body) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        const error = new Error(`HTTP ${res.status}: ${errorText}`);
        error.status = res.status;
        console.error(`API POST error: ${error.message}`);
        throw error;
      }

      return await res.json();
    } catch (err) {
      console.error(`API POST failed for ${endpoint}:`, err);
      throw err;
    }
  }
}

// Export a singleton instance
const apiClient = new ApiClient();

