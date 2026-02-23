import axios from 'axios';
import { config } from './config.js';

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
      });

      return response.data;
    } catch (error) {
      if (error.response) {
        const errorMessage = error.response.data?.message || error.response.statusText;
        throw new Error(`InstaWP API Error: ${error.response.status} - ${errorMessage}`);
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
    console.log(`Creating site: ${options.siteName || 'auto-generated name'}`);

    const data = {
      site_name: options.siteName || undefined,
      wp_version: options.wpVersion || '6.8.1',
      php_version: options.phpVersion || '8.0',
      is_reserved: options.isReserved !== undefined ? options.isReserved : true,
      plan_id: options.planId || 2,
    };

    const response = await this.makeRequest('/sites', 'POST', data);

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

  async waitForSiteReady(siteId, { maxWaitTime = 300000, checkInterval = 10000, onProgress } = {}) {
    console.log(`Waiting for site ${siteId} to be ready...`);
    const notify = onProgress || (() => {});

    const startTime = Date.now();
    let phase = 'provisioning'; // provisioning → booting → ready
    let probeAttempts = 0;
    const maxProbeAttempts = 6; // Try probing 6 times (60s) then trust the API status

    while (Date.now() - startTime < maxWaitTime) {
      const site = await this.getSite(siteId);

      // InstaWP API numeric statuses: 0 = active/ready, 4 = provisioning
      const status = site.status;
      if (status === 0 || status === '0' || status === 'active' || status === 'running') {
        if (phase === 'provisioning') {
          phase = 'booting';
          notify({ phase, message: 'WordPress is starting up...' });
        }

        // Verify the site is actually reachable before returning
        const siteUrl = site.url || site.wp_url;
        if (siteUrl) {
          try {
            const probe = await fetch(siteUrl, {
              method: 'HEAD',
              redirect: 'manual',
              signal: AbortSignal.timeout(10000),
            });
            // Accept 2xx and 3xx (redirects are normal for fresh WP sites)
            if (probe.status < 400) {
              console.log(`Site ${siteId} is ready and reachable! (HTTP ${probe.status})`);
              notify({ phase: 'ready', message: 'Site is live!' });
              return site;
            }
            console.log(`Site ${siteId} ready but returned HTTP ${probe.status}. Waiting...`);
          } catch {
            console.log(`Site ${siteId} ready but not yet reachable (attempt ${probeAttempts + 1}/${maxProbeAttempts}). Waiting...`);
          }

          probeAttempts++;
          // If API says active but probe keeps failing (DNS/SSL not propagated yet),
          // trust the API after a reasonable number of retries
          if (probeAttempts >= maxProbeAttempts) {
            console.log(`Site ${siteId} API reports active — returning despite probe failures (DNS/SSL may still be propagating).`);
            notify({ phase: 'ready', message: 'Site is live!' });
            return site;
          }
          notify({ phase: 'booting', message: 'Almost there — waiting for site to respond...' });
        } else {
          console.log(`Site ${siteId} is ready! (status: ${status})`);
          notify({ phase: 'ready', message: 'Site is live!' });
          return site;
        }
      } else {
        console.log(`Site ${siteId} status: ${status} (waiting for 0/active)...`);
        notify({ phase: 'provisioning', message: 'Provisioning server and installing WordPress...' });
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    throw new Error(`Site ${siteId} did not become ready within ${maxWaitTime}ms`);
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
