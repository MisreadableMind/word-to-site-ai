import crypto from 'crypto';
import { sql, eq } from 'drizzle-orm';
import { db, users, userSessions, userSites, proxySites, proxyRequestLog } from './db/client';

async function seed() {
  const passwordHash = '$2b$12$LJ3m4ys3Lz0QKn1YqYKZxOQGZ1kBXXrJ8WF7GvN0YJ2Jz5KFXW8S6';
  const userRows = await db
    .insert(users)
    .values({ email: 'test@wordtosite.com', passwordHash, displayName: 'Test User', planTier: 'pro' })
    .onConflictDoUpdate({ target: users.email, set: { displayName: 'Test User' } })
    .returning({ id: users.id, email: users.email });
  const userId = userRows[0].id;
  console.log(`Test user: ${userRows[0].email} (id=${userId})`);

  const sessionToken = 'seed_session_' + crypto.randomBytes(20).toString('hex');
  await db
    .insert(userSessions)
    .values({ userId, token: sessionToken, expiresAt: sql`NOW() + INTERVAL '7 days'` });
  console.log(`Session token: ${sessionToken}`);
  console.log(`  Set cookie: document.cookie = "session=${sessionToken}; path=/"`);

  const demoDomains = [
    { domain: 'acme-corp.instawp.dev', label: 'Acme Corp', tokenLimit: 100000 },
    { domain: 'sunrise-bakery.instawp.dev', label: 'Sunrise Bakery', tokenLimit: 50000 },
    { domain: 'techflow.instawp.dev', label: 'TechFlow Studio', tokenLimit: 200000 },
  ];

  for (const { domain, label, tokenLimit } of demoDomains) {
    await db
      .insert(userSites)
      .values({ userId, domain, wpUrl: `https://${domain}`, siteName: label, status: 'active' })
      .onConflictDoNothing();

    const rows = await db
      .insert(proxySites)
      .values({
        domain,
        apiKey: 'wts_seed_' + domain.replace(/[^a-z0-9]/g, '').slice(0, 30),
        label,
        status: 'active',
        monthlyTokenLimit: tokenLimit,
      })
      .onConflictDoUpdate({
        target: proxySites.domain,
        set: { label, monthlyTokenLimit: tokenLimit },
      })
      .returning();
    const proxySite = rows[0];
    console.log(`\nProxy site: ${proxySite.domain} (limit=${tokenLimit})`);

    const existing = await db
      .select({ cnt: sql<string>`COUNT(*)` })
      .from(proxyRequestLog)
      .where(eq(proxyRequestLog.siteId, proxySite.id));

    if (parseInt(existing[0].cnt) > 0) {
      console.log(`  Already has ${existing[0].cnt} request logs, skipping`);
      continue;
    }

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

      await db.insert(proxyRequestLog).values({
        siteId: proxySite.id,
        domain,
        model,
        endpoint: '/v1/responses',
        method: 'POST',
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        responseStatus: status,
        latencyMs: 300 + Math.floor(Math.random() * 2000),
        requestedAt: ts.toISOString(),
      });
    }

    const { rows: usage } = await db.execute<{ total: string }>(sql`
      SELECT COALESCE(SUM(total_tokens), 0) as total FROM proxy_request_log
       WHERE site_id = ${proxySite.id}
         AND requested_at >= date_trunc('month', CURRENT_TIMESTAMP)`);
    console.log(`  Seeded ${requestCount} requests, current month tokens: ${usage[0].total}/${tokenLimit}`);
  }

  console.log('\n========================================');
  console.log('Done! To test:');
  console.log('1. Start the app: npm run dev');
  console.log('2. Go to http://localhost:3000/login.html');
  console.log('3. Log in with: test@wordtosite.com / testtest');
  console.log('4. Visit http://localhost:3000/usage.html');
  console.log('========================================');

  await db.$client.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
