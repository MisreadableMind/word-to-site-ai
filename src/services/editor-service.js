/**
 * Editor Service
 * Handles Light Editor vs Advanced Editor selection, capability testing,
 * and chat-based site editing via AI + WordPress REST API
 */

import { config } from '../config.js';
import { EDITOR_MODES } from '../constants.js';
import pool from '../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import WordPressService from './wordpress-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EditorService {
  constructor(options = {}) {
    this.waasPluginPath = options.waasPluginPath || '/wp-json/waas-controller/v1';
    this.timeout = options.timeout || 10000;
    this.aiService = options.aiService || null;
    this.siteService = options.siteService || null;
    this.dbInitialized = false;
  }

  async initializeDb() {
    if (this.dbInitialized) return;
    try {
      const migrationPath = path.join(__dirname, '../db/migrations/005-editor-sessions.sql');
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      await pool.query(sql);
      this.dbInitialized = true;
      console.log('Editor sessions database initialized');
    } catch (error) {
      console.error('Failed to initialize editor sessions database:', error.message);
    }
  }

  // ==========================================
  // Chat Session Management
  // ==========================================

  async createSession(userId, siteId) {
    await this.initializeDb();

    const site = await this.siteService.getSiteById(siteId, userId);
    if (!site) throw Object.assign(new Error('Site not found'), { code: 'SITE_NOT_FOUND' });

    const result = await pool.query(
      `INSERT INTO editor_sessions (user_id, site_id, title)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, siteId, `Editing ${site.site_name || 'site'}`]
    );

    const session = result.rows[0];

    // Build system prompt with site context
    let systemContent = this.buildSystemPrompt(site, []);

    // Try to load pages from WP for richer context
    if (site.wp_url && site.wp_username && site.wp_password) {
      try {
        const wp = new WordPressService(site.wp_url, {
          username: site.wp_username,
          password: site.wp_password,
        });
        const pages = await wp.getPages();
        systemContent = this.buildSystemPrompt(site, pages);
      } catch (error) {
        console.warn('Could not load WP pages for editor context:', error.message);
      }
    }

    // Save system message
    await pool.query(
      `INSERT INTO editor_messages (session_id, role, content)
       VALUES ($1, 'system', $2)`,
      [session.id, systemContent]
    );

    return session;
  }

  async getSession(sessionId, userId) {
    await this.initializeDb();

    const sessionResult = await pool.query(
      'SELECT * FROM editor_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    const session = sessionResult.rows[0];
    if (!session) return null;

    const messagesResult = await pool.query(
      `SELECT id, role, content, metadata, created_at
       FROM editor_messages
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [sessionId]
    );

    return { ...session, messages: messagesResult.rows };
  }

  async listSessions(userId, siteId) {
    await this.initializeDb();

    const result = await pool.query(
      `SELECT id, site_id, title, created_at, updated_at
       FROM editor_sessions
       WHERE user_id = $1 AND site_id = $2
       ORDER BY updated_at DESC`,
      [userId, siteId]
    );
    return result.rows;
  }

  async sendMessage(sessionId, userId, userMessage) {
    await this.initializeDb();

    // Load session
    const sessionResult = await pool.query(
      'SELECT * FROM editor_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    const session = sessionResult.rows[0];
    if (!session) throw Object.assign(new Error('Session not found'), { code: 'SESSION_NOT_FOUND' });

    // Load site with WP credentials
    const site = await this.siteService.getSiteById(session.site_id, userId);
    if (!site) throw Object.assign(new Error('Site not found'), { code: 'SITE_NOT_FOUND' });

    // Load all prior messages
    const messagesResult = await pool.query(
      `SELECT role, content FROM editor_messages
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [sessionId]
    );

    // Build messages array for AI
    const messages = messagesResult.rows.map(m => ({
      role: m.role,
      content: m.content,
    }));
    messages.push({ role: 'user', content: userMessage });

    // Save user message
    await pool.query(
      `INSERT INTO editor_messages (session_id, role, content)
       VALUES ($1, 'user', $2)`,
      [sessionId, userMessage]
    );

    // Call AI
    const aiResponse = await this.aiService.chat(messages, {
      model: 'gpt-4o',
      maxTokens: 4096,
      temperature: 0.7,
    });

    const fullResponse = aiResponse.content;

    // Parse and execute action blocks
    const { displayText, actions } = this.parseActions(fullResponse);
    const appliedChanges = [];

    if (actions.length > 0 && site.wp_url && site.wp_username && site.wp_password) {
      const wp = new WordPressService(site.wp_url, {
        username: site.wp_username,
        password: site.wp_password,
      });

      for (const action of actions) {
        try {
          const result = await this.executeAction(wp, action);
          appliedChanges.push({ ...action, success: true, result });
        } catch (error) {
          console.error(`Editor action failed (${action.type}):`, error.message);
          appliedChanges.push({ ...action, success: false, error: error.message });
        }
      }
    }

    // Save assistant message with metadata about applied changes
    const metadata = appliedChanges.length > 0 ? { changes: appliedChanges } : null;
    await pool.query(
      `INSERT INTO editor_messages (session_id, role, content, metadata)
       VALUES ($1, 'assistant', $2, $3)`,
      [sessionId, displayText, metadata ? JSON.stringify(metadata) : null]
    );

    // Update session timestamp
    await pool.query(
      'UPDATE editor_sessions SET updated_at = NOW() WHERE id = $1',
      [sessionId]
    );

    return {
      message: displayText,
      changes: appliedChanges,
    };
  }

  async deleteSession(sessionId, userId) {
    await this.initializeDb();

    const result = await pool.query(
      'DELETE FROM editor_sessions WHERE id = $1 AND user_id = $2 RETURNING id',
      [sessionId, userId]
    );
    return result.rows[0] || null;
  }

  // ==========================================
  // System Prompt & Action Parsing
  // ==========================================

  buildSystemPrompt(site, pages = []) {
    const pageList = pages.map(p => {
      const title = typeof p.title === 'object' ? p.title.rendered : p.title;
      const contentRaw = typeof p.content === 'object' ? p.content.rendered : p.content;
      const summary = (contentRaw || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
      return `- [ID: ${p.id}] "${title}" — ${summary || '(empty)'}`;
    }).join('\n');

    return `You are a website editor assistant for "${site.site_name || 'this site'}" at ${site.wp_url || 'unknown URL'}.

Your job is to help the user edit their website through natural conversation. You can update page content, change site settings, and create new pages.

## Current Pages:
${pageList || '(no pages loaded)'}

## How to make changes:
When the user asks for changes, respond with a friendly explanation of what you'll do AND include structured action blocks that the system will execute. Use this exact format:

:::action
{"type": "update_page", "pageId": 42, "updates": {"title": "New Title", "content": "<p>New content here</p>"}}
:::

Supported actions:
- update_page: Update a page's title and/or content. Fields: pageId (number), updates: {title?, content?}
- update_settings: Update site title/tagline. Fields: settings: {title?, tagline?}
- create_page: Create a new page. Fields: page: {title, content, slug?, status?}

Important rules:
- Always explain what you're doing in plain language before the action blocks
- Use proper HTML in content fields
- You can include multiple action blocks in one response
- If you're unsure what the user wants, ask clarifying questions instead of guessing
- For content changes, preserve existing page structure when the user only asks to change part of it
- Keep responses concise and helpful`;
  }

  parseActions(responseText) {
    const actionRegex = /:::action\s*\n([\s\S]*?)\n:::/g;
    const actions = [];
    let displayText = responseText;

    let match;
    while ((match = actionRegex.exec(responseText)) !== null) {
      try {
        const action = JSON.parse(match[1].trim());
        actions.push(action);
      } catch (error) {
        console.warn('Failed to parse action block:', error.message);
      }
      displayText = displayText.replace(match[0], '');
    }

    return {
      displayText: displayText.replace(/\n{3,}/g, '\n\n').trim(),
      actions,
    };
  }

  async executeAction(wp, action) {
    switch (action.type) {
      case 'update_page':
        return wp.updatePage(action.pageId, action.updates);

      case 'update_settings':
        return wp.updateSiteSettings(action.settings);

      case 'create_page':
        return wp.createPage(action.page);

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  // ==========================================
  // Capability Testing (existing code)
  // ==========================================

  async testLightEditorCapability(siteId, siteUrl) {
    const waasPluginUrl = this.buildWaasUrl(siteUrl);

    try {
      const health = await this.checkPluginHealth(waasPluginUrl);

      if (!health.success) {
        return {
          viable: false,
          capabilities: [],
          fallbackReason: health.error || 'WAAS Controller plugin not responding',
        };
      }

      const siteMap = await this.getSiteMap(waasPluginUrl);

      if (!siteMap.success) {
        return {
          viable: false,
          capabilities: [],
          fallbackReason: siteMap.error || 'Could not retrieve site map',
        };
      }

      const capabilities = this.extractCapabilities(siteMap.data);
      const requiredCapabilities = ['read_content', 'edit_content', 'get_structure'];
      const hasRequired = requiredCapabilities.every(cap => capabilities.includes(cap));

      return {
        viable: hasRequired,
        capabilities,
        pluginVersion: health.version,
        fallbackReason: hasRequired ? null : 'Missing required capabilities for Light Editor',
      };
    } catch (error) {
      console.error('Light Editor capability test failed:', error.message);
      return {
        viable: false,
        capabilities: [],
        fallbackReason: error.message,
      };
    }
  }

  async checkPluginHealth(baseUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { success: false, error: `Plugin health check failed: ${response.status}` };
      }

      const data = await response.json();
      return { success: true, version: data.version || 'unknown', status: data.status || 'active' };
    } catch (error) {
      if (error.name === 'AbortError') {
        return { success: false, error: 'Plugin health check timed out' };
      }
      return { success: false, error: error.message };
    }
  }

  async getSiteMap(baseUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${baseUrl}/site-map`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { success: false, error: `Site map request failed: ${response.status}` };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      if (error.name === 'AbortError') {
        return { success: false, error: 'Site map request timed out' };
      }
      return { success: false, error: error.message };
    }
  }

  extractCapabilities(siteMap) {
    const capabilities = [];

    if (siteMap.endpoints) {
      if (siteMap.endpoints.pages || siteMap.endpoints.posts) {
        capabilities.push('read_content');
      }
      if (siteMap.endpoints.updatePage || siteMap.endpoints.updatePost) {
        capabilities.push('edit_content');
      }
      if (siteMap.endpoints.menu || siteMap.endpoints.navigation) {
        capabilities.push('get_structure');
      }
      if (siteMap.endpoints.media || siteMap.endpoints.uploadMedia) {
        capabilities.push('handle_media');
      }
      if (siteMap.endpoints.settings) {
        capabilities.push('manage_settings');
      }
      if (siteMap.endpoints.customizer || siteMap.endpoints.theme) {
        capabilities.push('customize_theme');
      }
    }

    if (siteMap.features && Array.isArray(siteMap.features)) {
      capabilities.push(...siteMap.features);
    }

    return [...new Set(capabilities)];
  }

  async selectEditor(siteId, siteUrl, userPreference, testResult = null) {
    if (userPreference === EDITOR_MODES.ADVANCED) {
      return {
        mode: EDITOR_MODES.ADVANCED,
        url: this.getWpAdminUrl(siteUrl),
        bounced: false,
        reason: 'User preference',
      };
    }

    const capabilities = testResult || await this.testLightEditorCapability(siteId, siteUrl);

    if (capabilities.viable) {
      return {
        mode: EDITOR_MODES.LIGHT,
        url: this.getLightEditorUrl(siteUrl),
        bounced: false,
        capabilities: capabilities.capabilities,
      };
    }

    return {
      mode: EDITOR_MODES.ADVANCED,
      url: this.getWpAdminUrl(siteUrl),
      bounced: true,
      reason: capabilities.fallbackReason || 'Light Editor not available for this site',
      notification: {
        type: 'info',
        title: 'Using Advanced Editor',
        message: `Light Editor is not available: ${capabilities.fallbackReason}. Opening WordPress Admin instead.`,
      },
    };
  }

  buildWaasUrl(siteUrl) {
    const baseUrl = siteUrl.replace(/\/$/, '');
    return `${baseUrl}${this.waasPluginPath}`;
  }

  getWpAdminUrl(siteUrl) {
    const baseUrl = siteUrl.replace(/\/$/, '');
    return `${baseUrl}/wp-admin`;
  }

  getLightEditorUrl(siteUrl) {
    const baseUrl = siteUrl.replace(/\/$/, '');
    return `${baseUrl}/waas-editor`;
  }

  getEditorOptions(capabilities) {
    return [
      {
        id: EDITOR_MODES.LIGHT,
        label: 'Light Editor',
        description: 'Chat-based editing with voice support',
        available: capabilities?.viable || false,
        recommended: capabilities?.viable || false,
        unavailableReason: capabilities?.fallbackReason || null,
      },
      {
        id: EDITOR_MODES.ADVANCED,
        label: 'Advanced Editor',
        description: 'Full WordPress Admin access',
        available: true,
        recommended: !capabilities?.viable,
        unavailableReason: null,
      },
    ];
  }
}

export default EditorService;
