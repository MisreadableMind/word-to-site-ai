/**
 * Editor Service
 * Handles Light Editor vs Advanced Editor selection and capability testing
 */

import { config } from '../config.js';
import { EDITOR_MODES } from '../constants.js';

class EditorService {
  constructor(options = {}) {
    this.waasPluginPath = options.waasPluginPath || '/wp-json/waas-controller/v1';
    this.timeout = options.timeout || 10000;
  }

  /**
   * Test if Light Editor (chat interface) is viable for a site
   * @param {string} siteId - InstaWP site ID
   * @param {string} siteUrl - Site URL
   * @returns {Promise<Object>} Capability test result
   */
  async testLightEditorCapability(siteId, siteUrl) {
    const waasPluginUrl = this.buildWaasUrl(siteUrl);

    try {
      // Test 1: Check if WAAS Controller plugin is active and healthy
      const health = await this.checkPluginHealth(waasPluginUrl);

      if (!health.success) {
        return {
          viable: false,
          capabilities: [],
          fallbackReason: health.error || 'WAAS Controller plugin not responding',
        };
      }

      // Test 2: Get site map and available endpoints
      const siteMap = await this.getSiteMap(waasPluginUrl);

      if (!siteMap.success) {
        return {
          viable: false,
          capabilities: [],
          fallbackReason: siteMap.error || 'Could not retrieve site map',
        };
      }

      // Test 3: Check content editing capabilities
      const capabilities = this.extractCapabilities(siteMap.data);

      // Determine if Light Editor is viable based on capabilities
      const requiredCapabilities = ['read_content', 'edit_content', 'get_structure'];
      const hasRequired = requiredCapabilities.every(cap => capabilities.includes(cap));

      return {
        viable: hasRequired,
        capabilities,
        pluginVersion: health.version,
        fallbackReason: hasRequired ? null : 'Missing required capabilities for Light Editor',
      };
    } catch (error) {
      console.error('Light Editor capability test failed:', error.message);
      return {
        viable: false,
        capabilities: [],
        fallbackReason: error.message,
      };
    }
  }

  /**
   * Check WAAS Controller plugin health
   * @param {string} baseUrl - Plugin base URL
   * @returns {Promise<Object>} Health check result
   */
  async checkPluginHealth(baseUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: `Plugin health check failed: ${response.status}`,
        };
      }

      const data = await response.json();

      return {
        success: true,
        version: data.version || 'unknown',
        status: data.status || 'active',
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        return { success: false, error: 'Plugin health check timed out' };
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Get site map from WAAS Controller
   * @param {string} baseUrl - Plugin base URL
   * @returns {Promise<Object>} Site map result
   */
  async getSiteMap(baseUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${baseUrl}/site-map`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: `Site map request failed: ${response.status}`,
        };
      }

      const data = await response.json();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        return { success: false, error: 'Site map request timed out' };
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Extract capabilities from site map
   * @param {Object} siteMap - Site map data
   * @returns {string[]} List of capabilities
   */
  extractCapabilities(siteMap) {
    const capabilities = [];

    if (siteMap.endpoints) {
      // Check for content reading
      if (siteMap.endpoints.pages || siteMap.endpoints.posts) {
        capabilities.push('read_content');
      }

      // Check for content editing
      if (siteMap.endpoints.updatePage || siteMap.endpoints.updatePost) {
        capabilities.push('edit_content');
      }

      // Check for structure access
      if (siteMap.endpoints.menu || siteMap.endpoints.navigation) {
        capabilities.push('get_structure');
      }

      // Check for media handling
      if (siteMap.endpoints.media || siteMap.endpoints.uploadMedia) {
        capabilities.push('handle_media');
      }

      // Check for settings access
      if (siteMap.endpoints.settings) {
        capabilities.push('manage_settings');
      }

      // Check for theme customization
      if (siteMap.endpoints.customizer || siteMap.endpoints.theme) {
        capabilities.push('customize_theme');
      }
    }

    // Check for features array if present
    if (siteMap.features && Array.isArray(siteMap.features)) {
      capabilities.push(...siteMap.features);
    }

    return [...new Set(capabilities)]; // Remove duplicates
  }

  /**
   * Select editor mode with automatic fallback
   * @param {string} siteId - Site ID
   * @param {string} siteUrl - Site URL
   * @param {string} userPreference - User's preferred mode ('light' or 'advanced')
   * @param {Object} testResult - Previous capability test result (optional)
   * @returns {Promise<Object>} Editor selection result
   */
  async selectEditor(siteId, siteUrl, userPreference, testResult = null) {
    // If user explicitly wants Advanced Editor, give it to them
    if (userPreference === EDITOR_MODES.ADVANCED) {
      return {
        mode: EDITOR_MODES.ADVANCED,
        url: this.getWpAdminUrl(siteUrl),
        bounced: false,
        reason: 'User preference',
      };
    }

    // Test capabilities if not already done
    const capabilities = testResult || await this.testLightEditorCapability(siteId, siteUrl);

    // If Light Editor is viable, use it
    if (capabilities.viable) {
      return {
        mode: EDITOR_MODES.LIGHT,
        url: this.getLightEditorUrl(siteUrl),
        bounced: false,
        capabilities: capabilities.capabilities,
      };
    }

    // Bounce to Advanced Editor with notification
    return {
      mode: EDITOR_MODES.ADVANCED,
      url: this.getWpAdminUrl(siteUrl),
      bounced: true,
      reason: capabilities.fallbackReason || 'Light Editor not available for this site',
      notification: {
        type: 'info',
        title: 'Using Advanced Editor',
        message: `Light Editor is not available: ${capabilities.fallbackReason}. Opening WordPress Admin instead.`,
      },
    };
  }

  /**
   * Build WAAS Controller plugin URL
   * @param {string} siteUrl - Site base URL
   * @returns {string} WAAS plugin URL
   */
  buildWaasUrl(siteUrl) {
    const baseUrl = siteUrl.replace(/\/$/, '');
    return `${baseUrl}${this.waasPluginPath}`;
  }

  /**
   * Get WordPress Admin URL
   * @param {string} siteUrl - Site base URL
   * @returns {string} WP Admin URL
   */
  getWpAdminUrl(siteUrl) {
    const baseUrl = siteUrl.replace(/\/$/, '');
    return `${baseUrl}/wp-admin`;
  }

  /**
   * Get Light Editor URL
   * @param {string} siteUrl - Site base URL
   * @returns {string} Light Editor URL
   */
  getLightEditorUrl(siteUrl) {
    const baseUrl = siteUrl.replace(/\/$/, '');
    return `${baseUrl}/waas-editor`;
  }

  /**
   * Get editor options for UI
   * @param {Object} capabilities - Capability test result
   * @returns {Object[]} Editor options with availability
   */
  getEditorOptions(capabilities) {
    return [
      {
        id: EDITOR_MODES.LIGHT,
        label: 'Light Editor',
        description: 'Chat-based editing with voice support',
        available: capabilities?.viable || false,
        recommended: capabilities?.viable || false,
        unavailableReason: capabilities?.fallbackReason || null,
      },
      {
        id: EDITOR_MODES.ADVANCED,
        label: 'Advanced Editor',
        description: 'Full WordPress Admin access',
        available: true,
        recommended: !capabilities?.viable,
        unavailableReason: null,
      },
    ];
  }
}

export default EditorService;
