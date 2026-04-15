/**
 * InstaWP Snapshot Debug Script
 *
 * Demonstrates that creating sites from snapshots with server_type: "instawp_serve"
 * fails silently — site goes from status 4 to 404 (deleted).
 * Snapshots with server_type: null work fine.
 *
 * Usage: INSTAWP_API_KEY=<your-key> node src/debug-instawp-snapshot.js <snapshot-slug>
 *
 * Example:
 *   INSTAWP_API_KEY=ULnKxfNvpUOsFZ0Vid0WcJkNnwSLC0OWRRk3OVgv node src/debug-instawp-snapshot.js waas-test-06-apr
 */

const API_BASE = 'https://app.instawp.io/api/v2';
const API_KEY = process.env.INSTAWP_API_KEY;
const SNAPSHOT_SLUG = process.argv[2];

if (!API_KEY || !SNAPSHOT_SLUG) {
  console.error('Usage: INSTAWP_API_KEY=<key> node src/debug-instawp-snapshot.js <snapshot-slug>');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

async function api(method, endpoint, body = null) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${endpoint}: ${res.status} — ${data.message}`);
  return data;
}

// --- Step 1: Show snapshot info ---
console.log(`\n=== Step 1: Snapshot info for "${SNAPSHOT_SLUG}" ===`);
const snapshotsRes = await api('GET', '/snapshots');
const snapshot = snapshotsRes.data.find(s => s.slug === SNAPSHOT_SLUG);
if (!snapshot) {
  // Try templates endpoint
  const templatesRes = await api('GET', '/templates?per_page=100');
  const template = templatesRes.data.find(t => t.slug === SNAPSHOT_SLUG);
  if (!template) {
    console.error(`Snapshot/template "${SNAPSHOT_SLUG}" not found`);
    process.exit(1);
  }
  console.log('Found in /templates');
  console.log('  server_type:', template.server_type);
  console.log('  site_cloning:', template.site_cloning);
  console.log('  status:', template.status);
  console.log('  file_bkp_path:', template.file_bkp_path);
  console.log('  source site_id:', template.site_id);
} else {
  console.log('Found in /snapshots');
  console.log('  server_type:', snapshot.server_type);
  console.log('  site_cloning:', snapshot.site_cloning);
  console.log('  status:', snapshot.status);
  console.log('  file_bkp_path:', snapshot.file_bkp_path);
  console.log('  source site_id:', snapshot.site_id);
}

// --- Step 2: Create site from snapshot ---
console.log(`\n=== Step 2: Create site from "${SNAPSHOT_SLUG}" ===`);
const createRes = await api('POST', '/sites/template', {
  snapshot_slug: SNAPSHOT_SLUG,
  site_name: `debug-${Date.now()}`,
});
const siteId = createRes.data.id;
const taskId = createRes.data.task_id;
console.log('  Site ID:', siteId);
console.log('  Task ID:', taskId);
console.log('  wp_url:', createRes.data.wp_url);

// --- Step 3: Poll for site readiness ---
console.log(`\n=== Step 3: Polling site ${siteId} ===`);
for (let i = 0; i < 20; i++) {
  await new Promise(r => setTimeout(r, 10000));
  try {
    const siteRes = await api('GET', `/sites/${siteId}`);
    const status = siteRes.data.status;
    console.log(`  Poll ${i + 1}: status=${status}`);
    if (status === 0 || status === '0') {
      console.log('\n  SUCCESS — site is ready!');
      console.log('  URL:', siteRes.data.url);
      console.log('  wp_username:', siteRes.data.site_meta?.wp_username || siteRes.data.wp_username || '(empty)');
      process.exit(0);
    }
  } catch (e) {
    console.log(`  Poll ${i + 1}: ${e.message}`);
    if (e.message.includes('404')) {
      console.log('\n  FAILURE — site was deleted by InstaWP during provisioning.');
      console.log('  This is the bug: site goes from status 4 → 404 (not found).');
      console.log('  Snapshots with server_type: "instawp_serve" reproduce this consistently.');
      console.log('  Snapshots with server_type: null (e.g. "wordtosite_template") work fine.');
      process.exit(1);
    }
  }
}
console.log('\n  TIMEOUT — site never became ready.');
process.exit(1);
