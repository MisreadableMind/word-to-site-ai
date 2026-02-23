import axios from 'axios';
import { config } from './config.js';

class CloudflareAPI {
  constructor() {
    this.apiUrl = 'https://api.cloudflare.com/client/v4';
    this.apiKey = config.cloudflare.apiKey;
    this.email = config.cloudflare.email;
    this.accountId = config.cloudflare.accountId;
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    const url = `${this.apiUrl}${endpoint}`;

    const headers = {
      'X-Auth-Email': this.email,
      'X-Auth-Key': this.apiKey,
      'Content-Type': 'application/json',
    };

    try {
      const response = await axios({
        method,
        url,
        headers,
        data,
      });

      if (!response.data.success) {
        const errors = response.data.errors.map(e => e.message).join(', ');
        throw new Error(`Cloudflare API Error: ${errors}`);
      }

      return response.data;
    } catch (error) {
      if (error.response) {
        const errorMessage = error.response.data?.errors?.[0]?.message || error.response.statusText;
        throw new Error(`Cloudflare API Error: ${error.response.status} - ${errorMessage}`);
      }
      throw error;
    }
  }

  async listZones() {
    console.log('Fetching Cloudflare zones...');
    const response = await this.makeRequest('/zones');
    return response.result;
  }

  async getZone(domainName) {
    console.log(`Looking for zone: ${domainName}`);

    const response = await this.makeRequest(`/zones?name=${domainName}`);

    if (response.result.length === 0) {
      return null;
    }

    return response.result[0];
  }

  async createZone(domainName) {
    console.log(`Creating Cloudflare zone for: ${domainName}`);

    const data = {
      name: domainName,
      account: {
        id: this.accountId,
      },
      jump_start: true, // Automatically scan for DNS records
    };

    const response = await this.makeRequest('/zones', 'POST', data);

    console.log(`✅ Zone created successfully!`);
    console.log(`   Zone ID: ${response.result.id}`);
    console.log(`   Nameservers:`);
    response.result.name_servers.forEach(ns => {
      console.log(`   - ${ns}`);
    });

    return response.result;
  }

  async getOrCreateZone(domainName) {
    let zone = await this.getZone(domainName);

    if (!zone) {
      zone = await this.createZone(domainName);
    } else {
      console.log(`✅ Zone already exists for ${domainName}`);
    }

    return zone;
  }

  async listDnsRecords(zoneId, type = null, name = null) {
    console.log(`Fetching DNS records for zone: ${zoneId}`);

    let endpoint = `/zones/${zoneId}/dns_records`;
    const params = [];

    if (type) params.push(`type=${type}`);
    if (name) params.push(`name=${name}`);

    if (params.length > 0) {
      endpoint += '?' + params.join('&');
    }

    const response = await this.makeRequest(endpoint);
    return response.result;
  }

  async createDnsRecord(zoneId, record) {
    console.log(`Creating DNS record: ${record.type} ${record.name} -> ${record.content}`);

    const data = {
      type: record.type,
      name: record.name,
      content: record.content,
      ttl: record.ttl || 1, // 1 = automatic
      proxied: record.proxied !== undefined ? record.proxied : false,
    };

    const response = await this.makeRequest(
      `/zones/${zoneId}/dns_records`,
      'POST',
      data
    );

    console.log(`✅ DNS record created: ${response.result.id}`);
    return response.result;
  }

  async updateDnsRecord(zoneId, recordId, updates) {
    console.log(`Updating DNS record: ${recordId}`);

    const response = await this.makeRequest(
      `/zones/${zoneId}/dns_records/${recordId}`,
      'PUT',
      updates
    );

    console.log(`✅ DNS record updated`);
    return response.result;
  }

  async deleteDnsRecord(zoneId, recordId) {
    console.log(`Deleting DNS record: ${recordId}`);

    await this.makeRequest(
      `/zones/${zoneId}/dns_records/${recordId}`,
      'DELETE'
    );

    console.log(`✅ DNS record deleted`);
  }

  async deleteAllRecords(zoneId, type = null) {
    console.log(`Deleting all ${type || 'DNS'} records from zone...`);

    const records = await this.listDnsRecords(zoneId, type);

    for (const record of records) {
      await this.deleteDnsRecord(zoneId, record.id);
    }

    console.log(`✅ Deleted ${records.length} records`);
  }

