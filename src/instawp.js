import axios from 'axios';
import pWaitFor, { TimeoutError } from 'p-wait-for';
import { config } from './config.js';

export function sanitizeSiteName(name) {
  if (!name) return undefined;
  // InstaWP only allows a-z, A-Z, 0-9 and hyphens
  const sanitized = name
    .trim()
    .replace(/\s+/g, '-')          // spaces → hyphens
    .replace(/[^a-zA-Z0-9-]/g, '') // strip any other invalid chars
    .replace(/-{2,}/g, '-')        // collapse multiple hyphens
    .replace(/^-+|-+$/g, '');      // trim leading/trailing hyphens
  return sanitized || undefined;
}

class InstaWPAPI {
  constructor(apiKey = null) {
    this.apiUrl = config.instawp.apiUrl;
    this.apiUrlV1 = config.instawp.apiUrlV1;
    this.apiKey = apiKey || config.instawp.apiKey;
  }

  async makeRequest(endpoint, method = 'GET', data = null, useV1 = false) {
    const baseUrl = useV1 ? this.apiUrlV1 : this.apiUrl;
    const url = `${baseUrl}${endpoint}`;

    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    try {
      const response = await axios({
        method,
        url,
        headers,
        data,
        timeout: 30000,
      });

      return response.data;
    } catch (error) {
      if (error.response) {
        let errorMessage = error.response.data?.message || error.response.statusText;
        const fieldErrors = error.response.data?.errors;
        if (fieldErrors && typeof fieldErrors === 'object') {
          const flat = Object.values(fieldErrors).flat().filter(Boolean);
          if (flat.length) errorMessage += ` — ${flat.join('; ')}`;
        }
        console.error(`InstaWP API ${method} ${url} failed:`);
        console.error(`  Status: ${error.response.status}`);
        console.error(`  Response body:`, JSON.stringify(error.response.data, null, 2));
        console.error(`  Request body:`, JSON.stringify(data, null, 2));
        const wrapped = new Error(`InstaWP API Error: ${error.response.status} - ${errorMessage}`);
        wrapped.status = error.response.status;
        wrapped.fieldErrors = fieldErrors ?? null;
        throw wrapped;
      }
      throw error;
    }
  }

  async listTemplates(page = 1, perPage = 50) {
    console.log('Fetching InstaWP templates...');

    const response = await this.makeRequest(
      `/templates?page=${page}&per_page=${perPage}`
    );

    return response.data || [];
  }

  async findTemplateBySlug(slug) {
    console.log(`Searching for template with slug: ${slug}`);

    // Get templates and search for the slug
    const templates = await this.listTemplates();
    const template = templates.find(t => t.slug === slug || t.name.toLowerCase().includes(slug.toLowerCase()));

    if (!template) {
      throw new Error(`Template with slug '${slug}' not found`);
    }

    console.log(`Found template: ${template.name} (${template.slug})`);
    return template;
  }

  async getTeams() {
    console.log('Fetching user teams...');

    const response = await this.makeRequest('/teams');
    return response.data || [];
  }

  async getDefaultTeam() {
    console.log('Fetching default team...');

    const teams = await this.getTeams();

    if (!teams || teams.length === 0) {
      throw new Error('No teams found for this account. Please create a team in InstaWP dashboard.');
    }

    // Use the first team as default
    const defaultTeam = teams[0];
    console.log(`Using team: ${defaultTeam.name} (ID: ${defaultTeam.id})`);

    return defaultTeam;
  }

  async createSiteFromTemplate(templateSlug, options = {}) {
    const slug = templateSlug || options.templateSlug || config.instawp.templateSlug;
    const snapshotSlug = options.snapshotSlug;
    const siteName = sanitizeSiteName(options.siteName);

    const data = {
      site_name: siteName || undefined,
      is_shared: options.isShared !== undefined ? options.isShared : false,
      is_reserved: options.isReserved !== undefined ? options.isReserved : true,
    };

    if (snapshotSlug) {
      data.snapshot_slug = snapshotSlug;
      console.log(`Creating site from snapshot "${snapshotSlug}": ${options.siteName || 'auto-generated name'}`);
    } else {
      data.slug = slug;
      console.log(`Creating site from template "${slug}": ${options.siteName || 'auto-generated name'}`);
    }

    const response = await this.makeRequest('/sites/template', 'POST', data);

    console.log(`Site created successfully. Site ID: ${response.data.id}`);
    return response.data;
  }

