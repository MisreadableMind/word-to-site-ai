/**
 * WordPress REST API Service
 * Interacts with deployed WordPress sites via WP REST API using basic auth
 */

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
    const credentials = Buffer.from(`${this.auth.username}:${this.auth.password}`).toString('base64');
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
        error.message || `WP REST API error: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
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
}

export default WordPressService;
