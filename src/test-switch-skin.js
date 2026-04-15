/**
 * E2E test: create site from snapshot → register → switch-skin
 *
 * Usage: node src/test-switch-skin.js [skin-slug]
 * Default skin: kindergarten
 */

import InstaWPAPI from './instawp.js';
import { config } from './config.js';
import WordPressService from './services/wordpress-service.js';

const skinSlug = process.argv[2] || 'kindergarten';

async function main() {
  console.log('=== Switch-Skin E2E Test ===');
  console.log(`Skin: ${skinSlug}`);
  console.log(`Snapshot: ${config.instawp.snapshotSlug}`);
  console.log('');

  const api = new InstaWPAPI();

  // Step 1: Create site from snapshot
  console.log('--- Step 1: Creating site from snapshot ---');
  const site = await api.createSiteFromTemplate(null, {
    snapshotSlug: config.instawp.snapshotSlug,
    siteName: `skin-test-${Date.now()}`,
  });
  console.log(`  Site ID: ${site.id}`);
  console.log('');

  // Step 2: Wait for site to be ready
  console.log('--- Step 2: Waiting for site to be ready ---');
  const readySite = await api.waitForSiteReady(site.id, {
    maxWaitTime: 180000,
    checkInterval: 10000,
    onProgress: ({ phase, message }) => console.log(`  [${phase}] ${message}`),
  });

  const url = readySite.url || readySite.wp_url;
  const username = readySite.wp_username || config.instawp.snapshotWpUsername;
  const password = readySite.wp_password || config.instawp.snapshotWpPassword;

  console.log(`  URL:      ${url}`);
  console.log(`  Username: ${username}`);
  console.log(`  Password: ${password ? '***' : '(empty)'}`);
  console.log('');

  if (!url || !username || !password) {
    console.error('Cannot proceed — missing credentials.');
    process.exit(1);
  }

  const wp = new WordPressService(url, { username, password });

  // Step 3: Register site with WaaS Wizard
  console.log('--- Step 3: registerSite() ---');
  try {
    const res = await wp.registerSite(username, password);
    console.log('  Result:', JSON.stringify(res));
  } catch (err) {
    console.error('  FAILED:', err.message);
  }
  console.log('');

  // Step 4: Switch skin (POST-based polling)
  console.log(`--- Step 4: switchSkin("${skinSlug}") ---`);
  try {
    const res = await wp.switchSkin(skinSlug, {
      onProgress: (p) => console.log(`  [${p.phase}] ${p.message}${p.status ? ` (status: ${p.status})` : ''}`),
      maxAttempts: 100,
      pollInterval: 3000,
    });
    console.log(`  Result: ${res.success ? 'SUCCESS' : 'FAILED'}`);
  } catch (err) {
    console.error('  FAILED:', err.message);
  }

  console.log('');
  console.log('Done. Visit the site to verify:', url);
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
