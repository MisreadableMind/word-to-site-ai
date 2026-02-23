/**
 * Firecrawl Service
 * Handles website scraping and content extraction for Flow A
 */

import { config } from '../config.js';

class FirecrawlService {
  constructor(apiKey = null) {
    this.apiUrl = 'https://api.firecrawl.dev/v1';
    this.apiKey = apiKey || config.firecrawl?.apiKey;
  }

  /**
   * Scrape a URL and return structured data
   * @param {string} url - URL to scrape
   * @param {Object} options - Scraping options
   * @returns {Promise<Object>} Scraped data
   */
  async scrapeUrl(url, options = {}) {
    if (this.apiKey) {
      return this._scrapeWithFirecrawl(url, options);
    }
    console.log('No Firecrawl API key — using native fetch fallback');
    return this._scrapeWithFetch(url);
  }

  /**
   * Scrape using the Firecrawl API (original logic)
   */
  async _scrapeWithFirecrawl(url, options = {}) {
    const {
      formats = ['markdown', 'html'],
      includeTags = ['main', 'article', 'section', 'header', 'footer', 'nav'],
      excludeTags = ['script', 'style', 'noscript'],
      waitFor = 2000,
      timeout = 30000,
    } = options;

    console.log(`Scraping URL: ${url}`);

    try {
      const response = await fetch(`${this.apiUrl}/scrape`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          formats,
          includeTags,
          excludeTags,
          waitFor,
          timeout,
          onlyMainContent: false,
          screenshot: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Firecrawl request failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to scrape URL');
      }

      console.log('✅ URL scraped successfully');

      return {
        success: true,
        url,
        markdown: data.data?.markdown || '',
        html: data.data?.html || '',
        metadata: data.data?.metadata || {},
        screenshot: data.data?.screenshot || null,
        links: data.data?.links || [],
        rawData: data.data,
      };
    } catch (error) {
      console.error('Firecrawl error:', error.message);
      throw error;
    }
  }

