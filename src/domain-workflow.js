import NamecheapAPI from './namecheap.js';
import CloudflareAPI from './cloudflare.js';
import InstaWPAPI from './instawp.js';
import { config, validateDomainConfig } from './config.js';
import { DEFAULTS } from './constants.js';
import EditorService from './services/editor-service.js';
import AIService from './services/ai-service.js';
import WordPressService from './services/wordpress-service.js';

// Workflow step identifiers for progress tracking
export const WorkflowSteps = {
  VALIDATING_CONFIG: 'validating_config',
  CHECKING_DOMAIN: 'checking_domain',
  REGISTERING_DOMAIN: 'registering_domain',
  CREATING_SITE: 'creating_site',
  WAITING_FOR_SITE: 'waiting_for_site',
  MAPPING_DOMAIN: 'mapping_domain',
  CREATING_CLOUDFLARE_ZONE: 'creating_cloudflare_zone',
  SETTING_DNS_RECORDS: 'setting_dns_records',
  UPDATING_NAMESERVERS: 'updating_nameservers',
  CONFIGURING_SECURITY: 'configuring_security',
  COMPLETE: 'complete',
  ERROR: 'error',
};

class DomainWorkflow {
  constructor(options = {}) {
    this.instawpApiKey = options.instawpApiKey || config.instawp.apiKey;
    this.instawp = new InstaWPAPI(this.instawpApiKey);
    this.namecheap = new NamecheapAPI();
    this.cloudflare = new CloudflareAPI();

    // Progress callback for real-time updates
    this.onProgress = options.onProgress || (() => {});
  }

