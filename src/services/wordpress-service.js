/**
 * WordPress REST API Service
 * Interacts with deployed WordPress sites via WP REST API using basic auth
 */

import pRetry, { AbortError } from 'p-retry';

const TRANSIENT_NETWORK_CODES = new Set(['ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN']);
const isTransientNetworkError = (err) =>
  TRANSIENT_NETWORK_CODES.has(err?.cause?.code) ||
  (err?.message === 'fetch failed' && !err?.cause);

class WordPressService {
  /**
   * @param {string} siteUrl - WordPress site URL (e.g., https://example.com)
   * @param {Object} auth - Authentication credentials
   * @param {string} auth.username - WP admin username
   * @param {string} auth.password - WP admin password
   */
  constructor(siteUrl, auth) {
    this.siteUrl = siteUrl.replace(/\/+$/, '');
    this.auth = auth;
    this.apiBase = `${this.siteUrl}/wp-json/wp/v2`;
  }

  /**
   * Build Authorization header for basic auth
   * @returns {string} Basic auth header value
   */
  get authHeader() {
    // Strip spaces from password — WP Application Passwords contain spaces for readability
    const password = this.auth.password.replace(/ /g, '');
    const credentials = Buffer.from(`${this.auth.username}:${password}`).toString('base64');
    return `Basic ${credentials}`;
  }

