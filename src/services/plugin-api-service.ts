import crypto from 'crypto';
import { db, apiKeys, siteRegistrations, pluginTrafficData, pluginConfigs, agentActions } from '../db/client';
import { eq, and, sql } from 'drizzle-orm';

interface ApiKeyMetadata {
  sandbox?: boolean;
  clientName?: string;
  [key: string]: unknown;
}

interface SiteData {
  site_url: string;
  plugin_version: string;
  wp_version: string;
  php_version: string;
  active_theme: string;
}

interface TrafficItem {
  visit_time?: string;
  visitor_type?: string;
  bot_name?: string;
  bot_company?: string;
  page_url?: string;
  confidence?: number;
}

interface AgentActionInput {
  action_type: string;
  payload: unknown;
}

interface ActionResultInput {
  status: string;
  [key: string]: unknown;
}

const apiKeyColumns = {
  id: apiKeys.id,
  api_key: apiKeys.apiKey,
  client_id: apiKeys.clientId,
  client_name: apiKeys.clientName,
  metadata: apiKeys.metadata,
  revoked: apiKeys.revoked,
  created_at: apiKeys.createdAt,
  revoked_at: apiKeys.revokedAt,
};

const siteRegistrationColumns = {
  id: siteRegistrations.id,
  api_key_id: siteRegistrations.apiKeyId,
  site_url: siteRegistrations.siteUrl,
  plugin_version: siteRegistrations.pluginVersion,
  wp_version: siteRegistrations.wpVersion,
  php_version: siteRegistrations.phpVersion,
  active_theme: siteRegistrations.activeTheme,
  registered_at: siteRegistrations.registeredAt,
  last_heartbeat: siteRegistrations.lastHeartbeat,
  status: siteRegistrations.status,
  site_health: siteRegistrations.siteHealth,
};

const pluginConfigColumns = {
  id: pluginConfigs.id,
  config_key: pluginConfigs.configKey,
  config_value: pluginConfigs.configValue,
  version: pluginConfigs.version,
  updated_at: pluginConfigs.updatedAt,
};

const agentActionColumns = {
  id: agentActions.id,
  registration_id: agentActions.registrationId,
  action_type: agentActions.actionType,
  payload: agentActions.payload,
  status: agentActions.status,
  result: agentActions.result,
  created_at: agentActions.createdAt,
  delivered_at: agentActions.deliveredAt,
  completed_at: agentActions.completedAt,
};

export default class PluginAPIService {
  initialized: boolean;

  constructor() {
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
  }

  async generateApiKey(clientId: string, metadata: ApiKeyMetadata = {}) {
    await this.initialize();

    const prefix = metadata.sandbox ? 'ato_test_' : 'ato_live_';
    const key = prefix + crypto.randomBytes(16).toString('hex');

    const rows = await db
      .insert(apiKeys)
      .values({
        apiKey: key,
        clientId,
        clientName: metadata.clientName || clientId,
        metadata,
      })
      .returning(apiKeyColumns);

    return rows[0];
  }

  async validateApiKey(apiKey: string) {
    await this.initialize();

    const rows = await db
      .select(apiKeyColumns)
      .from(apiKeys)
      .where(and(eq(apiKeys.apiKey, apiKey), eq(apiKeys.revoked, false)));

    return rows[0] || null;
  }

  async revokeApiKey(apiKey: string) {
    await this.initialize();

    const rows = await db
      .update(apiKeys)
      .set({ revoked: true, revokedAt: sql`now()` })
      .where(eq(apiKeys.apiKey, apiKey))
      .returning(apiKeyColumns);

    return rows[0] || null;
  }

  async registerSite(apiKeyId: string, siteData: SiteData) {
    await this.initialize();

    const { site_url, plugin_version, wp_version, php_version, active_theme } = siteData;

    const rows = await db
      .insert(siteRegistrations)
      .values({
        apiKeyId,
        siteUrl: site_url,
        pluginVersion: plugin_version,
        wpVersion: wp_version,
        phpVersion: php_version,
        activeTheme: active_theme,
        lastHeartbeat: sql`now()`,
      })
      .onConflictDoUpdate({
        target: [siteRegistrations.apiKeyId, siteRegistrations.siteUrl],
        set: {
          pluginVersion: plugin_version,
          wpVersion: wp_version,
          phpVersion: php_version,
          activeTheme: active_theme,
          lastHeartbeat: sql`now()`,
          status: 'active',
        },
      })
      .returning(siteRegistrationColumns);

    return rows[0];
  }