  emitProgress(step, data = {}) {
    this.onProgress({
      step,
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  /**
   * Main workflow execution
   * @param {Object} params
   * @param {string} params.domain - Domain name (e.g., "example.com")
   * @param {boolean} params.registerNewDomain - Whether to register new domain via Namecheap
   * @param {string} params.siteName - Optional site name for InstaWP
   * @param {Object} params.contacts - Optional contact info for domain registration
   * @param {boolean} params.includeWww - Include www subdomain (default: true)
   * @param {number} params.registrationYears - Years to register domain (default: 1)
   */
  async execute(params) {
    const {
      domain,
      registerNewDomain = false,
      siteName,
      contacts,
      includeWww = true,
      registrationYears = 1,
    } = params;

    const result = {
      success: false,
      domain: domain,
      site: null,
      cloudflare: null,
      ssl: null,
      steps: [],
      error: null,
    };

    try {
      // Step 1: Validate configuration
      this.emitProgress(WorkflowSteps.VALIDATING_CONFIG, {
        message: 'Validating configuration...',
      });
      validateDomainConfig(registerNewDomain);
      result.steps.push({ step: 'config_validated', success: true });

      // Step 2: Check domain availability (if registering new domain)
      if (registerNewDomain) {
        this.emitProgress(WorkflowSteps.CHECKING_DOMAIN, {
          message: `Checking availability of ${domain}...`,
        });

        const availability = await this.namecheap.checkDomain(domain);
        result.steps.push({
          step: 'domain_checked',
          success: true,
          data: availability,
        });

        if (!availability.available) {
          throw new Error(
            `Domain ${domain} is not available for registration. ` +
              (availability.premium
                ? `It's a premium domain priced at $${availability.premiumPrice}`
                : 'Please try another domain.')
          );
        }

        // Step 3: Register domain
        this.emitProgress(WorkflowSteps.REGISTERING_DOMAIN, {
          message: `Registering domain ${domain}...`,
        });

        const registrationContacts = contacts || config.domain.defaultContacts;
        const registration = await this.namecheap.registerDomain(
          domain,
          registrationYears,
          registrationContacts
        );

        result.steps.push({
          step: 'domain_registered',
          success: true,
          data: registration,
        });
        result.registration = registration;
      }

      // Step 4: Create InstaWP site
      this.emitProgress(WorkflowSteps.CREATING_SITE, {
        message: 'Creating WordPress site...',
      });

      const site = await this.instawp.createSiteFromTemplate(null, {
        siteName: siteName || domain.replace(/\./g, '-'),
        isReserved: true,
      });

      result.steps.push({
        step: 'site_created',
        success: true,
        data: { id: site.id, url: site.wp_url },
      });
      result.site = site;

      // Step 5: Wait for site to be ready
      this.emitProgress(WorkflowSteps.WAITING_FOR_SITE, {
        message: 'Waiting for site to be ready...',
      });

      const readySite = await this.instawp.waitForSiteReady(site.id);
      result.steps.push({ step: 'site_ready', success: true });
      result.site = { ...site, ...readySite };

      // Step 6: Map domain to InstaWP site
      this.emitProgress(WorkflowSteps.MAPPING_DOMAIN, {
        message: `Mapping ${domain} to WordPress site...`,
      });

      const domainMapping = await this.instawp.mapDomain(site.id, domain, {
        www: includeWww,
        routeWww: includeWww,
      });

      result.steps.push({
        step: 'domain_mapped',
        success: true,
        data: domainMapping,
      });

      // Extract A record IPs from InstaWP response
      const aRecordIps = domainMapping.aRecords;
      if (!aRecordIps || aRecordIps.length === 0) {
        throw new Error(
          'Failed to get A record IPs from InstaWP. ' +
            'The domain was mapped but DNS configuration cannot proceed.'
        );
      }

      // Step 7: Create/Get Cloudflare zone
      this.emitProgress(WorkflowSteps.CREATING_CLOUDFLARE_ZONE, {
        message: `Setting up Cloudflare zone for ${domain}...`,
      });

      const zone = await this.cloudflare.getOrCreateZone(domain);
      result.steps.push({
        step: 'cloudflare_zone_created',
        success: true,
        data: {
          zoneId: zone.id,
          nameservers: zone.name_servers,
        },
      });
      result.cloudflare = {
        zoneId: zone.id,
        nameservers: zone.name_servers,
      };

      // Step 8: Set A records in Cloudflare
      this.emitProgress(WorkflowSteps.SETTING_DNS_RECORDS, {
        message: 'Configuring DNS A records...',
      });

      await this.cloudflare.setARecords(zone.id, domain, aRecordIps, includeWww);
      result.steps.push({
        step: 'dns_records_set',
        success: true,
        data: { ips: aRecordIps },
      });

      // Step 9: Update nameservers at Namecheap (only if we registered the domain)
      if (registerNewDomain) {
        this.emitProgress(WorkflowSteps.UPDATING_NAMESERVERS, {
          message: 'Updating nameservers to Cloudflare...',
        });

        await this.namecheap.setCustomNameservers(domain, zone.name_servers);
        result.steps.push({
          step: 'nameservers_updated',
          success: true,
          data: { nameservers: zone.name_servers },
        });
      } else {
        // For existing domains, provide instructions to update nameservers manually
        result.nameserverInstructions = {
          message: 'Please update your domain nameservers to:',
          nameservers: zone.name_servers,
          note: 'Update these at your domain registrar to complete setup. DNS propagation typically takes 5-15 minutes but can take up to 48 hours.',
        };
      }

      // Step 10: Configure Cloudflare security settings
      this.emitProgress(WorkflowSteps.CONFIGURING_SECURITY, {
        message: 'Configuring Cloudflare security and performance settings...',
      });

      await this.cloudflare.configureSecurity(zone.id);
      result.steps.push({ step: 'security_configured', success: true });

      // SSL info - it will auto-generate once DNS propagates
      result.ssl = {
        status: 'pending',
        message:
          'SSL certificate will be issued automatically by InstaWP once DNS propagates.',
        estimatedTime: '5-15 minutes for DNS propagation, then automatic SSL issuance',
      };
      result.steps.push({ step: 'ssl_pending', success: true });

      // Complete
      this.emitProgress(WorkflowSteps.COMPLETE, {
        message: 'Domain workflow completed successfully!',
      });

      result.success = true;
      result.finalUrls = {
        site: `https://${domain}`,
        siteWww: includeWww ? `https://www.${domain}` : null,
        wpAdmin: `https://${domain}/wp-admin`,
        temporaryUrl: site.wp_url,
      };

      return result;
    } catch (error) {
      this.emitProgress(WorkflowSteps.ERROR, {
        message: error.message,
        error: error,
      });

      result.error = error.message;
      result.errorDetails = {
        message: error.message,
        stack: error.stack,
        failedAtStep: result.steps[result.steps.length - 1]?.step || 'unknown',
      };

      return result;
    }
  }

  /**
   * Check domain availability without running full workflow
   */
  async checkDomainAvailability(domain) {
    return await this.namecheap.checkDomain(domain);
  }

  /**
   * Poll SSL status for a site
   */
  async checkSslStatus(siteId) {
    return await this.instawp.checkSslStatus(siteId);
  }

  /**
   * Execute workflow with JSON contexts from onboarding
   * @param {Object} params - Execution parameters
   * @returns {Promise<Object>} Workflow result
   */
  async executeWithContexts(params) {
    const {
      domain,
      registerNewDomain = false,
      deploymentContext,
      contentContext,
      editorPreference,
      siteName,
      contacts,
      includeWww = true,
      registrationYears = 1,
    } = params;

    // Run the standard domain workflow first
    const result = await this.execute({
      domain,
      registerNewDomain,
      siteName: siteName || domain?.replace(/\./g, '-'),
      contacts,
      includeWww,
      registrationYears,
    });

    if (!result.success) {
      return result;
    }

    // Store site credentials for deployment methods
    this._siteCredentials = {
      username: result.site.wp_username,
      password: result.site.wp_password,
    };

    // Apply deployment context
    if (deploymentContext) {
      this.emitProgress('applying_deployment', {
        message: 'Applying deployment configuration...',
      });

      try {
        await this.applyDeploymentContext(result.site.id, result.site, deploymentContext);
        result.steps.push({
          step: 'deployment_applied',
          success: true,
          data: {
            template: deploymentContext.template?.slug,
            plugins: deploymentContext.plugins?.length || 0,
          },
        });
      } catch (error) {
        console.error('Failed to apply deployment context:', error.message);
        result.steps.push({
          step: 'deployment_applied',
          success: false,
          error: error.message,
        });
      }
    }

    // Generate and push content
    if (contentContext) {
      this.emitProgress('generating_content', {
        message: 'Generating website content...',
      });

      try {
        const contentResult = await this.generateContent(result.site.id, result.site, contentContext);
        result.steps.push({
          step: 'content_generated',
          success: true,
          data: {
            pages: contentResult.pages?.length || 0,
            generated: contentResult.generated,
          },
        });
      } catch (error) {
        console.error('Failed to generate content:', error.message);
        result.steps.push({
          step: 'content_generated',
          success: false,
          error: error.message,
        });
      }
    }

    // Select editor mode
    if (editorPreference) {
      try {
        const editorService = new EditorService();
        const editorResult = await editorService.selectEditor(
          result.site.id,
          result.finalUrls?.site || result.site.wp_url,
          editorPreference
        );
        result.editor = editorResult;
      } catch (error) {
        console.error('Failed to select editor:', error.message);
        result.editor = {
          mode: 'advanced',
          url: `${result.finalUrls?.site || result.site.wp_url}/wp-admin`,
          error: error.message,
        };
      }
    }

    return result;
  }

  /**
   * Apply deployment context to a site
   * @param {string} siteId - InstaWP site ID
   * @param {string} siteUrl - Site URL
   * @param {Object} context - Deployment context
   */
  async applyDeploymentContext(siteId, siteUrl, context) {
    const favicon = context.branding?.faviconUrl || DEFAULTS.FAVICON_URL;
    const site = this.extractSiteCredentials(siteUrl);

    console.log(`Applying deployment context to site ${siteId}`);
    console.log(`  Template: ${context.template?.slug}`);
    console.log(`  Favicon: ${favicon}`);
    console.log(`  Plugins: ${context.plugins?.length || 0}`);

    const wp = new WordPressService(site.url, {
      username: site.username,
      password: site.password,
    });

    const results = { applied: true, favicon, template: context.template?.slug };

    // 1. Update site title and tagline from branding
    try {
      const settingsUpdate = {};
      if (context.branding?.siteTitle) settingsUpdate.title = context.branding.siteTitle;
      if (context.branding?.tagline) settingsUpdate.tagline = context.branding.tagline;
      if (Object.keys(settingsUpdate).length > 0) {
        await wp.updateSiteSettings(settingsUpdate);
        results.settings = true;
      }
    } catch (error) {
      console.warn('Failed to update site settings:', error.message);
      results.settingsError = error.message;
    }

    // 2. Apply customizer settings (logo, favicon, colors)
    try {
      const customizerSettings = {};
      if (context.branding?.logoUrl) customizerSettings.logoUrl = context.branding.logoUrl;
      if (favicon) customizerSettings.faviconUrl = favicon;
      if (context.branding?.primaryColor) customizerSettings.primaryColor = context.branding.primaryColor;

      if (Object.keys(customizerSettings).length > 0) {
        const customizerResult = await wp.updateCustomizer(customizerSettings);
        results.customizer = customizerResult;
      }
    } catch (error) {
      console.warn('Failed to apply customizer settings:', error.message);
      results.customizerError = error.message;
    }

    // 3. Install and activate plugins
    if (context.plugins && context.plugins.length > 0) {
      results.plugins = [];
      for (const plugin of context.plugins) {
        try {
          await wp.installPlugin(plugin.slug);
          results.plugins.push({ slug: plugin.slug, success: true });
        } catch (error) {
          console.warn(`Failed to install plugin ${plugin.slug}:`, error.message);
          results.plugins.push({ slug: plugin.slug, success: false, error: error.message });
        }
      }
    }

    return results;
  }

  /**
   * Generate and push content to a site
   * @param {string} siteId - InstaWP site ID
   * @param {string} siteUrl - Site URL
   * @param {Object} context - Content context
   */
  async generateContent(siteId, siteUrl, context) {
    console.log(`Generating content for site ${siteId}`);
    console.log(`  Business: ${context.business?.name}`);
    console.log(`  Tone: ${context.tone}`);
    console.log(`  Pages: ${context.pages?.length || 0}`);

    const site = this.extractSiteCredentials(siteUrl);
    const wp = new WordPressService(site.url, {
      username: site.username,
      password: site.password,
    });

    const ai = new AIService({
      openaiApiKey: config.openai?.apiKey,
      geminiApiKey: config.gemini?.apiKey,
    });

    const results = { generated: false, pages: [], errors: [] };

    // 1. Generate content via AI
    let generatedContent = null;
    if (ai.hasOpenAI) {
      try {
        this.emitProgress('generating_content', {
          message: 'Generating AI content for pages...',
        });
        generatedContent = await ai.generateContent(context);
      } catch (error) {
        console.warn('AI content generation failed:', error.message);
        results.errors.push(`AI generation: ${error.message}`);
      }
    }

    // 2. Update site settings with business info
    try {
      await wp.updateSiteSettings({
        title: context.business?.name || 'My Website',
        tagline: context.business?.tagline || '',
      });
    } catch (error) {
      console.warn('Failed to update site settings:', error.message);
      results.errors.push(`Site settings: ${error.message}`);
    }

    // 3. Create pages with generated or fallback content
    this.emitProgress('pushing_content', {
      message: 'Pushing content to WordPress...',
    });

    const pagesToCreate = context.pages || [];
    let homepageId = null;

    for (const pageDef of pagesToCreate) {
      try {
        // Get AI-generated content for this page, or use a placeholder
        const aiPageContent = generatedContent?.pages?.[pageDef.slug];
        const htmlContent = aiPageContent
          ? this.buildPageHtml(pageDef.slug, aiPageContent)
          : this.buildFallbackPageHtml(pageDef, context.business);

        const createdPage = await wp.createPage({
          title: pageDef.title || pageDef.slug,
          content: htmlContent,
          slug: pageDef.slug,
          status: 'publish',
        });

        results.pages.push({
          slug: pageDef.slug,
          id: createdPage.id,
          success: true,
        });

        if (pageDef.slug === 'home') {
          homepageId = createdPage.id;
        }
      } catch (error) {
        console.warn(`Failed to create page ${pageDef.slug}:`, error.message);
        results.pages.push({
          slug: pageDef.slug,
          success: false,
          error: error.message,
        });
        results.errors.push(`Page ${pageDef.slug}: ${error.message}`);
      }
    }

    // 4. Set homepage as front page if created
    if (homepageId) {
      try {
        await wp.setFrontPage(homepageId);
      } catch (error) {
        console.warn('Failed to set front page:', error.message);
      }
    }

    results.generated = results.pages.some(p => p.success);
    return results;
  }

  /**
   * Build HTML content for a page from AI-generated structured content
   * @param {string} slug - Page slug
   * @param {Object} pageContent - AI-generated content object
   * @returns {string} HTML content
   */
  buildPageHtml(slug, pageContent) {
    const sections = [];

    if (pageContent.hero) {
      sections.push(`
<div class="hero-section">
  <h1>${pageContent.hero.headline || ''}</h1>
  <p>${pageContent.hero.subheadline || ''}</p>
  ${pageContent.hero.cta ? `<a href="#contact" class="cta-button">${pageContent.hero.cta}</a>` : ''}
</div>`);
    }

    if (pageContent.features && Array.isArray(pageContent.features)) {
      const featureItems = pageContent.features
        .map(f => `<div class="feature"><h3>${f.title || ''}</h3><p>${f.description || ''}</p></div>`)
        .join('\n');
      sections.push(`<div class="features-section">${featureItems}</div>`);
    }

    if (pageContent.about) {
      const aboutContent = typeof pageContent.about === 'string'
        ? pageContent.about
        : (pageContent.about.content || pageContent.about.description || '');
      sections.push(`<div class="about-section"><h2>${pageContent.about.title || 'About Us'}</h2><p>${aboutContent}</p></div>`);
    }

    if (pageContent.services && Array.isArray(pageContent.services)) {
      const serviceItems = pageContent.services
        .map(s => `<div class="service"><h3>${s.title || ''}</h3><p>${s.description || ''}</p></div>`)
        .join('\n');
      sections.push(`<div class="services-section"><h2>Our Services</h2>${serviceItems}</div>`);
    }

    if (pageContent.contact) {
      sections.push(`<div class="contact-section"><h2>${pageContent.contact.title || 'Contact Us'}</h2><p>${pageContent.contact.description || 'Get in touch with us.'}</p></div>`);
    }

    // Fallback: if no sections matched, render all values as paragraphs
    if (sections.length === 0) {
      for (const [key, value] of Object.entries(pageContent)) {
        if (typeof value === 'string') {
          sections.push(`<p>${value}</p>`);
        } else if (typeof value === 'object' && value !== null) {
          const text = value.content || value.description || value.headline || JSON.stringify(value);
          sections.push(`<div><h2>${value.title || key}</h2><p>${text}</p></div>`);
        }
      }
    }

    return sections.join('\n\n');
  }

  /**
   * Build fallback HTML when AI content generation is unavailable
   * @param {Object} pageDef - Page definition
   * @param {Object} business - Business info
   * @returns {string} HTML content
   */
  buildFallbackPageHtml(pageDef, business) {
    const name = business?.name || 'Our Business';
    const tagline = business?.tagline || '';

    switch (pageDef.slug) {
      case 'home':
        return `<h1>Welcome to ${name}</h1>\n<p>${tagline}</p>\n<p>We are dedicated to providing exceptional service to our customers.</p>`;
      case 'about':
        return `<h2>About ${name}</h2>\n<p>Learn more about our story, mission, and the team behind ${name}.</p>`;
      case 'services':
        return `<h2>Our Services</h2>\n<p>Discover what ${name} can do for you.</p>`;
      case 'contact':
        return `<h2>Contact Us</h2>\n<p>Get in touch with ${name}. We'd love to hear from you.</p>`;
      case 'blog':
        return `<h2>Blog</h2>\n<p>Stay up to date with the latest news from ${name}.</p>`;
      default:
        return `<h2>${pageDef.title || pageDef.slug}</h2>\n<p>Welcome to the ${pageDef.title || pageDef.slug} page.</p>`;
    }
  }

  /**
   * Extract site credentials from the site result
   * Returns the WP URL and credentials for REST API access
   * @param {string|Object} siteUrl - Site URL string or site result object
   * @returns {Object} { url, username, password }
   */
  extractSiteCredentials(siteUrl) {
    // If it's a full site result object with credentials
    if (typeof siteUrl === 'object' && siteUrl !== null) {
      return {
        url: siteUrl.wp_url || siteUrl.url || siteUrl,
        username: siteUrl.wp_username || 'admin',
        password: siteUrl.wp_password || '',
      };
    }

    // String URL - credentials must come from the site result stored in this.lastSiteResult
    return {
      url: siteUrl,
      username: this._siteCredentials?.username || 'admin',
      password: this._siteCredentials?.password || '',
    };
  }

  /**
   * Get workflow steps info for UI display
   */
  static getWorkflowStepsInfo(registerNewDomain = false) {
    const steps = [
      {
        id: WorkflowSteps.VALIDATING_CONFIG,
        label: 'Validating configuration',
        order: 1,
      },
      {
        id: WorkflowSteps.CHECKING_DOMAIN,
        label: 'Checking domain availability',
        order: 2,
        conditional: 'registerNewDomain',
      },
      {
        id: WorkflowSteps.REGISTERING_DOMAIN,
        label: 'Registering domain',
        order: 3,
        conditional: 'registerNewDomain',
      },
      {
        id: WorkflowSteps.CREATING_SITE,
        label: 'Creating WordPress site',
        order: 4,
      },
      {
        id: WorkflowSteps.WAITING_FOR_SITE,
        label: 'Waiting for site to be ready',
        order: 5,
      },
      {
        id: WorkflowSteps.MAPPING_DOMAIN,
        label: 'Mapping domain to site',
        order: 6,
      },
      {
        id: WorkflowSteps.CREATING_CLOUDFLARE_ZONE,
        label: 'Creating Cloudflare zone',
        order: 7,
      },
      {
        id: WorkflowSteps.SETTING_DNS_RECORDS,
        label: 'Setting DNS records',
        order: 8,
      },
      {
        id: WorkflowSteps.UPDATING_NAMESERVERS,
        label: 'Updating nameservers',
        order: 9,
        conditional: 'registerNewDomain',
      },
      {
        id: WorkflowSteps.CONFIGURING_SECURITY,
        label: 'Configuring security',
        order: 10,
      },
      {
        id: WorkflowSteps.COMPLETE,
        label: 'Complete',
        order: 11,
      },
    ];

    // Filter based on whether we're registering a new domain
    if (!registerNewDomain) {
      return steps.filter((s) => s.conditional !== 'registerNewDomain');
    }

    return steps;
  }
}

export default DomainWorkflow;