  /**
   * Lightweight scrape using native fetch (no Firecrawl key required)
   * Extracts title, meta description, OG tags, favicon, and links.
   * Returns the same shape as _scrapeWithFirecrawl so downstream code works unchanged.
   */
  async _scrapeWithFetch(url) {
    console.log(`Scraping URL (native fetch): ${url}`);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WordToSiteBot/1.0)',
          'Accept': 'text/html',
        },
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
      }

      const html = await response.text();

      // Extract metadata
      const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim() || '';
      const metaDesc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i) || [])[1]?.trim() || '';
      const ogTitle = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([\s\S]*?)["']/i) || [])[1]?.trim() || '';
      const ogDesc = (html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["']/i) || [])[1]?.trim() || '';
      const ogImage = (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([\s\S]*?)["']/i) || [])[1]?.trim() || '';
      const ogType = (html.match(/<meta[^>]+property=["']og:type["'][^>]+content=["']([\s\S]*?)["']/i) || [])[1]?.trim() || '';
      const favicon = (html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([\s\S]*?)["']/i) || [])[1]?.trim() || '/favicon.ico';

      // Strip HTML to get text content
      const textContent = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Build markdown-like text from extracted content
      const markdown = `# ${title}\n\n${metaDesc || ogDesc || ''}\n\n${textContent.slice(0, 5000)}`;

      // Extract links
      const links = this._extractLinks(html, url);

      const metadata = {
        title: title || ogTitle,
        description: metaDesc || ogDesc,
        ogTitle,
        ogDescription: ogDesc,
        ogImage,
        ogType,
        favicon,
        sourceURL: url,
      };

      console.log('✅ URL scraped successfully (native fetch)');

      return {
        success: true,
        url,
        markdown,
        html,
        metadata,
        screenshot: null,
        links,
        rawData: { metadata },
      };
    } catch (error) {
      console.error('Native fetch scrape error:', error.message);
      throw error;
    }
  }

  /**
   * Extract links from HTML
   * @param {string} html - Raw HTML
   * @param {string} baseUrl - Base URL for resolving relative links
   * @returns {string[]} Array of absolute URLs
   */
  _extractLinks(html, baseUrl) {
    const linkPattern = /<a[^>]+href=["'](.*?)["']/gi;
    const links = new Set();
    let match;

    while ((match = linkPattern.exec(html)) !== null) {
      try {
        const href = match[1].trim();
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
        const absolute = new URL(href, baseUrl).href;
        links.add(absolute);
      } catch {
        // skip invalid URLs
      }
    }

    return Array.from(links);
  }

  /**
   * Crawl multiple pages of a website
   * @param {string} url - Starting URL
   * @param {Object} options - Crawl options
   * @returns {Promise<Object>} Crawl results
   */
  async crawlSite(url, options = {}) {
    if (!this.apiKey) {
      throw new Error('Firecrawl API key is required');
    }

    const {
      limit = 10,
      maxDepth = 2,
      includePaths = [],
      excludePaths = ['/wp-admin', '/wp-login', '/cart', '/checkout'],
    } = options;

    console.log(`Crawling site: ${url} (limit: ${limit} pages)`);

    try {
      const response = await fetch(`${this.apiUrl}/crawl`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          limit,
          maxDepth,
          includePaths,
          excludePaths,
          scrapeOptions: {
            formats: ['markdown'],
            onlyMainContent: true,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Firecrawl crawl failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to start crawl');
      }

      // For async crawls, return the job ID
      if (data.id) {
        console.log(`Crawl job started: ${data.id}`);
        return {
          success: true,
          jobId: data.id,
          status: 'processing',
        };
      }

      // For immediate results
      console.log(`✅ Crawled ${data.data?.length || 0} pages`);
      return {
        success: true,
        pages: data.data || [],
        total: data.data?.length || 0,
      };
    } catch (error) {
      console.error('Firecrawl crawl error:', error.message);
      throw error;
    }
  }

  /**
   * Check status of a crawl job
   * @param {string} jobId - Crawl job ID
   * @returns {Promise<Object>} Job status
   */
  async getCrawlStatus(jobId) {
    if (!this.apiKey) {
      throw new Error('Firecrawl API key is required');
    }

    try {
      const response = await fetch(`${this.apiUrl}/crawl/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get crawl status: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        status: data.status,
        completed: data.completed || 0,
        total: data.total || 0,
        pages: data.data || [],
        creditsUsed: data.creditsUsed,
      };
    } catch (error) {
      console.error('Get crawl status error:', error.message);
      throw error;
    }
  }

  /**
   * Extract brand elements from scraped result
   * @param {Object} result - Firecrawl result
   * @returns {Object} Extracted brand elements
   */
  extractBrandElements(result) {
    const elements = {
      colors: [],
      fonts: [],
      logo: null,
      favicon: null,
      navigation: [],
      socialLinks: [],
    };

    // Extract from metadata
    const metadata = result.metadata || {};

    // Favicon from metadata
    if (metadata.favicon) {
      elements.favicon = metadata.favicon;
    }

    // Logo detection from metadata or OG image
    if (metadata.ogImage) {
      elements.logo = metadata.ogImage;
    }

    // Extract navigation from links
    if (result.links && Array.isArray(result.links)) {
      const baseUrl = new URL(result.url).origin;
      elements.navigation = result.links
        .filter(link => link.startsWith(baseUrl) || link.startsWith('/'))
        .slice(0, 10)
        .map(link => ({
          url: link,
          text: this.extractLinkText(link),
        }));

      // Extract social links
      const socialPatterns = ['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok'];
      elements.socialLinks = result.links
        .filter(link => socialPatterns.some(p => link.toLowerCase().includes(p)))
        .slice(0, 6);
    }

    // Extract colors from HTML if available
    if (result.html) {
      elements.colors = this.extractColorsFromHtml(result.html);
    }

    return elements;
  }

  /**
   * Extract colors from HTML
   * @param {string} html - HTML content
   * @returns {string[]} Array of hex colors
   */
  extractColorsFromHtml(html) {
    const colorPattern = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g;
    const colors = new Set();
    let match;

    while ((match = colorPattern.exec(html)) !== null) {
      const color = match[0].toUpperCase();
      // Filter out common non-brand colors
      if (!['#FFFFFF', '#000000', '#FFF', '#000'].includes(color)) {
        colors.add(color);
      }
    }

    return Array.from(colors).slice(0, 10);
  }

  /**
   * Extract link text from URL
   * @param {string} url - URL
   * @returns {string} Link text
   */
  extractLinkText(url) {
    try {
      const pathname = new URL(url, 'https://example.com').pathname;
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length === 0) return 'Home';
      const lastPart = parts[parts.length - 1];
      return lastPart
        .replace(/[-_]/g, ' ')
        .replace(/\.(html?|php)$/, '')
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    } catch {
      return 'Link';
    }
  }

  /**
   * Extract site structure from crawled pages
   * @param {Object[]} pages - Array of crawled pages
   * @returns {Object} Site structure
   */
  extractSiteStructure(pages) {
    return {
      totalPages: pages.length,
      pages: pages.map(page => ({
        url: page.url,
        title: page.metadata?.title || '',
        description: page.metadata?.description || '',
        wordCount: (page.markdown || '').split(/\s+/).length,
      })),
      hierarchy: this.buildPageHierarchy(pages),
    };
  }

  /**
   * Build page hierarchy from URLs
   * @param {Object[]} pages - Array of pages
   * @returns {Object} Page hierarchy tree
   */
  buildPageHierarchy(pages) {
    const tree = { name: 'root', children: {} };

    pages.forEach(page => {
      try {
        const url = new URL(page.url);
        const parts = url.pathname.split('/').filter(Boolean);
        let current = tree;

        parts.forEach(part => {
          if (!current.children[part]) {
            current.children[part] = { name: part, children: {} };
          }
          current = current.children[part];
        });
      } catch {
        // Skip invalid URLs
      }
    });

    return tree;
  }
}

export default FirecrawlService;
