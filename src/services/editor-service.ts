import { config } from '../config';
import { EDITOR_MODES } from '../constants';
import { db, editorSessions, editorMessages } from '../db/client';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import WordPressService from './wordpress-service';

interface EditorSite {
  site_name: string | null;
  wp_url: string | null;
  wp_username: string | null;
  wp_password: string | null;
}

interface SiteService {
  getSiteById(siteId: string, userId: string): Promise<EditorSite | null>;
}

interface AiChatMessage {
  role: string;
  content: string;
}

interface AiService {
  chat(
    messages: AiChatMessage[],
    options: { model: string; maxTokens: number; temperature: number },
  ): Promise<{ content: string }>;
}

type WordPressClient = InstanceType<typeof WordPressService>;

interface WordPressPage {
  id: number;
  title: string | { rendered: string };
  content: string | { rendered: string };
}

interface EditorAction {
  type: string;
  pageId?: number;
  updates?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  page?: Record<string, unknown>;
}

interface PluginHealth {
  success: boolean;
  error?: string;
  version?: string;
  status?: string;
}

interface SiteMapResult {
  success: boolean;
  error?: string;
  data?: SiteMapData;
}

interface SiteMapData {
  endpoints?: Record<string, unknown>;
  features?: string[];
}

interface CapabilityResult {
  viable: boolean;
  capabilities: string[];
  pluginVersion?: string;
  fallbackReason: string | null;
}

interface EditorServiceOptions {
  waasPluginPath?: string;
  timeout?: number;
  aiService?: AiService | null;
  siteService?: SiteService | null;
}

class EditorService {
  waasPluginPath: string;
  timeout: number;
  aiService: AiService | null;
  siteService: SiteService | null;
  dbInitialized: boolean;

  constructor(options: EditorServiceOptions = {}) {
    this.waasPluginPath = options.waasPluginPath || '/wp-json/waas-controller/v1';
    this.timeout = options.timeout || 10000;
    this.aiService = options.aiService || null;
    this.siteService = options.siteService || null;
    this.dbInitialized = false;
  }

  async initializeDb() {
    this.dbInitialized = true;
  }

  async createSession(userId: string, siteId: string) {
    await this.initializeDb();

    const site = await this.siteService!.getSiteById(siteId, userId);
    if (!site) throw Object.assign(new Error('Site not found'), { code: 'SITE_NOT_FOUND' });

    const inserted = await db
      .insert(editorSessions)
      .values({ userId, siteId, title: `Editing ${site.site_name || 'site'}` })
      .returning({
        id: editorSessions.id,
        user_id: editorSessions.userId,
        site_id: editorSessions.siteId,
        title: editorSessions.title,
        created_at: editorSessions.createdAt,
        updated_at: editorSessions.updatedAt,
      });

    const session = inserted[0];

    let systemContent = this.buildSystemPrompt(site, []);

    if (site.wp_url && site.wp_username && site.wp_password) {
      try {
        const wp: WordPressClient = new WordPressService(site.wp_url, {
          username: config.instawp.snapshotWpUsername,
          password: config.instawp.snapshotWpPassword,
        });
        const pages = await wp.getPages() as WordPressPage[];
        systemContent = this.buildSystemPrompt(site, pages);
      } catch (error) {
        console.warn('Could not load WP pages for editor context:', (error as Error).message);
      }
    }

    await db
      .insert(editorMessages)
      .values({ sessionId: session.id, role: 'system', content: systemContent });

    return session;
  }

  async getSession(sessionId: string, userId: string) {
    await this.initializeDb();

    const sessionRows = await db
      .select({
        id: editorSessions.id,
        user_id: editorSessions.userId,
        site_id: editorSessions.siteId,
        title: editorSessions.title,
        created_at: editorSessions.createdAt,
        updated_at: editorSessions.updatedAt,
      })
      .from(editorSessions)
      .where(and(eq(editorSessions.id, sessionId), eq(editorSessions.userId, userId)));
    const session = sessionRows[0];
    if (!session) return null;

    const messages = await db
      .select({
        id: editorMessages.id,
        role: editorMessages.role,
        content: editorMessages.content,
        metadata: editorMessages.metadata,
        created_at: editorMessages.createdAt,
      })
      .from(editorMessages)
      .where(eq(editorMessages.sessionId, sessionId))
      .orderBy(asc(editorMessages.createdAt));

    return { ...session, messages };
  }

  async listSessions(userId: string, siteId: string) {
    await this.initializeDb();

    const rows = await db
      .select({
        id: editorSessions.id,
        site_id: editorSessions.siteId,
        title: editorSessions.title,
        created_at: editorSessions.createdAt,
        updated_at: editorSessions.updatedAt,
      })
      .from(editorSessions)
      .where(and(eq(editorSessions.userId, userId), eq(editorSessions.siteId, siteId)))
      .orderBy(desc(editorSessions.updatedAt));
    return rows;
  }

