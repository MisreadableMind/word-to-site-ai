import crypto from 'crypto';
import OpenAI from 'openai';
import { sql, eq, and, desc } from 'drizzle-orm';
import { db, proxySites, proxyRequestLog } from '../db/client';
import { config } from '../config';

const proxySiteColumns = {
  id: proxySites.id,
  domain: proxySites.domain,
  api_key: proxySites.apiKey,
  label: proxySites.label,
  status: proxySites.status,
  monthly_token_limit: proxySites.monthlyTokenLimit,
  created_at: proxySites.createdAt,
  revoked_at: proxySites.revokedAt,
  wp_url: proxySites.wpUrl,
};

const proxyRequestLogColumns = {
  id: proxyRequestLog.id,
  site_id: proxyRequestLog.siteId,
  domain: proxyRequestLog.domain,
  model: proxyRequestLog.model,
  endpoint: proxyRequestLog.endpoint,
  method: proxyRequestLog.method,
  prompt_tokens: proxyRequestLog.promptTokens,
  completion_tokens: proxyRequestLog.completionTokens,
  total_tokens: proxyRequestLog.totalTokens,
  response_status: proxyRequestLog.responseStatus,
  latency_ms: proxyRequestLog.latencyMs,
  error_message: proxyRequestLog.errorMessage,
  requested_at: proxyRequestLog.requestedAt,
};

export default class ProxyService {
  initialized: boolean;
  openai: OpenAI | null;

  constructor() {
    this.initialized = false;
    this.openai = config.openai?.apiKey
      ? new OpenAI({ apiKey: config.openai.apiKey })
      : null;
  }

  async initialize() {
    this.initialized = true;
  }

  generateApiKey() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = crypto.randomBytes(40);
    let key = 'wts_';
    for (let i = 0; i < 40; i++) {
      key += chars[bytes[i] % chars.length];
    }
    return key;
  }

  async registerSite(domain: string, label: string, wpUrl: string, options: { monthlyTokenLimit?: number } = {}) {
    await this.initialize();

    const apiKey = this.generateApiKey();
    const tokenLimit = options.monthlyTokenLimit;

    if (tokenLimit != null) {
      const rows = await db
        .insert(proxySites)
        .values({
          domain,
          apiKey,
          label: label || domain,
          wpUrl: wpUrl || null,
          monthlyTokenLimit: tokenLimit,
        })
        .returning(proxySiteColumns);
      return rows[0];
    }

    const rows = await db
      .insert(proxySites)
      .values({
        domain,
        apiKey,
        label: label || domain,
        wpUrl: wpUrl || null,
      })
      .returning(proxySiteColumns);
    return rows[0];
  }

  async validateKey(apiKey: string) {
    await this.initialize();

    const rows = await db
      .select(proxySiteColumns)
      .from(proxySites)
      .where(and(eq(proxySites.apiKey, apiKey), eq(proxySites.status, 'active')))
      .limit(1);

    return rows[0] || null;
  }

  async getSiteByDomain(domain: string) {
    await this.initialize();

    const rows = await db
      .select(proxySiteColumns)
      .from(proxySites)
      .where(eq(proxySites.domain, domain))
      .limit(1);

    return rows[0] || null;
  }

  async getSiteById(siteId: string) {
    await this.initialize();

    const rows = await db
      .select(proxySiteColumns)
      .from(proxySites)
      .where(eq(proxySites.id, siteId))
      .limit(1);

    return rows[0] || null;
  }

  async logRequest(
    siteId: string,
    domain: string,
    data: {
      model?: string;
      endpoint?: string;
      method?: string;
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
      response_status?: number;
      latency_ms?: number;
      error_message?: string;
    }
  ) {
    try {
      await db.insert(proxyRequestLog).values({
        siteId,
        domain,
        model: data.model || null,
        endpoint: data.endpoint || null,
        method: data.method || 'POST',
        promptTokens: data.prompt_tokens || 0,
        completionTokens: data.completion_tokens || 0,
        totalTokens: data.total_tokens || 0,
        responseStatus: data.response_status || null,
        latencyMs: data.latency_ms || null,
        errorMessage: data.error_message || null,
      });
    } catch (error) {
      console.error('Failed to log proxy request:', (error as Error).message);
    }
  }

  async getMonthlyUsage(siteId: string) {
    await this.initialize();

    const { rows } = await db.execute<{ total_tokens: string }>(sql`
      SELECT COALESCE(SUM(total_tokens), 0) AS total_tokens
      FROM proxy_request_log
      WHERE site_id = ${siteId}
        AND requested_at >= date_trunc('month', NOW())
    `);

    return parseInt(rows[0].total_tokens, 10);
  }

  async checkQuota(siteId: string, limit: number) {
    const used = await this.getMonthlyUsage(siteId);
    return {
      allowed: used < limit,
      used,
      limit,
      remaining: Math.max(0, limit - used),
    };
  }

  async getRecentRequests(siteId: string, limit = 50) {
    await this.initialize();

    const rows = await db
      .select(proxyRequestLogColumns)
      .from(proxyRequestLog)
      .where(eq(proxyRequestLog.siteId, siteId))
      .orderBy(desc(proxyRequestLog.requestedAt))
      .limit(limit);

    return rows;
  }

  async listSites(offset = 0, limit = 50) {
    await this.initialize();

    const { rows } = await db.execute(sql`
      SELECT ps.*,
             COALESCE(usage.monthly_tokens, 0) AS monthly_tokens_used
      FROM proxy_sites ps
      LEFT JOIN LATERAL (
        SELECT SUM(total_tokens) AS monthly_tokens
        FROM proxy_request_log
        WHERE site_id = ps.id
          AND requested_at >= date_trunc('month', NOW())
      ) usage ON true
      ORDER BY ps.created_at DESC
      OFFSET ${offset} LIMIT ${limit}
    `);

    return rows;
  }

  async updateSiteStatus(siteId: string, status: string) {
    await this.initialize();

    const updates: { status: string; revokedAt?: string } = { status };
    if (status === 'revoked') {
      updates.revokedAt = new Date().toISOString();
    }

    const rows = await db
      .update(proxySites)
      .set(updates)
      .where(eq(proxySites.id, siteId))
      .returning(proxySiteColumns);

    return rows[0] || null;
  }

  async forwardToOpenAI(body: OpenAI.Responses.ResponseCreateParams) {
    if (!this.openai) throw new Error('OpenAI API key not configured on proxy server');

    try {
      return this.openai.responses.create(body);
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        const wrapped = new Error(error.error?.message || error.message) as Error & {
          status?: number;
          openaiError?: { error: unknown };
        };
        wrapped.status = error.status || 502;
        if (error.error) {
          wrapped.openaiError = { error: error.error };
        }
        throw wrapped;
      }
      throw error;
    }
  }
}
