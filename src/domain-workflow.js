import NamecheapAPI from './namecheap';
import CloudflareAPI from './cloudflare';
import InstaWPAPI from './instawp';
import { config, validateDomainConfig, toWpLocale } from './config';
import { DEFAULTS } from './constants';
import EditorService from './services/editor-service';
import WordPressService from './services/wordpress-service';
import { prepareWizardData } from './services/business-structurer';
import { classify } from './lib/domain-classifier';
import pRetry from 'p-retry';
import { checkDnsMatches, waitForDnsResolves } from './lib/dns-ready';

const CRITICAL_ONBOARDING_STEPS = [
  'skin_switched',
  'deployment_applied',
  'wizard_data_saved',
];

function withAggregateSuccess(result) {
  const failed = result.steps?.find(
    (s) => s.success === false && CRITICAL_ONBOARDING_STEPS.includes(s.step),
  );
  if (!failed) return result;
  return {
    ...result,
    success: false,
    error: `${failed.step} failed: ${failed.error}`,
  };
}

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
  WAITING_FOR_DNS: 'waiting_for_dns',
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

    // Optional proxy service for auto-registering proxy keys
    this.proxyService = options.proxyService || null;
    this.proxyUrl = options.proxyUrl || null;

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
      acceptOwnedDomain = false,
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

      const classification = classify(domain);
      if (classification.kind === 'platform_subdomain') {
        throw new Error(`Cannot run domain workflow on platform subdomain "${domain}".`);
      }
      if (classification.kind === 'reserved' || classification.kind === 'invalid') {
        throw new Error(`Invalid domain "${domain}" (${classification.kind}${classification.reason ? `:${classification.reason}` : ''}).`);
      }
      if (registerNewDomain && classification.kind !== 'registerable') {
        throw new Error(`Only registerable apex domains can be registered. "${domain}" is a ${classification.kind}; try ${classification.apex || 'the apex'} instead.`);
      }
      result.steps.push({ step: 'config_validated', success: true });

      let zone = null;
      let managed = registerNewDomain;

      // Step 2: Check domain availability (if registering new domain)
      let alreadyOwned = false;
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
          try {
            await this.namecheap.getDomainInfo(domain);
            alreadyOwned = true;
          } catch (e) {
            alreadyOwned = false;
          }

          if (!alreadyOwned) {
            throw new Error(
              `Domain ${domain} is not available for registration. ` +
                (availability.premium
                  ? `It's a premium domain priced at $${availability.premiumPrice}`
                  : 'Please try another domain.')
            );
          }

          if (!acceptOwnedDomain) {
            console.log(`${domain} is already registered to our Namecheap account; awaiting user confirmation.`);
            result.needsConfirmation = true;
            result.alreadyOwnedDomain = domain;
            result.steps.push({
              step: 'domain_already_owned',
              success: true,
              data: { domain },
            });
            return result;
          }

          console.log(`${domain} is already registered to our Namecheap account; skipping registration step.`);
          result.steps.push({
            step: 'domain_already_owned',
            success: true,
            data: { domain },
          });
        }

        this.emitProgress(WorkflowSteps.CREATING_CLOUDFLARE_ZONE, {
          message: `Setting up Cloudflare zone for ${domain}...`,
        });
        zone = await this.cloudflare.getOrCreateZone(domain);
        result.cloudflare = { zoneId: zone.id, nameservers: zone.name_servers };
        result.steps.push({
          step: 'cloudflare_zone_created',
          success: true,
          data: { zoneId: zone.id, nameservers: zone.name_servers },
        });

        // Step 3: Register domain (only if we don't already own it)
        if (!alreadyOwned) {
          this.emitProgress(WorkflowSteps.REGISTERING_DOMAIN, {
            message: `Registering domain ${domain}...`,
          });

          const registrationContacts = contacts || config.domain.defaultContacts;
          const registration = await this.namecheap.registerDomain(
            domain,
            registrationYears,
            registrationContacts,
            { nameservers: zone.name_servers }
          );

          result.steps.push({
            step: 'domain_registered',
            success: true,
            data: registration,
          });
          result.registration = registration;
        }
      }

      // Step 4: Create InstaWP site
      this.emitProgress(WorkflowSteps.CREATING_SITE, {
        message: 'Creating WordPress site...',
      });

      const site = await this.instawp.createSiteFromTemplate(null, {
        snapshotSlug: config.instawp.snapshotSlug,
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

      if (!registerNewDomain) {
        managed = await this.isManagedDomain(domain);
      }

      const host = new URL(result.site.wp_url).hostname;
      const isMapDomainDnsError = (err) =>
        err?.status === 422 && err?.fieldErrors?.name?.length > 0;

      try {
        if (managed) {
          zone = await this.ensureCloudflareDelegationAndDns(domain, result.site, { includeWww, existingZone: zone });
          result.cloudflare = { zoneId: zone.id, nameservers: zone.name_servers };
          result.steps.push({ step: 'dns_configured', success: true, data: { cname: host, www: includeWww } });
        } else if (!config.namecheap.sandbox) {
          const dns = await checkDnsMatches(domain, host, { includeWww });
          if (!dns.ok) {
            throw new Error(
              `${domain} is not pointing at your WordPress site yet. Add a CNAME for ${domain}`
              + `${includeWww ? ` and www.${domain}` : ''} to ${host} `
              + `(currently ${dns.apex.join(',') || 'none'}, expected one of ${dns.expected.join(',')}), then retry.`
            );
          }
        }

        this.emitProgress(WorkflowSteps.MAPPING_DOMAIN, {
          message: `Mapping ${domain} to WordPress site...`,
        });

        if (!config.namecheap.sandbox) {
          this.emitProgress(WorkflowSteps.WAITING_FOR_DNS, {
            message: 'Verifying public DNS resolves to the site...',
          });
          await waitForDnsResolves(domain, host, {
            includeWww,
            timeout: 6 * 60_000,
            onProgress: ({ apex, expected }) => this.emitProgress(WorkflowSteps.WAITING_FOR_DNS, {
              message: `${domain} → ${apex.join(',') || 'pending'} (expecting ${expected.join(',')})`,
            }),
          });
        }

        const domainMapping = await pRetry(
          async () => {
            if (!config.namecheap.sandbox) {
              const dns = await checkDnsMatches(domain, host, { includeWww });
              if (!dns.ok) {
                const e = new Error('DNS not matching at map time');
                e.status = 422;
                e.fieldErrors = { name: ['dns'] };
                throw e;
              }
            }
            return this.instawp.mapDomain(site.id, domain, { www: includeWww, routeWww: includeWww });
          },
          {
            retries: 2,
            minTimeout: 30_000,
            factor: 1,
            shouldRetry: ({ error }) => isMapDomainDnsError(error),
          }
        );

        result.steps.push({ step: 'domain_mapped', success: true, data: domainMapping });
      } catch (error) {
        if (error.code === 'DNS_TIMEOUT' || error.code === 'ZONE_PENDING' || isMapDomainDnsError(error)) {
          result.domainMapping = 'pending';
          result.domainMappingError = error.message;
          result.steps.push({ step: 'domain_mapped', success: false, pending: true, error: error.message });
        } else {
          throw error;
        }
      }

      if (zone) {
        this.emitProgress(WorkflowSteps.CONFIGURING_SECURITY, {
          message: 'Configuring Cloudflare security and performance settings...',
        });

        try {
          await this.cloudflare.configureSecurity(zone.id);
          result.steps.push({ step: 'security_configured', success: true });
        } catch (error) {
          result.steps.push({ step: 'security_configured', success: false, error: error.message });
        }
      }

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

  async isManagedDomain(domain) {
    const zone = await this.cloudflare.getZone(domain).catch(() => null);
    if (zone) return true;
    try {
      await this.namecheap.getDomainInfo(domain);
      return true;
    } catch {
      return false;
    }
  }

  async ensureNamecheapNameservers(domain, expectedNs) {
    const want = expectedNs.map((ns) => ns.toLowerCase());
    let current = null;
    try {
      current = await this.namecheap.getNameservers(domain);
    } catch {
      current = null;
    }
    const have = (current?.nameservers || []).map((ns) => String(ns).toLowerCase());
    if (have.length && want.every((ns) => have.includes(ns))) {
      return;
    }
    await pRetry(
      async () => {
        const res = await this.namecheap.setCustomNameservers(domain, expectedNs);
        if (!res.success) throw new Error('Namecheap did not apply the nameserver change');
        const ok = await this.namecheap.waitForCustomNameservers(domain, expectedNs, { timeout: 90_000 });
        if (!ok) throw new Error('Custom nameservers not reflected by the registrar yet');
      },
      { retries: 3, minTimeout: 20_000, factor: 1 }
    );
  }

  async ensureCloudflareDelegationAndDns(domain, site, { includeWww = true, existingZone = null } = {}) {
    const cnameTarget = new URL(site.wp_url).hostname;
    const zone = existingZone || await this.cloudflare.getOrCreateZone(domain);

    this.emitProgress(WorkflowSteps.SETTING_DNS_RECORDS, {
      message: `Pointing DNS at ${cnameTarget}...`,
    });
    await this.cloudflare.setCnameRecords(zone.id, domain, cnameTarget, includeWww, { proxied: false });

    this.emitProgress(WorkflowSteps.UPDATING_NAMESERVERS, {
      message: 'Pointing nameservers to Cloudflare...',
    });
    await this.ensureNamecheapNameservers(domain, zone.name_servers);

    await this.cloudflare.triggerActivationCheck(zone.id);

    return zone;
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
      acceptOwnedDomain = false,
      deploymentContext,
      contentContext,
      editorPreference,
      siteName,
      contacts,
      includeWww = true,
      registrationYears = 1,
      email,
      callbackBaseUrl,
      licenseKey,
    } = params;

    // Run the standard domain workflow first
    const result = await this.execute({
      domain,
      registerNewDomain,
      acceptOwnedDomain,
      siteName: siteName || domain?.replace(/\./g, '-'),
      contacts,
      includeWww,
      registrationYears,
    });

    if (!result.success) {
      return result;
    }

    let deployFailed = false;

    // Apply deployment context
    if (deploymentContext) {
      this.emitProgress('applying_deployment', {
        message: 'Applying deployment configuration...',
      });

      try {
        await this.applyDeploymentContext(result.site.id, result.site, deploymentContext, {
          contentContext,
          skinSlugOverride: params.templateSlug,
          email,
          domain,
          callbackBaseUrl,
          licenseKey,
        });
        result.steps.push({
          step: 'deployment_applied',
          success: true,
          data: {
            template: params.templateSlug || deploymentContext.template?.slug,
            plugins: deploymentContext.plugins?.length || 0,
          },
        });
      } catch (error) {
        console.error('Failed to apply deployment context:', error.message);
        deployFailed = true;
        result.steps.push({
          step: 'deployment_applied',
          success: false,
          error: error.message,
        });
      }
    }

    if (this.proxyService && result.site?.wp_url) {
      try {
        const wpUrl = result.site.wp_url;
        const domain = new URL(wpUrl).hostname;
        const existing = await this.proxyService.getSiteByDomain(domain);
        const label = deploymentContext?.branding?.siteTitle || contentContext?.business?.name || domain;
        const proxySite = existing
          || await this.proxyService.registerSite(domain, label, wpUrl);

        if (existing) {
          console.log(`Proxy key already exists for ${domain}, re-pushing existing key`);
        } else {
          console.log(`Proxy key registered for ${domain}: ${proxySite.api_key.slice(0, 8)}...`);
        }

        let pushed = false;
        if (this.proxyUrl) {
          const pushResp = await fetch(`${wpUrl}/wp-json/wordtosite/v1/set-proxy-config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proxyUrl: this.proxyUrl, apiKey: proxySite.api_key }),
          });
          pushed = pushResp.ok;
          if (!pushed) {
            console.warn(`Failed to push proxy config to ${domain}`);
          }
        }
        result.steps.push({ step: 'proxy_registered', success: true, reused: !!existing, pushed });
      } catch (error) {
        console.warn('Auto proxy registration failed:', error.message);
        result.steps.push({ step: 'proxy_registered', success: false, error: error.message });
      }
    }

    // Select editor mode
    if (editorPreference && !deployFailed) {
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

    return withAggregateSuccess(result);
  }

  /**
   * Apply deployment context to a site
   * @param {string} siteId - InstaWP site ID
   * @param {string} siteUrl - Site URL
   * @param {Object} context - Deployment context
   * @param {Object} [options] - Additional options
   * @param {Object} [options.contentContext] - Content context for wizard data
   * @param {string} [options.skinSlugOverride] - User-selected skin slug override
   */
  async applyDeploymentContext(siteId, siteUrl, context, options = {}) {
    const { contentContext, skinSlugOverride, licenseKey } = options;
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

    const skinSlug = skinSlugOverride || context.template?.slug;

    if (licenseKey) {
      try {
        await wp.activateLicense(licenseKey, {
          userName: null,
          userEmail: options.email || null,
        });
        results.licenseActivated = true;
      } catch (error) {
        console.warn('Failed to activate license on site:', error.message);
        results.licenseError = error.message;
        if (skinSlug && skinSlug !== 'default') {
          throw new Error(`license_activated failed: ${error.message}`);
        }
      }
    }

    // 0. Switch skin if a non-default template was selected
    if (skinSlug && skinSlug !== 'default') {
      try {
        this.emitProgress('switching_skin', {
          message: `Switching skin to "${skinSlug}"...`,
        });
        const skinResult = await wp.switchSkin(skinSlug, {
          onProgress: (progress) => {
            this.emitProgress('switching_skin', { message: progress.message, ...progress });
          },
        });
        results.skinSwitched = true;
        console.log(`  Skin switched: ${skinSlug}`);
      } catch (error) {
        console.error('Failed to switch skin:', error.message);
        throw new Error(`skin_switched failed: ${error.message}`);
      }
    }

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

    // Save wizard data to the plugin
    if (contentContext || context.branding) {
      try {
        this.emitProgress('structuring_business', {
          message: 'Structuring company info...',
        });
        const wizardData = await prepareWizardData(context, contentContext, site);
        await wp.saveWizardData(wizardData);
        results.wizardDataSaved = true;
        console.log('  Wizard data saved');
      } catch (error) {
        console.error('Failed to save wizard data:', error.message);
        results.wizardDataError = error.message;
      }
    }

    // Translate plugin (if non-English)
    const wpLocale = toWpLocale(contentContext?.language?.primary);
    if (wpLocale && wpLocale !== 'en_US') {
      try {
        this.emitProgress('translating_plugin', {
          message: `Translating to ${wpLocale}...`,
        });
        await wp.translatePlugin(wpLocale, {
          onProgress: (progress) => {
            this.emitProgress('translating_plugin', { message: progress.message, ...progress });
          },
        });
        results.pluginTranslated = true;
        console.log(`  Plugin translated to ${wpLocale}`);
      } catch (error) {
        console.warn('Failed to translate plugin:', error.message);
        results.translateError = error.message;
      }
    }

    const criticalFailures = [];
    if (results.wizardDataError) criticalFailures.push(`wizard_data_saved: ${results.wizardDataError}`);
    if (criticalFailures.length > 0) {
      throw new Error(criticalFailures.join('; '));
    }

    return results;
  }

  /**
   * Extract site credentials from the site result
   * Returns the WP URL and credentials for REST API access
   * @param {string|Object} siteUrl - Site URL string or site result object
   * @returns {Object} { url, username, password }
   */
  extractSiteCredentials(siteUrl) {
    const url = (typeof siteUrl === 'object' && siteUrl !== null)
      ? (siteUrl.wp_url || siteUrl.url || siteUrl)
      : siteUrl;
    return {
      url,
      username: config.instawp.snapshotWpUsername,
      password: config.instawp.snapshotWpPassword,
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
        id: WorkflowSteps.CREATING_CLOUDFLARE_ZONE,
        label: 'Creating Cloudflare zone',
        order: 6,
        conditional: 'registerNewDomain',
      },
      {
        id: WorkflowSteps.SETTING_DNS_RECORDS,
        label: 'Setting DNS records',
        order: 7,
        conditional: 'registerNewDomain',
      },
      {
        id: WorkflowSteps.UPDATING_NAMESERVERS,
        label: 'Updating nameservers',
        order: 8,
        conditional: 'registerNewDomain',
      },
      {
        id: WorkflowSteps.MAPPING_DOMAIN,
        label: 'Mapping domain to site',
        order: 9,
      },
      {
        id: WorkflowSteps.CONFIGURING_SECURITY,
        label: 'Configuring security',
        order: 10,
        conditional: 'registerNewDomain',
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
