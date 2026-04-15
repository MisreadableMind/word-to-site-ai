import InstaWPAPI from './instawp.js';

const SNAPSHOT_SLUG = 'waas-snapshot';
const SNAPSHOT_ID = 22050;

async function main() {
  console.log('=== InstaWP Snapshot Site Creation Test ===');
  console.log(`Snapshot slug: ${SNAPSHOT_SLUG}`);
  console.log(`Snapshot ID: ${SNAPSHOT_ID}`);
  console.log('');

  const api = new InstaWPAPI();

  // Step 1: Create site from snapshot
  console.log('--- Step 1: Creating site from snapshot ---');
  const site = await api.createSiteFromTemplate(null, {
    snapshotSlug: SNAPSHOT_SLUG,
    siteName: 'vitalii-test',
  });

  console.log('Site creation response:', JSON.stringify(site, null, 2));
  console.log('');

  // Step 2: Wait for site to be ready
  console.log('--- Step 2: Waiting for site to be ready ---');
  const readySite = await api.waitForSiteReady(site.id, {
    maxWaitTime: 180000,
    checkInterval: 10000,
    onProgress: ({ phase, message }) => {
      console.log(`  [${phase}] ${message}`);
    },
  });

  console.log('');
  console.log('=== Site Ready ===');
  console.log(`  ID:    ${readySite.id}`);
  console.log(`  URL:   ${readySite.url || readySite.wp_url}`);
  console.log(`  Admin: ${readySite.wp_url || readySite.url}/wp-admin`);
  console.log('  Full details:', JSON.stringify(readySite, null, 2));
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
