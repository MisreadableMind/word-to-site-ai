/**
 * E2E test: register-site + switch-skin on a real InstaWP site
 *
 * Usage: node src/test-register-site.js [site-id] [skin-slug]
 */

import InstaWPAPI from './instawp.js';
import WordPressService from './services/wordpress-service.js';

const siteId = process.argv[2];
const skinSlug = process.argv[3] || 'car-repair';

if (!siteId) {
  console.error('Usage: node src/test-register-site.js <site-id> [skin-slug]');
  console.error('Example: node src/test-register-site.js 2415826 cleaning');
  process.exit(1);
}

// Step 1: Fetch site details from InstaWP
console.log(`\n=== Step 1: Fetch site ${siteId} from InstaWP ===`);
const api = new InstaWPAPI();
const raw = await api.getSite(siteId);

const url = raw.url || raw.wp_url || '';
const username = raw.wp_username || raw.site_meta?.wp_username || '';
const password = raw.wp_password || raw.site_meta?.wp_password || '';

console.log(`  URL:      ${url}`);
console.log(`  Username: ${username}`);
console.log(`  Password: ${password ? '***' : '(empty)'}`);

if (!url || !username || !password) {
  console.error('\nCannot proceed — missing credentials.');
  process.exit(1);
}

const wp = new WordPressService(url, { username, password });

// Step 2: Register site with WaaS Wizard
console.log(`\n=== Step 2: registerSite() ===`);
try {
  const res = await wp.registerSite(username, password);
  console.log('  Result:', JSON.stringify(res));
} catch (err) {
  console.error('  FAILED:', err.message);
}

// Step 3: Switch skin
console.log(`\n=== Step 3: switchSkin("${skinSlug}") ===`);
try {
  const res = await wp.switchSkin(skinSlug, {
    onProgress: (p) => console.log(`  [${p.phase}] ${p.message}`),
  });
  console.log('  Result:', res.success ? 'SUCCESS' : 'FAILED');
} catch (err) {
  console.error('  FAILED:', err.message);
}

console.log('\nDone. Visit the site to verify:', url);