  async sendMessage(sessionId: string, userId: string, userMessage: string) {
    await this.initializeDb();

    const sessionRows = await db
      .select({
        id: editorSessions.id,
        user_id: editorSessions.userId,
        site_id: editorSessions.siteId,
        title: editorSessions.title,
        created_at: editorSessions.createdAt,
        updated_at: editorSessions.updatedAt,
      })
      .from(editorSessions)
      .where(and(eq(editorSessions.id, sessionId), eq(editorSessions.userId, userId)));
    const session = sessionRows[0];
    if (!session) throw Object.assign(new Error('Session not found'), { code: 'SESSION_NOT_FOUND' });

    const site = await this.siteService!.getSiteById(session.site_id, userId);
    if (!site) throw Object.assign(new Error('Site not found'), { code: 'SITE_NOT_FOUND' });

    const priorMessages = await db
      .select({ role: editorMessages.role, content: editorMessages.content })
      .from(editorMessages)
      .where(eq(editorMessages.sessionId, sessionId))
      .orderBy(asc(editorMessages.createdAt));

    const messages: AiChatMessage[] = priorMessages.map(m => ({
      role: m.role,
      content: m.content,
    }));
    messages.push({ role: 'user', content: userMessage });

    await db
      .insert(editorMessages)
      .values({ sessionId, role: 'user', content: userMessage });

    const aiResponse = await this.aiService!.chat(messages, {
      model: 'gpt-4o',
      maxTokens: 4096,
      temperature: 0.7,
    });

    const fullResponse = aiResponse.content;

    const { displayText, actions } = this.parseActions(fullResponse);
    const appliedChanges: Array<EditorAction & { success: boolean; result?: unknown; error?: string }> = [];

    if (actions.length > 0 && site.wp_url && site.wp_username && site.wp_password) {
      const wp: WordPressClient = new WordPressService(site.wp_url, {
        username: config.instawp.snapshotWpUsername,
        password: config.instawp.snapshotWpPassword,
      });

      for (const action of actions) {
        try {
          const result = await this.executeAction(wp, action);
          appliedChanges.push({ ...action, success: true, result });
        } catch (error) {
          console.error(`Editor action failed (${action.type}):`, (error as Error).message);
          appliedChanges.push({ ...action, success: false, error: (error as Error).message });
        }
      }
    }

    const metadata = appliedChanges.length > 0 ? { changes: appliedChanges } : null;
    await db
      .insert(editorMessages)
      .values({ sessionId, role: 'assistant', content: displayText, metadata });

    await db
      .update(editorSessions)
      .set({ updatedAt: sql`NOW()` })
      .where(eq(editorSessions.id, sessionId));

    return {
      message: displayText,
      changes: appliedChanges,
    };
  }

  async deleteSession(sessionId: string, userId: string) {
    await this.initializeDb();

    const deleted = await db
      .delete(editorSessions)
      .where(and(eq(editorSessions.id, sessionId), eq(editorSessions.userId, userId)))
      .returning({ id: editorSessions.id });
    return deleted[0] || null;
  }

  buildSystemPrompt(site: EditorSite, pages: WordPressPage[] = []) {
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

  parseActions(responseText: string) {
    const actionRegex = /:::action\s*\n([\s\S]*?)\n:::/g;
    const actions: EditorAction[] = [];
    let displayText = responseText;

    let match: RegExpExecArray | null;
    while ((match = actionRegex.exec(responseText)) !== null) {
      try {
        const action = JSON.parse((match[1] || '').trim()) as EditorAction;
        actions.push(action);
      } catch (error) {
        console.warn('Failed to parse action block:', (error as Error).message);
      }
      displayText = displayText.replace(match[0], '');
    }

    return {
      displayText: displayText.replace(/\n{3,}/g, '\n\n').trim(),
      actions,
    };
  }

  async executeAction(wp: WordPressClient, action: EditorAction) {
    switch (action.type) {
      case 'update_page':
        return wp.updatePage(action.pageId as number, action.updates as Parameters<WordPressClient['updatePage']>[1]);

      case 'update_settings':
        return wp.updateSiteSettings(action.settings as Parameters<WordPressClient['updateSiteSettings']>[0]);

      case 'create_page':
        return wp.createPage(action.page as Parameters<WordPressClient['createPage']>[0]);

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  async testLightEditorCapability(siteId: string, siteUrl: string): Promise<CapabilityResult> {
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

      const capabilities = this.extractCapabilities(siteMap.data as SiteMapData);
      const requiredCapabilities = ['read_content', 'edit_content', 'get_structure'];
      const hasRequired = requiredCapabilities.every(cap => capabilities.includes(cap));

      return {
        viable: hasRequired,
        capabilities,
        pluginVersion: health.version,
        fallbackReason: hasRequired ? null : 'Missing required capabilities for Light Editor',
      };
    } catch (error) {
      console.error('Light Editor capability test failed:', (error as Error).message);
      return {
        viable: false,
        capabilities: [],
        fallbackReason: (error as Error).message,
      };
    }
  }

  async checkPluginHealth(baseUrl: string): Promise<PluginHealth> {
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

      const data = await response.json() as { version?: string; status?: string };
      return { success: true, version: data.version || 'unknown', status: data.status || 'active' };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return { success: false, error: 'Plugin health check timed out' };
      }
      return { success: false, error: (error as Error).message };
    }
  }

  async getSiteMap(baseUrl: string): Promise<SiteMapResult> {
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

      const data = await response.json() as SiteMapData;
      return { success: true, data };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return { success: false, error: 'Site map request timed out' };
      }
      return { success: false, error: (error as Error).message };
    }
  }

  extractCapabilities(siteMap: SiteMapData): string[] {
    const capabilities: string[] = [];

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

  async selectEditor(siteId: string, siteUrl: string, userPreference: string, testResult: CapabilityResult | null = null) {
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

  buildWaasUrl(siteUrl: string) {
    const baseUrl = siteUrl.replace(/\/$/, '');
    return `${baseUrl}${this.waasPluginPath}`;
  }

  getWpAdminUrl(siteUrl: string) {
    const baseUrl = siteUrl.replace(/\/$/, '');
    return `${baseUrl}/wp-admin`;
  }

  getLightEditorUrl(siteUrl: string) {
    const baseUrl = siteUrl.replace(/\/$/, '');
    return `${baseUrl}/waas-editor`;
  }

  getEditorOptions(capabilities: CapabilityResult | null) {
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
