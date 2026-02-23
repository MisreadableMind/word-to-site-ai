import crypto from 'crypto';
import pool from '../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class PluginAPIService {

  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize database tables if they don't exist
   */
  async initialize() {
    if (this.initialized) return;

    try {
      const migrationPath = path.join(__dirname, '../db/migrations/001-plugin-api.sql');
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      await pool.query(sql);
      this.initialized = true;
      console.log('Plugin API database initialized');
    } catch (error) {
      console.error('Failed to initialize plugin API database:', error.message);
    }
  }

  // ==========================================
  // API KEY MANAGEMENT
  // ==========================================

  /**
   * Generate a new API key for a client
   */
  async generateApiKey(clientId, metadata = {}) {
    await this.initialize();

    const prefix = metadata.sandbox ? 'ato_test_' : 'ato_live_';
    const key = prefix + crypto.randomBytes(16).toString('hex');

    const result = await pool.query(
      `INSERT INTO api_keys (api_key, client_id, client_name, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [key, clientId, metadata.clientName || clientId, JSON.stringify(metadata)]
    );

    return result.rows[0];
  }

  /**
   * Validate an API key and return its data (or null if invalid)
   */
  async validateApiKey(apiKey) {
    await this.initialize();

    const result = await pool.query(
      'SELECT * FROM api_keys WHERE api_key = $1 AND revoked = false',
      [apiKey]
    );

    return result.rows[0] || null;
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(apiKey) {
    await this.initialize();

    const result = await pool.query(
      `UPDATE api_keys SET revoked = true, revoked_at = NOW()
       WHERE api_key = $1 RETURNING *`,
      [apiKey]
    );

    return result.rows[0] || null;
  }

  // ==========================================
  // SITE REGISTRATION
  // ==========================================

  /**
   * Register a new site installation
   */
  async registerSite(apiKeyId, siteData) {
    await this.initialize();

    const { site_url, plugin_version, wp_version, php_version, active_theme } = siteData;

    const result = await pool.query(
      `INSERT INTO site_registrations (api_key_id, site_url, plugin_version, wp_version, php_version, active_theme, last_heartbeat)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (api_key_id, site_url)
       DO UPDATE SET
         plugin_version = EXCLUDED.plugin_version,
         wp_version = EXCLUDED.wp_version,
         php_version = EXCLUDED.php_version,
         active_theme = EXCLUDED.active_theme,
         last_heartbeat = NOW(),
         status = 'active'
       RETURNING *`,
      [apiKeyId, site_url, plugin_version, wp_version, php_version, active_theme]
    );

    return result.rows[0];
  }

  /**
   * Deregister a site
   */
  async deregisterSite(apiKeyId, siteUrl) {
    await this.initialize();

    const result = await pool.query(
      `UPDATE site_registrations SET status = 'deregistered'
       WHERE api_key_id = $1 AND site_url = $2 RETURNING *`,
      [apiKeyId, siteUrl]
    );

    return result.rows[0] || null;
  }

  /**
   * Get registration for a site
   */
  async getRegistration(apiKeyId, siteUrl) {
    await this.initialize();

    const result = await pool.query(
      'SELECT * FROM site_registrations WHERE api_key_id = $1 AND site_url = $2',
      [apiKeyId, siteUrl]
    );

    return result.rows[0] || null;
  }

  /**
   * Update heartbeat and site health
   */
  async updateHeartbeat(registrationId, healthData = {}) {
    await this.initialize();

    const result = await pool.query(
      `UPDATE site_registrations
       SET last_heartbeat = NOW(), site_health = $2
       WHERE id = $1 RETURNING *`,
      [registrationId, JSON.stringify(healthData)]
    );

    return result.rows[0] || null;
  }

  // ==========================================
  // CONFIG MANAGEMENT
  // ==========================================

  /**
   * Get configs for a site (optionally filtered by checksums for change detection)
   */
  async getConfigForSite(checksums = {}) {
    await this.initialize();

    const result = await pool.query('SELECT * FROM plugin_configs');

    const configs = {};
    for (const row of result.rows) {
      const currentChecksum = crypto
        .createHash('sha256')
        .update(JSON.stringify(row.config_value))
        .digest('hex');

      // Only include if checksum differs (config has changed)
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

  /**
   * Update a config entry
   */
  async updateConfig(configKey, configValue, version = '1.0.0') {
    await this.initialize();

    const result = await pool.query(
      `INSERT INTO plugin_configs (config_key, config_value, version, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (config_key)
       DO UPDATE SET config_value = $2, version = $3, updated_at = NOW()
       RETURNING *`,
      [configKey, JSON.stringify(configValue), version]
    );

    return result.rows[0];
  }

  /**
   * Get bot signatures from config
   */
  async getBotSignatures(clientVersion = '0') {
    await this.initialize();

    const result = await pool.query(
      "SELECT * FROM plugin_configs WHERE config_key = 'bot_signatures'"
    );

    if (!result.rows[0]) {
      return { signatures: {}, version: '0' };
    }

    const config = result.rows[0];
    if (config.version === clientVersion) {
      return { signatures: null, version: config.version, unchanged: true };
    }

    return {
      signatures: config.config_value,
      version: config.version,
    };
  }

  // ==========================================
  // TRAFFIC DATA
  // ==========================================

  /**
   * Ingest a batch of traffic data from a plugin
   */
  async ingestTrafficData(registrationId, batch) {
    await this.initialize();

    if (!Array.isArray(batch) || batch.length === 0) {
      return { ingested: 0 };
    }

    // Limit batch size
    const maxBatch = 500;
    const items = batch.slice(0, maxBatch);

    const values = [];
    const placeholders = [];
    let paramIndex = 1;

    for (const item of items) {
      placeholders.push(
        `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
      );
      values.push(
        registrationId,
        item.visit_time || new Date().toISOString(),
        item.visitor_type || 'unknown',
        item.bot_name || null,
        item.bot_company || null,
        item.page_url || null,
        item.confidence || 0
      );
    }

    await pool.query(
      `INSERT INTO plugin_traffic_data (registration_id, visit_time, visitor_type, bot_name, bot_company, page_url, confidence)
       VALUES ${placeholders.join(', ')}`,
      values
    );

    return { ingested: items.length };
  }

  /**
   * Ingest site health data
   */
  async ingestSiteHealth(registrationId, data) {
    await this.initialize();

    await pool.query(
      `UPDATE site_registrations SET site_health = $2, last_heartbeat = NOW()
       WHERE id = $1`,
      [registrationId, JSON.stringify(data)]
    );

    return { success: true };
  }

  // ==========================================
  // AGENT ACTIONS
  // ==========================================

  /**
   * Queue an agent action for a site
   */
  async queueAgentAction(registrationId, action) {
    await this.initialize();

    const result = await pool.query(
      `INSERT INTO agent_actions (registration_id, action_type, payload)
       VALUES ($1, $2, $3) RETURNING *`,
      [registrationId, action.action_type, JSON.stringify(action.payload)]
    );

    return result.rows[0];
  }

  /**
   * Get pending agent actions for a site
   */
  async getAgentActions(registrationId) {
    await this.initialize();

    const result = await pool.query(
      `UPDATE agent_actions SET status = 'delivered', delivered_at = NOW()
       WHERE registration_id = $1 AND status = 'pending'
       RETURNING *`,
      [registrationId]
    );

    return result.rows;
  }

  /**
   * Report result of an agent action
   */
  async reportActionResult(actionId, result) {
    await this.initialize();

    const status = result.status === 'success' ? 'completed' : 'failed';

    const dbResult = await pool.query(
      `UPDATE agent_actions SET status = $2, result = $3, completed_at = NOW()
       WHERE id = $1 RETURNING *`,
      [actionId, status, JSON.stringify(result)]
    );

    return dbResult.rows[0] || null;
  }
}
