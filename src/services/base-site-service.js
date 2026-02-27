/**
 * Base Site Service
 * Fetches skins and languages from the TRXWaaSWizard plugin on the base site.
 * Uses in-memory TTL cache to avoid excessive API calls.
 */

import { config } from '../config.js';

const DEFAULT_CACHE_TTL = 60 * 60 * 1000; // 1 hour

class BaseSiteService {
  /**
   * @param {Object} options
   * @param {string} options.url - Base site URL
   * @param {string} options.username - WP username
   * @param {string} options.appPassword - WP application password (may contain spaces)
   * @param {number} [options.cacheTtl] - Cache TTL in milliseconds
   */
  constructor(options = {}) {
    const opts = {
      url: options.url || config.baseSite.url,
      username: options.username || config.baseSite.username,
      appPassword: options.appPassword || config.baseSite.appPassword,
      cacheTtl: options.cacheTtl || DEFAULT_CACHE_TTL,
    };

    this.siteUrl = opts.url.replace(/\/+$/, '');
    this.username = opts.username;
    this.appPassword = opts.appPassword;
    this.cacheTtl = opts.cacheTtl;
    this.cache = new Map();
  }

  /**
   * Build Authorization header
   * Application passwords have spaces stripped for Basic auth.
   * @returns {string}
   */
  get authHeader() {
    const password = this.appPassword.replaceAll(' ', '');
    const credentials = Buffer.from(`${this.username}:${password}`).toString('base64');
    return `Basic ${credentials}`;
  }

  /**
   * Make an authenticated request to the base site REST API
   * @param {string} endpoint - Full path after /wp-json/
   * @param {Object} [options] - Fetch options
   * @returns {Promise<Object>}
   */
  async request(endpoint, options = {}) {
    const url = `${this.siteUrl}/wp-json/${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.message || `Base site API error: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Get cached data or fetch fresh
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Async function to fetch data
   * @returns {Promise<*>}
   */
  async getCached(key, fetchFn) {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    const data = await fetchFn();
    this.cache.set(key, { data, expiry: Date.now() + this.cacheTtl });
    return data;
  }

  /**
   * Fetch available skins (templates) from the TRXWaaSWizard plugin
   * @returns {Promise<Object[]>}
   */
  async getSkins() {
    return this.getCached('skins', () =>
      this.request('trx_waas_wizard/v1/skins')
    );
  }

  /**
   * Fetch available languages from the TRXWaaSWizard plugin
   * @returns {Promise<Object[]>}
   */
  async getLanguages() {
    return this.getCached('languages', () =>
      this.request('trx_waas_wizard/v1/languages')
    );
  }

  /**
   * Clear the in-memory cache
   */
  clearCache() {
    this.cache.clear();
  }
}

export default BaseSiteService;