  async deregisterSite(apiKeyId: string, siteUrl: string) {
    await this.initialize();

    const rows = await db
      .update(siteRegistrations)
      .set({ status: 'deregistered' })
      .where(and(eq(siteRegistrations.apiKeyId, apiKeyId), eq(siteRegistrations.siteUrl, siteUrl)))
      .returning(siteRegistrationColumns);

    return rows[0] || null;
  }

  async getRegistration(apiKeyId: string, siteUrl: string) {
    await this.initialize();

    const rows = await db
      .select(siteRegistrationColumns)
      .from(siteRegistrations)
      .where(and(eq(siteRegistrations.apiKeyId, apiKeyId), eq(siteRegistrations.siteUrl, siteUrl)));

    return rows[0] || null;
  }

  async updateHeartbeat(registrationId: string, healthData: Record<string, unknown> = {}) {
    await this.initialize();

    const rows = await db
      .update(siteRegistrations)
      .set({ lastHeartbeat: sql`now()`, siteHealth: healthData })
      .where(eq(siteRegistrations.id, registrationId))
      .returning(siteRegistrationColumns);

    return rows[0] || null;
  }

  async getConfigForSite(checksums: Record<string, string> = {}) {
    await this.initialize();

    const rows = await db.select(pluginConfigColumns).from(pluginConfigs);

    const configs: Record<string, { value: unknown; version: string | null; checksum: string; ttl: number }> = {};
    for (const row of rows) {
      const currentChecksum = crypto
        .createHash('sha256')
        .update(JSON.stringify(row.config_value))
        .digest('hex');

      if (!checksums[row.config_key] || checksums[row.config_key] !== currentChecksum) {
        configs[row.config_key] = {
          value: row.config_value,
          version: row.version,
          checksum: currentChecksum,
          ttl: 86400,
        };
      }
    }

    return configs;
  }

  async updateConfig(configKey: string, configValue: unknown, version = '1.0.0') {
    await this.initialize();

    const rows = await db
      .insert(pluginConfigs)
      .values({
        configKey,
        configValue,
        version,
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: pluginConfigs.configKey,
        set: { configValue, version, updatedAt: sql`now()` },
      })
      .returning(pluginConfigColumns);

    return rows[0];
  }

  async getBotSignatures(clientVersion = '0') {
    await this.initialize();

    const rows = await db
      .select(pluginConfigColumns)
      .from(pluginConfigs)
      .where(eq(pluginConfigs.configKey, 'bot_signatures'));

    if (!rows[0]) {
      return { signatures: {}, version: '0' };
    }

    const config = rows[0];
    if (config.version === clientVersion) {
      return { signatures: null, version: config.version, unchanged: true };
    }

    return {
      signatures: config.config_value,
      version: config.version,
    };
  }

  async ingestTrafficData(registrationId: string, batch: TrafficItem[]) {
    await this.initialize();

    if (!Array.isArray(batch) || batch.length === 0) {
      return { ingested: 0 };
    }

    const maxBatch = 500;
    const items = batch.slice(0, maxBatch);

    const rows = items.map((item) => ({
      registrationId,
      visitTime: item.visit_time || new Date().toISOString(),
      visitorType: item.visitor_type || 'unknown',
      botName: item.bot_name || null,
      botCompany: item.bot_company || null,
      pageUrl: item.page_url || null,
      confidence: item.confidence || 0,
    }));

    await db.insert(pluginTrafficData).values(rows);

    return { ingested: items.length };
  }

  async ingestSiteHealth(registrationId: string, data: Record<string, unknown>) {
    await this.initialize();

    await db
      .update(siteRegistrations)
      .set({ siteHealth: data, lastHeartbeat: sql`now()` })
      .where(eq(siteRegistrations.id, registrationId));

    return { success: true };
  }

  async queueAgentAction(registrationId: string, action: AgentActionInput) {
    await this.initialize();

    const rows = await db
      .insert(agentActions)
      .values({
        registrationId,
        actionType: action.action_type,
        payload: action.payload,
      })
      .returning(agentActionColumns);

    return rows[0];
  }

  async getAgentActions(registrationId: string) {
    await this.initialize();

    const rows = await db
      .update(agentActions)
      .set({ status: 'delivered', deliveredAt: sql`now()` })
      .where(and(eq(agentActions.registrationId, registrationId), eq(agentActions.status, 'pending')))
      .returning(agentActionColumns);

    return rows;
  }

  async reportActionResult(actionId: string, result: ActionResultInput) {
    await this.initialize();

    const status = result.status === 'success' ? 'completed' : 'failed';

    const rows = await db
      .update(agentActions)
      .set({ status, result, completedAt: sql`now()` })
      .where(eq(agentActions.id, actionId))
      .returning(agentActionColumns);

    return rows[0] || null;
  }
}
