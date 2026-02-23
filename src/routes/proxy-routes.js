import { Router } from 'express';
import crypto from 'crypto';
import { config } from '../config.js';
import createProxyAuth from '../middleware/proxy-auth.js';

/**
 * Create AI proxy router
 * Mounted at /api/proxy
 */
export default function createProxyRouter(proxyService) {
  const router = Router();
  const auth = createProxyAuth(proxyService);

  // ==========================================
  // ADMIN AUTH HELPER
  // ==========================================

  function adminAuth(req, res, next) {
    const secret = req.headers['x-proxy-admin-secret'];
    if (!config.proxy?.adminSecret || secret !== config.proxy.adminSecret) {
      return res.status(401).json({
        error: { message: 'Invalid or missing admin secret.', type: 'authentication_error' },
      });
    }
    next();
  }

  // ==========================================
  // PUBLIC
  // ==========================================

  router.get('/ping', (req, res) => {
    res.json({ success: true, service: 'wordtosite-ai-proxy', timestamp: new Date().toISOString() });
  });

  // ==========================================
  // ADMIN ENDPOINTS
  // ==========================================

  // Register a new site
  router.post('/admin/register-site', adminAuth, async (req, res) => {
    try {
      const { domain, label } = req.body;

      if (!domain) {
        return res.status(400).json({ error: { message: 'domain is required', type: 'validation_error' } });
      }

      const site = await proxyService.registerSite(domain, label);

      res.json({
        success: true,
        site: {
          id: site.id,
          domain: site.domain,
          api_key: site.api_key,
          label: site.label,
          subscription_tier: site.subscription_tier,
          monthly_token_limit: site.monthly_token_limit,
          created_at: site.created_at,
        },
      });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: { message: 'Domain already registered', type: 'conflict' } });
      }
      console.error('Proxy register-site error:', error);
      res.status(500).json({ error: { message: error.message, type: 'server_error' } });
    }
  });

  // Push API key to a WP site's plugin endpoint
  router.post('/admin/push-key', adminAuth, async (req, res) => {
    try {
      const { domain } = req.body;

      if (!domain) {
        return res.status(400).json({ error: { message: 'domain is required', type: 'validation_error' } });
      }

      const site = await proxyService.getSiteByDomain(domain);
      if (!site) {
        return res.status(404).json({ error: { message: 'Site not found', type: 'not_found' } });
      }

      // Attempt to push config to the WP plugin
      const wpUrl = `https://${domain}/wp-json/wordtosite/v1/set-proxy-config`;
      const pushResponse = await fetch(wpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proxyUrl: `${req.protocol}://${req.get('host')}/api/proxy`,
          apiKey: site.api_key,
        }),
      });

      if (!pushResponse.ok) {
        const err = await pushResponse.text();
        return res.status(502).json({
          error: { message: `Failed to push key to ${domain}: ${err}`, type: 'push_failed' },
          api_key: site.api_key, // Still return key so admin can configure manually
        });
      }

      res.json({ success: true, domain, pushed: true });
    } catch (error) {
      console.error('Proxy push-key error:', error);
      res.status(500).json({ error: { message: error.message, type: 'server_error' } });
    }
  });

  // List all registered sites with usage summaries
  router.get('/admin/sites', adminAuth, async (req, res) => {
    try {
      const offset = parseInt(req.query.offset) || 0;
      const limit = Math.min(parseInt(req.query.limit) || 50, 100);

      const sites = await proxyService.listSites(offset, limit);

      res.json({ success: true, sites, offset, limit });
    } catch (error) {
      console.error('Proxy list-sites error:', error);
      res.status(500).json({ error: { message: error.message, type: 'server_error' } });
    }
  });

  // Get detailed usage stats for a site
  router.get('/admin/sites/:id/usage', adminAuth, async (req, res) => {
    try {
      const site = await proxyService.getSiteById(req.params.id);
      if (!site) {
        return res.status(404).json({ error: { message: 'Site not found', type: 'not_found' } });
      }

      const used = await proxyService.getMonthlyUsage(site.id);
      const quota = await proxyService.checkQuota(site.id, site.monthly_token_limit);

      res.json({
        success: true,
        site_id: site.id,
        domain: site.domain,
        subscription_tier: site.subscription_tier,
        usage: { ...quota, used },
      });
    } catch (error) {
      console.error('Proxy site-usage error:', error);
      res.status(500).json({ error: { message: error.message, type: 'server_error' } });
    }
  });

  // Get recent request log for a site
  router.get('/admin/sites/:id/requests', adminAuth, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 50, 200);
      const requests = await proxyService.getRecentRequests(req.params.id, limit);

      res.json({ success: true, requests });
    } catch (error) {
      console.error('Proxy site-requests error:', error);
      res.status(500).json({ error: { message: error.message, type: 'server_error' } });
    }
  });

  // Update site (tier, status)
  router.patch('/admin/sites/:id', adminAuth, async (req, res) => {
    try {
      const { tier, status } = req.body;
      let site = null;

      if (tier) {
        site = await proxyService.updateTier(req.params.id, tier);
      }

      if (status) {
        site = await proxyService.updateSiteStatus(req.params.id, status);
      }

      if (!site) {
        return res.status(404).json({ error: { message: 'Site not found or no changes applied', type: 'not_found' } });
      }

      res.json({ success: true, site });
    } catch (error) {
      console.error('Proxy update-site error:', error);
      res.status(500).json({ error: { message: error.message, type: 'server_error' } });
    }
  });

  // ==========================================
  // AUTHENTICATED PROXY ENDPOINTS
  // ==========================================

  // Unified AI proxy — OpenAI-compatible chat completions
  router.post('/v1/chat/completions', auth, async (req, res) => {
    const startTime = Date.now();
    const site = req.proxySite;

    try {
      const { model, messages, max_tokens, temperature } = req.body;

      if (!model || !messages || !Array.isArray(messages)) {
        return res.status(400).json({
          error: { message: 'model and messages array are required', type: 'validation_error' },
        });
      }

      // Check model is allowed for this tier
      const allowedModels = await proxyService.getAllowedModels(site.subscription_tier);
      if (allowedModels.length > 0 && !allowedModels.includes(model)) {
        return res.status(403).json({
          error: {
            message: `Model "${model}" is not available on the "${site.subscription_tier}" tier. Allowed: ${allowedModels.join(', ')}`,
            type: 'model_not_allowed',
          },
        });
      }

      // Forward to the appropriate provider
      const result = await proxyService.forwardToProvider(model, { messages, max_tokens, temperature });

      const latencyMs = Date.now() - startTime;

      // Log asynchronously
      proxyService.logRequest(site.id, site.domain, {
        provider: result.provider,
        model: result.model,
        endpoint: '/v1/chat/completions',
        method: 'POST',
        prompt_tokens: result.usage.prompt_tokens,
        completion_tokens: result.usage.completion_tokens,
        total_tokens: result.usage.total_tokens,
        response_status: 200,
        latency_ms: latencyMs,
      });

      // Return OpenAI-compatible response format
      res.json({
        id: `chatcmpl-${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: result.model,
        choices: [{
          index: 0,
          message: { role: 'assistant', content: result.content },
          finish_reason: 'stop',
        }],
        usage: result.usage,
      });
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      proxyService.logRequest(site.id, site.domain, {
        provider: req.body?.model?.split('-')[0] || 'unknown',
        model: req.body?.model || 'unknown',
        endpoint: '/v1/chat/completions',
        method: 'POST',
        response_status: 502,
        latency_ms: latencyMs,
        error_message: error.message,
      });

      console.error('Proxy forwarding error:', error);
      res.status(502).json({
        error: { message: error.message, type: 'upstream_error' },
      });
    }
  });

  // List available models for the caller's tier
  router.get('/v1/models', auth, async (req, res) => {
    try {
      const allowedModels = await proxyService.getAllowedModels(req.proxySite.subscription_tier);

      const models = allowedModels.map(id => ({
        id,
        object: 'model',
        owned_by: id.startsWith('gpt-') ? 'openai' : id.startsWith('gemini-') ? 'google' : 'anthropic',
      }));

      res.json({ object: 'list', data: models });
    } catch (error) {
      console.error('Proxy list-models error:', error);
      res.status(500).json({ error: { message: error.message, type: 'server_error' } });
    }
  });

  // Current month usage for the calling site
  router.get('/v1/usage', auth, async (req, res) => {
    try {
      const site = req.proxySite;
      const quota = req.proxyQuota;

      res.json({
        domain: site.domain,
        subscription_tier: site.subscription_tier,
        period: new Date().toISOString().slice(0, 7), // YYYY-MM
        usage: quota,
      });
    } catch (error) {
      console.error('Proxy usage error:', error);
      res.status(500).json({ error: { message: error.message, type: 'server_error' } });
    }
  });

  return router;
}
