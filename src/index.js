import { config, validateConfig } from './config.js';
import InstaWPAPI from './instawp.js';
import DomainWorkflow from './domain-workflow.js';

class InstaWPSiteCreator {
  constructor(apiKey = null) {
    this.apiKey = apiKey;
    this.instawp = new InstaWPAPI(apiKey);
  }

  async createSite(options = {}) {
    console.log('\n========================================');
    console.log('InstaWP Site Creation');
    console.log('========================================\n');

    try {
      // Step 1: Create site
      console.log('\n--- Step 1: Creating InstaWP Site ---');
      const site = await this.instawp.createSiteFromTemplate(null, {
        isShared: options.isShared !== undefined ? options.isShared : false,
        isReserved: options.isReserved !== undefined ? options.isReserved : true,
        siteName: options.siteName || undefined,
        wpVersion: options.wpVersion || '6.8.1',
        phpVersion: options.phpVersion || '8.0',
        planId: options.planId || 2,
      });

      console.log(`Site created successfully!`);
      console.log(`   - Site ID: ${site.id}`);
      console.log(`   - Site URL: ${site.wp_url || site.url}`);
      console.log(`   - WP Username: ${site.wp_username}`);
      console.log(`   - WP Password: ${site.wp_password}`);

      // Step 2: Wait for site to be ready
      console.log('\n--- Step 2: Waiting for Site to be Ready ---');
      const readySite = await this.instawp.waitForSiteReady(site.id, {
        onProgress: options.onProgress,
      });
      console.log(`Site is ready!`);

      // Final summary
      console.log('\n========================================');
      console.log('Site Creation Complete!');
      console.log('========================================\n');
      console.log(`Site ID: ${site.id}`);
      console.log(`Site URL: ${readySite.wp_url || readySite.url}`);
      console.log(`WP Admin: ${readySite.wp_admin_url || (readySite.wp_url || readySite.url) + '/wp-admin'}`);
      console.log(`WP Username: ${site.wp_username}`);
      console.log(`WP Password: ${site.wp_password}`);

      console.log('\nNext Steps:');
      console.log('1. Visit your site URL to see your new WordPress site');
      console.log('2. Login to WordPress admin with the credentials above');
      console.log('3. You can optionally map a custom domain to your site later\n');

      // Build direct auto-login URL that bypasses InstaWP dashboard
      const siteUrl = readySite.wp_url || readySite.url || '';
      const magicLoginUrl = (siteUrl && site.wp_username && site.wp_password)
        ? `/api/wp-auto-login?url=${encodeURIComponent(siteUrl)}&u=${encodeURIComponent(site.wp_username)}&p=${encodeURIComponent(site.wp_password)}`
        : '';

      return {
        success: true,
        site: {
          ...readySite,
          wp_url: siteUrl,
          wp_username: site.wp_username,
          wp_password: site.wp_password,
          magic_login_url: magicLoginUrl,
        },
      };

    } catch (error) {
      console.error('\nError:', error.message);
      console.error('\nFull error:', error);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create site with full domain workflow
   * @param {Object} options
   * @param {string} options.domain - Domain name (e.g., "example.com")
   * @param {boolean} options.registerNewDomain - Whether to register new domain via Namecheap
   * @param {string} options.siteName - Optional site name
   * @param {Object} options.contacts - Optional contact info for domain registration
   * @param {boolean} options.includeWww - Include www subdomain (default: true)
   * @param {number} options.registrationYears - Years to register domain (default: 1)
   * @param {Function} options.onProgress - Progress callback function
   */
  async createSiteWithDomain(options = {}) {
    console.log('\n========================================');
    console.log('InstaWP Site Creation with Domain');
    console.log('========================================\n');

    const workflow = new DomainWorkflow({
      instawpApiKey: this.apiKey,
      onProgress: (progress) => {
        console.log(`[${progress.step}] ${progress.message || ''}`);
        if (options.onProgress) {
          options.onProgress(progress);
        }
      },
    });

    const result = await workflow.execute({
      domain: options.domain,
      registerNewDomain: options.registerNewDomain || false,
      siteName: options.siteName,
      contacts: options.contacts,
      includeWww: options.includeWww !== false,
      registrationYears: options.registrationYears || 1,
    });

    if (result.success) {
      console.log('\n========================================');
      console.log('Site Creation Complete!');
      console.log('========================================\n');
      console.log(`Domain: ${result.domain}`);
      console.log(`Site URL: ${result.finalUrls.site}`);
      console.log(`WP Admin: ${result.finalUrls.wpAdmin}`);
      console.log(`Temporary URL: ${result.finalUrls.temporaryUrl}`);

      if (result.site) {
        console.log(`\nWordPress Credentials:`);
        console.log(`  Username: ${result.site.wp_username}`);
        console.log(`  Password: ${result.site.wp_password}`);
      }

      if (result.nameserverInstructions) {
        console.log(`\n${result.nameserverInstructions.message}`);
        result.nameserverInstructions.nameservers.forEach((ns) => {
          console.log(`  - ${ns}`);
        });
        console.log(`\n${result.nameserverInstructions.note}`);
      }

      console.log('\nSSL will be automatically activated once DNS propagates (5-15 minutes).\n');
    } else {
      console.error('\nError:', result.error);
    }

    return result;
  }

  /**
   * Check domain availability
   * @param {string} domain - Domain name to check
   */
  async checkDomain(domain) {
    const workflow = new DomainWorkflow({ instawpApiKey: this.apiKey });
    return await workflow.checkDomainAvailability(domain);
  }
}

export default InstaWPSiteCreator;