  async getSite(siteId) {
    console.log(`Fetching site details for ID: ${siteId}`);

    const response = await this.makeRequest(`/sites/${siteId}`);
    return response.data;
  }

  async mapDomain(siteId, domainName, options = {}) {
    console.log(`Mapping domain ${domainName} to site ${siteId}`);

    const data = {
      name: domainName,
      type: options.type || 'primary',
      www: options.www !== undefined ? options.www : false,
      route_www: options.routeWww !== undefined ? options.routeWww : false,
    };

    // Note: Map domain uses v1 API
    const response = await this.makeRequest(
      `/site/add-domain/${siteId}`,
      'POST',
      data,
      true // Use v1 API
    );

    console.log(`Domain ${domainName} mapped successfully`);

    // Extract A records from response if available
    // The response structure may vary, adjust based on actual API response
    return {
      domain: domainName,
      siteId: siteId,
      aRecords: this.extractARecords(response),
      response: response,
    };
  }

  extractARecords(response) {
    // InstaWP returns A record IPs in the response
    // The exact structure depends on the API response
    // This is a placeholder that should be adjusted based on actual response

    if (response.data?.a_records) {
      return response.data.a_records;
    }

    if (response.data?.dns_records) {
      return response.data.dns_records
        .filter(record => record.type === 'A')
        .map(record => record.value);
    }

    // Default IPs - these should be replaced with actual values from the response
    console.warn('Could not extract A records from response. Using default InstaWP IPs.');
    console.warn('Please check the API response and update extractARecords method.');

    return [
      '123.123.123.123', // Placeholder - replace with actual InstaWP IP
      '124.124.124.124', // Placeholder - replace with actual InstaWP IP
    ];
  }

  async waitForSiteReady(siteId, { maxWaitTime = 300000, onProgress } = {}) {
    console.log(`Waiting for site ${siteId} to be ready...`);
    const notify = onProgress || (() => {});
    const isActive = (s) => s === 0 || s === '0' || s === 'active' || s === 'running';

    let activeSite = null;

    try {
      await pWaitFor(async () => {
        let site;
        try {
          site = await this.getSite(siteId);
        } catch (err) {
          console.warn(`getSite ${siteId} failed (${err.message}); will retry next poll`);
          return false;
        }
        if (isActive(site.status)) {
          activeSite = site;
          return true;
        }
        console.log(`Site ${siteId} status: ${site.status} (waiting for active)...`);
        notify({ phase: 'provisioning', message: 'Provisioning server and installing WordPress...' });
        return false;
      }, { interval: 10000, timeout: maxWaitTime });
    } catch (err) {
      if (err instanceof TimeoutError) {
        throw new Error(`Site ${siteId} did not reach active status within ${maxWaitTime / 1000}s`);
      }
      throw err;
    }

    const siteUrl = activeSite.url || activeSite.wp_url;
    if (!siteUrl) {
      throw new Error(`Site ${siteId} is active but has no URL`);
    }

    notify({ phase: 'booting', message: 'WordPress is starting up...' });

    try {
      await pWaitFor(async () => {
        try {
          const probe = await fetch(siteUrl, {
            method: 'HEAD',
            redirect: 'manual',
            signal: AbortSignal.timeout(8000),
          });
          return probe.status < 400;
        } catch {
          return false;
        }
      }, { interval: 3000, timeout: maxWaitTime });
    } catch (err) {
      if (err instanceof TimeoutError) {
        throw new Error(
          `Site ${siteId} active but ${siteUrl} did not become reachable within ${maxWaitTime / 1000}s. ` +
          `InstaWP DNS/SSL is still propagating — try again in a few minutes.`,
        );
      }
      throw err;
    }

    console.log(`Site ${siteId} is ready and reachable at ${siteUrl}`);
    notify({ phase: 'ready', message: 'Site is live!' });
    return activeSite;
  }

  async checkSslStatus(siteId) {
    console.log(`Checking SSL status for site ${siteId}`);

    const site = await this.getSite(siteId);

    // The SSL status may be in different fields depending on API version
    // Adjust based on actual response structure
    return {
      siteId: siteId,
      sslEnabled: site.ssl_enabled || false,
      sslStatus: site.ssl_status || 'unknown',
      domain: site.custom_domain || site.domain,
    };
  }
}

export default InstaWPAPI;