  async setARecords(zoneId, domainName, ipAddresses, includeWww = false) {
    console.log(`Setting A records for ${domainName}`);

    // Delete existing A records for root and www
    const existingRecords = await this.listDnsRecords(zoneId, 'A');
    const toDelete = existingRecords.filter(r =>
      r.name === domainName ||
      r.name === `www.${domainName}` ||
      r.name === '@' ||
      r.name === 'www'
    );

    for (const record of toDelete) {
      await this.deleteDnsRecord(zoneId, record.id);
    }

    // Create new A records for root domain
    for (const ip of ipAddresses) {
      await this.createDnsRecord(zoneId, {
        type: 'A',
        name: domainName, // Cloudflare expects full domain name
        content: ip,
        ttl: 1, // Automatic
        proxied: true, // Enable Cloudflare proxy for CDN/DDoS protection
      });
    }

    // Create www records if requested
    if (includeWww) {
      for (const ip of ipAddresses) {
        await this.createDnsRecord(zoneId, {
          type: 'A',
          name: `www.${domainName}`,
          content: ip,
          ttl: 1,
          proxied: true,
        });
      }
    }

    console.log(`✅ A records configured successfully`);
  }

  async getNameservers(domainName) {
    const zone = await this.getOrCreateZone(domainName);
    return zone.name_servers;
  }

  async enableUniversalSSL(zoneId) {
    console.log(`Enabling Universal SSL for zone: ${zoneId}`);

    try {
      // Universal SSL is typically enabled by default
      // This endpoint verifies it's enabled
      const response = await this.makeRequest(
        `/zones/${zoneId}/settings/ssl`,
        'PATCH',
        { value: 'flexible' } // or 'full' if origin supports SSL
      );

      console.log(`✅ SSL mode set to: ${response.result.value}`);
      return response.result;
    } catch (error) {
      console.warn(`⚠️  Could not configure SSL: ${error.message}`);
      console.warn('   Universal SSL should be enabled automatically.');
    }
  }

  async enableAlwaysUseHTTPS(zoneId) {
    console.log(`Enabling Always Use HTTPS for zone: ${zoneId}`);

    try {
      const response = await this.makeRequest(
        `/zones/${zoneId}/settings/always_use_https`,
        'PATCH',
        { value: 'on' }
      );

      console.log(`✅ Always Use HTTPS enabled`);
      return response.result;
    } catch (error) {
      console.warn(`⚠️  Could not enable Always Use HTTPS: ${error.message}`);
    }
  }

  async configureSecurity(zoneId) {
    console.log(`Configuring Cloudflare security settings...`);

    const settings = [
      // Enable HTTPS redirect
      { name: 'always_use_https', value: 'on' },
      // SSL mode
      { name: 'ssl', value: 'flexible' },
      // Security level
      { name: 'security_level', value: 'medium' },
      // Browser integrity check
      { name: 'browser_check', value: 'on' },
      // Challenge passage
      { name: 'challenge_ttl', value: 1800 },
    ];

    for (const setting of settings) {
      try {
        await this.makeRequest(
          `/zones/${zoneId}/settings/${setting.name}`,
          'PATCH',
          { value: setting.value }
        );
        console.log(`   ✅ ${setting.name}: ${setting.value}`);
      } catch (error) {
        console.warn(`   ⚠️  Could not set ${setting.name}: ${error.message}`);
      }
    }
  }

  async configurePerformance(zoneId) {
    console.log(`Configuring Cloudflare performance settings...`);

    const settings = [
      // Enable Brotli compression
      { name: 'brotli', value: 'on' },
      // Minification
      { name: 'minify', value: { css: 'on', html: 'on', js: 'on' } },
      // Auto minify
      { name: 'rocket_loader', value: 'on' },
      // HTTP/2
      { name: 'http2', value: 'on' },
      // HTTP/3
      { name: 'http3', value: 'on' },
    ];

    for (const setting of settings) {
      try {
        await this.makeRequest(
          `/zones/${zoneId}/settings/${setting.name}`,
          'PATCH',
          { value: setting.value }
        );
        console.log(`   ✅ ${setting.name} enabled`);
      } catch (error) {
        console.warn(`   ⚠️  Could not set ${setting.name}: ${error.message}`);
      }
    }
  }

  async getZoneSettings(zoneId) {
    console.log(`Fetching zone settings for: ${zoneId}`);

    const response = await this.makeRequest(`/zones/${zoneId}/settings`);
    return response.result;
  }

  async verifyDnsSetup(zoneId, domainName) {
    console.log(`Verifying DNS setup for ${domainName}`);

    const records = await this.listDnsRecords(zoneId, 'A');
    const rootRecords = records.filter(r => r.name === domainName);

    if (rootRecords.length === 0) {
      throw new Error(`No A records found for ${domainName}`);
    }

    console.log(`✅ Found ${rootRecords.length} A record(s)`);
    rootRecords.forEach(r => {
      console.log(`   - ${r.name} -> ${r.content} (Proxied: ${r.proxied})`);
    });

    return rootRecords;
  }
}

export default CloudflareAPI;
