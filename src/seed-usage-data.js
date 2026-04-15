/**
 * Seed script: creates a test user with sites and proxy usage data
 * so the /usage.html page has data to display.
 *
 * Usage: DATABASE_URL=postgresql://wordtosite:wordtosite@localhost:5555/wordtosite node src/seed-usage-data.js
 *
 * After running, log in with: test@wordtosite.com / testtest
 */
import pool from './db.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function seed() {
  // Run all migrations
  for (const file of ['001-plugin-api.sql', '002-ai-proxy.sql', '003-user-auth.sql', '004-user-sites.sql']) {
    const sql = fs.readFileSync(path.join(__dirname, 'db/migrations', file), 'utf-8');
    await pool.query(sql);
  }
  console.log('Migrations applied');

  // Create or get test user (password: "testtest")
  // bcrypt hash for "testtest" with 12 rounds
  const passwordHash = '$2b$12$LJ3m4ys3Lz0QKn1YqYKZxOQGZ1kBXXrJ8WF7GvN0YJ2Jz5KFXW8S6';
  const { rows: userRows } = await pool.query(
    `INSERT INTO users (email, password_hash, display_name, plan_tier)
     VALUES ('test@wordtosite.com', $1, 'Test User', 'pro')
     ON CONFLICT (email) DO UPDATE SET display_name = 'Test User'
     RETURNING id, email`,
    [passwordHash]
  );
  const userId = userRows[0].id;
  console.log(`Test user: ${userRows[0].email} (id=${userId})`);

  // Create a session token so we can auto-login via cookie
  const sessionToken = 'seed_session_' + crypto.randomBytes(20).toString('hex');
  await pool.query(
    `INSERT INTO user_sessions (user_id, token, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
    [userId, sessionToken]
  );
  console.log(`Session token: ${sessionToken}`);
  console.log(`  Set cookie: document.cookie = "session=${sessionToken}; path=/"`);

  // Demo sites
  const demoDomains = [
    { domain: 'acme-corp.instawp.dev', label: 'Acme Corp', tokenLimit: 100000 },
    { domain: 'sunrise-bakery.instawp.dev', label: 'Sunrise Bakery', tokenLimit: 50000 },
    { domain: 'techflow.instawp.dev', label: 'TechFlow Studio', tokenLimit: 200000 },
  ];

  for (const { domain, label, tokenLimit } of demoDomains) {
    // Create user_sites entry
    await pool.query(
      `INSERT INTO user_sites (user_id, domain, wp_url, site_name, status)
       VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT DO NOTHING`,
      [userId, domain, `https://${domain}`, label]
    );

    // Upsert proxy_sites entry
    const { rows } = await pool.query(
      `INSERT INTO proxy_sites (domain, api_key, label, status, monthly_token_limit)
       VALUES ($1, $2, $3, 'active', $4)
       ON CONFLICT (domain) DO UPDATE SET label = EXCLUDED.label, monthly_token_limit = EXCLUDED.monthly_token_limit
       RETURNING *`,
      [domain, 'wts_seed_' + domain.replace(/[^a-z0-9]/g, '').slice(0, 30), label, tokenLimit]
    );
    const proxySite = rows[0];
    console.log(`\nProxy site: ${proxySite.domain} (limit=${tokenLimit})`);

    // Check if we already have request logs
    const { rows: existing } = await pool.query(
      `SELECT COUNT(*) as cnt FROM proxy_request_log WHERE site_id = $1`,
      [proxySite.id]
    );

    if (parseInt(existing[0].cnt) > 0) {
      console.log(`  Already has ${existing[0].cnt} request logs, skipping`);
      continue;
    }

    // Generate fake requests — varying amounts per site
    const requestCount = domain.includes('acme') ? 35 : domain.includes('sunrise') ? 12 : 50;
    const models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4o'];
    const now = Date.now();

    for (let i = 0; i < requestCount; i++) {
      const daysAgo = Math.floor(Math.random() * 14);
      const hoursAgo = Math.floor(Math.random() * 24);
      const ts = new Date(now - daysAgo * 86400000 - hoursAgo * 3600000);
      const model = models[Math.floor(Math.random() * models.length)];
      const promptTokens = 200 + Math.floor(Math.random() * 1800);
      const completionTokens = 100 + Math.floor(Math.random() * 2000);
      const status = Math.random() > 0.05 ? 200 : 500;

      await pool.query(
        `INSERT INTO proxy_request_log
         (site_id, domain, model, endpoint, method, prompt_tokens, completion_tokens, total_tokens, response_status, latency_ms, requested_at)
         VALUES ($1, $2, $3, '/v1/responses', 'POST', $4, $5, $6, $7, $8, $9)`,
        [
          proxySite.id,
          domain,
          model,
          promptTokens,
          completionTokens,
          promptTokens + completionTokens,
          300 + Math.floor(Math.random() * 2000),
          ts,
        ]
      );
    }

    // Sum current month tokens
    const { rows: usage } = await pool.query(
      `SELECT COALESCE(SUM(total_tokens), 0) as total FROM proxy_request_log
       WHERE site_id = $1
         AND requested_at >= date_trunc('month', CURRENT_TIMESTAMP)`,
      [proxySite.id]
    );
    console.log(`  Seeded ${requestCount} requests, current month tokens: ${usage[0].total}/${tokenLimit}`);
  }

  console.log('\n========================================');
  console.log('Done! To test:');
  console.log('1. Start the app: npm run dev');
  console.log('2. Go to http://localhost:3000/login.html');
  console.log('3. Log in with: test@wordtosite.com / testtest');
  console.log('4. Visit http://localhost:3000/usage.html');
  console.log('========================================');

  await pool.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
