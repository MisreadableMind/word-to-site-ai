import crypto from 'crypto';
import pool from '../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class ProxyService {

  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const migrationPath = path.join(__dirname, '../db/migrations/002-ai-proxy.sql');
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      await pool.query(sql);
      this.initialized = true;
      console.log('AI Proxy database initialized');
    } catch (error) {
      console.error('Failed to initialize AI Proxy database:', error.message);
    }
  }

  // ==========================================
  // API KEY MANAGEMENT
  // ==========================================

  generateApiKey() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = crypto.randomBytes(40);
    let key = 'wts_';
    for (let i = 0; i < 40; i++) {
      key += chars[bytes[i] % chars.length];
    }
    return key;
  }

  async registerSite(domain, label) {
    await this.initialize();

    const apiKey = this.generateApiKey();

    const result = await pool.query(
      `INSERT INTO proxy_sites (domain, api_key, label)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [domain, apiKey, label || domain]
    );

    return result.rows[0];
  }

  async validateKey(apiKey) {
    await this.initialize();

    const result = await pool.query(
      "SELECT * FROM proxy_sites WHERE api_key = $1 AND status = 'active'",
      [apiKey]
    );

    return result.rows[0] || null;
  }

  async getSiteByDomain(domain) {
    await this.initialize();

    const result = await pool.query(
      'SELECT * FROM proxy_sites WHERE domain = $1',
      [domain]
    );

    return result.rows[0] || null;
  }

  async getSiteById(siteId) {
    await this.initialize();

    const result = await pool.query(
      'SELECT * FROM proxy_sites WHERE id = $1',
      [siteId]
    );

    return result.rows[0] || null;
  }

  // ==========================================
  // USAGE & QUOTA
  // ==========================================

  async logRequest(siteId, domain, data) {
    // Fire-and-forget — don't await in the caller
    try {
      await pool.query(
        `INSERT INTO proxy_request_log
           (site_id, domain, model, endpoint, method,
            prompt_tokens, completion_tokens, total_tokens,
            response_status, latency_ms, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          siteId,
          domain,
          data.model || null,
          data.endpoint || null,
          data.method || 'POST',
          data.prompt_tokens || 0,
          data.completion_tokens || 0,
          data.total_tokens || 0,
          data.response_status || null,
          data.latency_ms || null,
          data.error_message || null,
        ]
      );
    } catch (error) {
      console.error('Failed to log proxy request:', error.message);
    }
  }

  async getMonthlyUsage(siteId) {
    await this.initialize();

    const result = await pool.query(
      `SELECT COALESCE(SUM(total_tokens), 0) AS total_tokens
       FROM proxy_request_log
       WHERE site_id = $1
         AND requested_at >= date_trunc('month', NOW())`,
      [siteId]
    );

    return parseInt(result.rows[0].total_tokens, 10);
  }

  async checkQuota(siteId, limit) {
    const used = await this.getMonthlyUsage(siteId);
    return {
      allowed: used < limit,
      used,
      limit,
      remaining: Math.max(0, limit - used),
    };
  }

  async getRecentRequests(siteId, limit = 50) {
    await this.initialize();

    const result = await pool.query(
      `SELECT * FROM proxy_request_log
       WHERE site_id = $1
       ORDER BY requested_at DESC
       LIMIT $2`,
      [siteId, limit]
    );

    return result.rows;
  }

  // ==========================================
  // ADMIN
  // ==========================================

  async listSites(offset = 0, limit = 50) {
    await this.initialize();

    const result = await pool.query(
      `SELECT ps.*,
              COALESCE(usage.monthly_tokens, 0) AS monthly_tokens_used
       FROM proxy_sites ps
       LEFT JOIN LATERAL (
         SELECT SUM(total_tokens) AS monthly_tokens
         FROM proxy_request_log
         WHERE site_id = ps.id
           AND requested_at >= date_trunc('month', NOW())
       ) usage ON true
       ORDER BY ps.created_at DESC
       OFFSET $1 LIMIT $2`,
      [offset, limit]
    );

    return result.rows;
  }

  async updateSiteStatus(siteId, status) {
    await this.initialize();

    const updates = { status };
    if (status === 'revoked') {
      updates.revoked_at = new Date().toISOString();
    }

    const result = await pool.query(
      `UPDATE proxy_sites
       SET status = $2, revoked_at = ${status === 'revoked' ? 'NOW()' : 'revoked_at'}
       WHERE id = $1
       RETURNING *`,
      [siteId, status]
    );

    return result.rows[0] || null;
  }

  // ==========================================
  // OPENAI RESPONSES API PASSTHROUGH
  // ==========================================

  async forwardToOpenAI(body) {
    const apiKey = config.openai?.apiKey;
    if (!apiKey) throw new Error('OpenAI API key not configured on proxy server');

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errMsg = data?.error?.message || `OpenAI API error: ${response.status}`;
      const err = new Error(errMsg);
      err.status = response.status;
      err.openaiError = data;
      throw err;
    }

    return data;
  }
}