  /**
   * Make an authenticated request to the WP REST API
   * @param {string} endpoint - API endpoint path (relative to /wp-json/wp/v2)
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Response data
   */
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${this.apiBase}${endpoint}`;

    return pRetry(
      async () => {
        let response;
        try {
          response = await fetch(url, {
            ...options,
            headers: {
              'Authorization': this.authHeader,
              'Content-Type': 'application/json',
              ...options.headers,
            },
          });
        } catch (err) {
          if (isTransientNetworkError(err)) throw err;
          throw new AbortError(err);
        }

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          if (response.status === 401 || response.status === 403) {
            console.error(
              `[WP REST ${response.status}] ${url} — code="${body.code ?? ''}" message="${body.message ?? ''}" data=${JSON.stringify(body.data ?? {})}`,
            );
          }
          throw new AbortError(
            new Error(body.message || `WP REST API error: ${response.status} ${response.statusText}`),
          );
        }
        return response.json();
      },
      { retries: 2, factor: 2, minTimeout: 2000, maxTimeout: 5000 },
    );
  }

  /**
   * Make an authenticated request to arbitrary WP REST endpoints
   * @param {string} path - Full path after /wp-json/ (e.g., "wp/v2/settings")
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Response data
   */
  async requestRaw(path, options = {}) {
    const url = `${this.siteUrl}/wp-json/${path}`;
    return this.request(url, options);
  }

  // ==========================================
  // Site Settings
  // ==========================================

  /**
   * Update site settings (title, tagline, favicon)
   * @param {Object} settings
   * @param {string} [settings.title] - Site title
   * @param {string} [settings.tagline] - Site tagline/description
   * @param {number} [settings.siteIcon] - Media attachment ID for site icon
   * @returns {Promise<Object>} Updated settings
   */
  async updateSiteSettings(settings) {
    const body = {};
    if (settings.title !== undefined) body.title = settings.title;
    if (settings.tagline !== undefined) body.description = settings.tagline;
    if (settings.siteIcon !== undefined) body.site_icon = settings.siteIcon;

    return this.requestRaw('wp/v2/settings', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // ==========================================
  // Pages
  // ==========================================

  /**
   * Create a WordPress page
   * @param {Object} page
   * @param {string} page.title - Page title
   * @param {string} page.content - Page HTML content
   * @param {string} [page.slug] - URL slug
   * @param {string} [page.status] - Page status (publish, draft, etc.)
   * @returns {Promise<Object>} Created page data
   */
  async createPage(page) {
    return this.request('/pages', {
      method: 'POST',
      body: JSON.stringify({
        title: page.title,
        content: page.content,
        slug: page.slug || undefined,
        status: page.status || 'publish',
      }),
    });
  }

  /**
   * Update an existing WordPress page
   * @param {number} pageId - Page ID
   * @param {Object} updates
   * @param {string} [updates.title] - Page title
   * @param {string} [updates.content] - Page HTML content
   * @returns {Promise<Object>} Updated page data
   */
  async updatePage(pageId, updates) {
    const body = {};
    if (updates.title !== undefined) body.title = updates.title;
    if (updates.content !== undefined) body.content = updates.content;
    if (updates.slug !== undefined) body.slug = updates.slug;
    if (updates.status !== undefined) body.status = updates.status;

    return this.request(`/pages/${pageId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get all pages
   * @param {Object} [params] - Query parameters
   * @returns {Promise<Object[]>} Array of pages
   */
  async getPages(params = {}) {
    const query = new URLSearchParams({
      per_page: String(params.perPage || 100),
      status: params.status || 'publish,draft',
      ...params,
    });
    return this.request(`/pages?${query}`);
  }

  // ==========================================
  // Posts
  // ==========================================

  /**
   * Create a WordPress post
   * @param {Object} post
   * @param {string} post.title - Post title
   * @param {string} post.content - Post HTML content
   * @param {string} [post.excerpt] - Post excerpt
   * @param {string} [post.status] - Post status
   * @returns {Promise<Object>} Created post data
   */
  async createPost(post) {
    return this.request('/posts', {
      method: 'POST',
      body: JSON.stringify({
        title: post.title,
        content: post.content,
        excerpt: post.excerpt || undefined,
        status: post.status || 'publish',
      }),
    });
  }

  // ==========================================
  // Media
  // ==========================================

  /**
   * Upload media from a URL (downloads and re-uploads to WP)
   * @param {string} imageUrl - URL of the image to upload
   * @param {string} [filename] - Optional filename
   * @returns {Promise<Object>} Uploaded media data (includes .id for site icon)
   */
  async uploadMediaFromUrl(imageUrl, filename) {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const buffer = await response.arrayBuffer();
    const ext = contentType.split('/')[1]?.split(';')[0] || 'png';
    const name = filename || `upload-${Date.now()}.${ext}`;

    const uploadResponse = await fetch(`${this.apiBase}/media`, {
      method: 'POST',
      headers: {
        'Authorization': this.authHeader,
        'Content-Disposition': `attachment; filename="${name}"`,
        'Content-Type': contentType,
      },
      body: Buffer.from(buffer),
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json().catch(() => ({}));
      throw new Error(error.message || `Media upload failed: ${uploadResponse.status}`);
    }

    return uploadResponse.json();
  }

  // ==========================================
  // Plugins
  // ==========================================

  /**
   * Install and activate a plugin by slug
   * @param {string} pluginSlug - WordPress.org plugin slug
   * @returns {Promise<Object>} Plugin data
   */
  async installPlugin(pluginSlug) {
    try {
      // Try to install the plugin
      const installed = await this.requestRaw('wp/v2/plugins', {
        method: 'POST',
        body: JSON.stringify({
          slug: pluginSlug,
          status: 'active',
        }),
      });
      return installed;
    } catch (error) {
      // Plugin might already be installed, try to activate it
      if (error.message.includes('already installed') || error.message.includes('exists')) {
        return this.activatePlugin(pluginSlug);
      }
      throw error;
    }
  }

  /**
   * Activate an already-installed plugin
   * @param {string} pluginSlug - Plugin slug (directory/file format)
   * @returns {Promise<Object>} Plugin data
   */
  async activatePlugin(pluginSlug) {
    // WP REST API plugin endpoint expects "plugin-dir/plugin-file" format
    // Try common pattern: slug/slug.php
    const pluginPath = `${pluginSlug}/${pluginSlug}`;
    return this.requestRaw(`wp/v2/plugins/${encodeURIComponent(pluginPath)}`, {
      method: 'POST',
      body: JSON.stringify({ status: 'active' }),
    });
  }

  // ==========================================
  // Customizer / Theme Settings
  // ==========================================

  /**
   * Update theme customizer settings
   * Uses the WP REST API settings endpoint for supported values,
   * or custom theme mod endpoints if available.
   * @param {Object} settings - Customizer settings
   * @param {string} [settings.primaryColor] - Primary brand color
   * @param {string} [settings.logoUrl] - Logo image URL
   * @returns {Promise<Object>} Result
   */
  async updateCustomizer(settings) {
    const results = {};

    // Upload and set logo if provided
    if (settings.logoUrl) {
      try {
        const media = await this.uploadMediaFromUrl(settings.logoUrl, 'site-logo.png');
        await this.requestRaw('wp/v2/settings', {
          method: 'POST',
          body: JSON.stringify({ site_logo: media.id }),
        });
        results.logo = { success: true, mediaId: media.id };
      } catch (error) {
        console.warn('Failed to set site logo:', error.message);
        results.logo = { success: false, error: error.message };
      }
    }

    // Upload and set favicon if provided
    if (settings.faviconUrl) {
      try {
        const media = await this.uploadMediaFromUrl(settings.faviconUrl, 'site-icon.png');
        await this.updateSiteSettings({ siteIcon: media.id });
        results.favicon = { success: true, mediaId: media.id };
      } catch (error) {
        console.warn('Failed to set site icon:', error.message);
        results.favicon = { success: false, error: error.message };
      }
    }

    // Note: Primary/secondary color requires theme-specific API or custom CSS
    // Most themes expose color settings via their own REST endpoints
    if (settings.primaryColor) {
      try {
        // Try setting via custom CSS as a fallback
        await this.injectCustomCss(`:root { --primary-color: ${settings.primaryColor}; }`);
        results.primaryColor = { success: true, method: 'custom_css' };
      } catch (error) {
        console.warn('Failed to set primary color:', error.message);
        results.primaryColor = { success: false, error: error.message };
      }
    }

    return results;
  }

  /**
   * Inject custom CSS into the site
   * @param {string} css - CSS string
   * @returns {Promise<Object>} Result
   */
  async injectCustomCss(css) {
    // WP stores custom CSS as a custom_css custom post type
    // First check if a custom CSS post exists
    const existing = await this.requestRaw(
      `wp/v2/types/custom_css`,
      { method: 'GET' }
    ).catch(() => null);

    if (!existing) {
      // Custom CSS type not available; skip
      return { success: false, reason: 'custom_css post type not available' };
    }

    // Get existing custom CSS posts
    const posts = await this.request('/posts?type=custom_css&per_page=1').catch(() => []);

    if (posts.length > 0) {
      // Append to existing
      const current = posts[0].content?.rendered || '';
      return this.request(`/posts/${posts[0].id}`, {
        method: 'POST',
        body: JSON.stringify({
          content: current + '\n' + css,
        }),
      });
    }

    // If no endpoint available, just log
    console.log('Custom CSS injection: endpoint not available, skipping');
    return { success: true, note: 'Custom CSS may need manual application' };
  }

  // ==========================================
  // Homepage Setup
  // ==========================================

  /**
   * Set a page as the static front page
   * @param {number} pageId - Page ID to set as front page
   * @returns {Promise<Object>} Updated settings
   */
  async setFrontPage(pageId) {
    return this.requestRaw('wp/v2/settings', {
      method: 'POST',
      body: JSON.stringify({
        show_on_front: 'page',
        page_on_front: pageId,
      }),
    });
  }

  /**
   * Set permalink structure
   * @param {string} structure - Permalink structure (e.g., "/%postname%/")
   * @returns {Promise<Object>} Updated settings
   */
  async setPermalinkStructure(structure = '/%postname%/') {
    return this.requestRaw('wp/v2/settings', {
      method: 'POST',
      body: JSON.stringify({
        permalink_structure: structure,
      }),
    });
  }
  // ==========================================
  // WaaS Wizard Registration
  // ==========================================

  /**
   * Register the site with the TRX WaaS Wizard plugin so it can
   * make authenticated REST calls on itself.
   * @param {string} appUsername - WP admin username
   * @param {string} appPassword - WP admin password
   * @returns {Promise<Object>} Registration result
   */
  async registerSite(appUsername, appPassword) {
    return this.requestRaw('trx-waas-wizard/v1/register-site', {
      method: 'POST',
      body: JSON.stringify({
        app_username: appUsername,
        app_password: appPassword,
      }),
    });
  }

  /**
   * Save wizard data (company info, site settings) in one shot
   * @param {Object} data - Flat object with wizard fields
   * @returns {Promise<Object>} Save result
   */
  async saveWizardData(data) {
    return this.requestRaw('trx-waas-wizard/v1/save-wizard-data/save-all', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==========================================
  // Async Endpoint Polling (WaaS Wizard)
  // ==========================================

  /**
   * Poll an async WaaS Wizard endpoint until it reaches a terminal state.
   * The API spec requires POST (with empty body) for polling, not GET.
   *
   * @param {string} endpoint - Wizard REST path (e.g. "trx-waas-wizard/v1/switch-skin")
   * @param {Object} options
   * @param {string[]} options.terminalStates - Status values that indicate completion
   * @param {Function} [options.onProgress] - Progress callback
   * @param {number} [options.maxAttempts] - Max poll iterations (default: 50)
   * @param {number} [options.pollInterval] - Base interval in ms (default: 2000)
   * @param {number} [options.maxInterval] - Max interval in ms for backoff (default: 10000)
   * @param {string} [options.label] - Human-readable label for logs
   * @returns {Promise<Object>} Final poll result
   */
  async _pollAsyncEndpoint(endpoint, options = {}) {
    const {
      terminalStates = ['rest_api_end'],
      onProgress,
      maxAttempts = 50,
      pollInterval = 2000,
      maxInterval = 10000,
      label = endpoint,
    } = options;

    for (let i = 0; i < maxAttempts; i++) {
      const currentInterval = Math.min(pollInterval * Math.pow(1.2, i), maxInterval);
      await new Promise(resolve => setTimeout(resolve, currentInterval));

      const pollResult = await this.requestRaw(endpoint, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const status = pollResult.status;
      console.log(`${label} poll ${i + 1}/${maxAttempts}: status=${status}`);
      onProgress?.({
        phase: 'polling',
        message: `${label} in progress (${i + 1}/${maxAttempts})...`,
        attempt: i + 1,
        status,
      });

      if (terminalStates.includes(status)) {
        return pollResult;
      }

      if (status === 'error') {
        throw new Error(`${label} failed with error status: ${JSON.stringify(pollResult)}`);
      }
    }

    throw new Error(`${label} timed out after ${maxAttempts} attempts`);
  }

  // ==========================================
  // Skin Switching (WaaS Wizard)
  // ==========================================

  /**
   * Switch the site's skin via the trx-waas-wizard REST endpoint
   * @param {string} skinSlug - Skin slug (e.g., "car-repair", "cleaning")
   * @param {Object} [options]
   * @param {Function} [options.onProgress] - Callback for progress updates
   * @param {number} [options.maxAttempts] - Max poll attempts (default: 50)
   * @param {number} [options.pollInterval] - Poll interval in ms (default: 2000)
   * @returns {Promise<Object>} Final switch-skin result
   */
  async switchSkin(skinSlug, options = {}) {
    const { onProgress, maxAttempts = 50, pollInterval = 2000 } = options;

    console.log(`Switching skin to "${skinSlug}" on ${this.siteUrl}`);
    onProgress?.({ phase: 'starting', message: `Switching skin to "${skinSlug}"...` });

    // POST to initiate skin switch (force: true clears stale error/end states from prior runs)
    let postResult = await this.requestRaw('trx-waas-wizard/v1/switch-skin', {
      method: 'POST',
      body: JSON.stringify({ skin: skinSlug, force: true }),
    });

    if (!postResult.status) {
      throw new Error(`switch-skin POST returned no status: ${JSON.stringify(postResult)}`);
    }

    console.log(`switch-skin POST status: ${postResult.status}`);

    // If status is already terminal from a stale run, the force flag should have restarted it.
    // If it's still error, the skin itself is invalid.
    if (postResult.status === 'rest_api_end') {
      onProgress?.({ phase: 'complete', message: `Skin "${skinSlug}" applied successfully` });
      return { success: true, skin: skinSlug, pollResult: postResult };
    }
    if (postResult.status === 'error') {
      throw new Error(`switch-skin failed immediately: ${postResult.message || JSON.stringify(postResult)}`);
    }

    onProgress?.({ phase: 'switching', message: 'Skin switch initiated, waiting for completion...' });

    // Poll with POST (not GET) until rest_api_end
    const pollResult = await this._pollAsyncEndpoint('trx-waas-wizard/v1/switch-skin', {
      terminalStates: ['rest_api_end'],
      onProgress,
      maxAttempts,
      pollInterval,
      label: 'switch-skin',
    });

    console.log(`Skin switch to "${skinSlug}" completed successfully`);
    onProgress?.({ phase: 'complete', message: `Skin "${skinSlug}" applied successfully` });
    return { success: true, skin: skinSlug, pollResult };
  }

  // ==========================================
  // Content Generation (WaaS Wizard)
  // ==========================================

  /**
   * Trigger the plugin-side "generate all content" pipeline and poll until done.
   * This rewrites all demo content using AI based on the saved wizard data.
   *
   * @param {Object} [options]
   * @param {Function} [options.onProgress] - Progress callback
   * @param {number} [options.maxAttempts] - Max poll attempts (default: 200)
   * @param {number} [options.pollInterval] - Poll interval in ms (default: 5000)
   * @returns {Promise<Object>} Final result
   */
  async generateAllContent(options = {}) {
    const { onProgress, maxAttempts = 200, pollInterval = 5000 } = options;

    console.log(`Triggering generate-all on ${this.siteUrl}`);
    onProgress?.({ phase: 'starting', message: 'Starting plugin-side content generation...' });

    // POST to initiate
    await this.requestRaw('trx-waas-wizard/v1/page-widgets/generate-all', {
      method: 'POST',
      body: JSON.stringify({ force: true }),
    });

    // Poll until terminal state
    const pollResult = await this._pollAsyncEndpoint('trx-waas-wizard/v1/page-widgets/generate-all', {
      terminalStates: ['generate_all_end', 'generate_images_end'],
      onProgress,
      maxAttempts,
      pollInterval,
      maxInterval: 15000,
      label: 'generate-all',
    });

    console.log('generate-all completed successfully');
    onProgress?.({ phase: 'complete', message: 'Plugin-side content generation complete' });
    return { success: true, pollResult };
  }

  /**
   * Trigger plugin-side image generation from an image bank.
   * Only useful when image bank credentials are configured.
   *
   * @param {Object} credentials - Image bank credentials
   * @param {string} credentials.login - Image bank login
   * @param {string} credentials.password - Image bank password
   * @param {number} [credentials.scoreThreshold] - Minimum image match score (default: 0.85)
   * @param {Object} [options]
   * @param {Function} [options.onProgress] - Progress callback
   * @param {number} [options.maxAttempts] - Max poll attempts (default: 200)
   * @param {number} [options.pollInterval] - Poll interval in ms (default: 5000)
   * @returns {Promise<Object>} Final result
   */
  async generateImages(credentials, options = {}) {
    const { onProgress, maxAttempts = 200, pollInterval = 5000 } = options;

    console.log(`Triggering generate-images on ${this.siteUrl}`);
    onProgress?.({ phase: 'starting', message: 'Starting plugin-side image generation...' });

    await this.requestRaw('trx-waas-wizard/v1/page-widgets/generate-images', {
      method: 'POST',
      body: JSON.stringify({
        image_bank_login: credentials.login,
        image_bank_password: credentials.password,
        image_score_threshold: credentials.scoreThreshold || 0.85,
        force: true,
      }),
    });

    const pollResult = await this._pollAsyncEndpoint('trx-waas-wizard/v1/page-widgets/generate-images', {
      terminalStates: ['generate_images_end'],
      onProgress,
      maxAttempts,
      pollInterval,
      maxInterval: 15000,
      label: 'generate-images',
    });

    console.log('generate-images completed successfully');
    onProgress?.({ phase: 'complete', message: 'Plugin-side image generation complete' });
    return { success: true, pollResult };
  }

  // ==========================================
  // Plugin Translation (WaaS Wizard)
  // ==========================================

  /**
   * Translate the plugin/theme strings to the specified locale.
   * This is a synchronous endpoint that typically takes 30-90 seconds.
   *
   * @param {string} locale - WordPress locale code (e.g. "de_DE", "uk")
   * @param {Object} [options]
   * @param {Function} [options.onProgress] - Progress callback
   * @returns {Promise<Object>} Translation result
   */
  async translatePlugin(locale, options = {}) {
    const { onProgress } = options;

    console.log(`Translating plugin to locale "${locale}" on ${this.siteUrl}`);
    onProgress?.({ phase: 'starting', message: `Translating to ${locale}...` });

    const result = await this.requestRaw('trx-waas-wizard/v1/translate-plugin', {
      method: 'POST',
      body: JSON.stringify({ locale }),
    });

    console.log(`Plugin translation to "${locale}" completed`);
    onProgress?.({ phase: 'complete', message: `Translation to ${locale} complete` });
    return result;
  }
}

export default WordPressService;
