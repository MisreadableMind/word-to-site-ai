import { Router } from 'express';
import createPluginAuth from '../middleware/plugin-auth.js';

/**
 * Create plugin API router
 * Mounted at /api/plugin
 */
export default function createPluginRouter(pluginService) {
  const router = Router();
  const auth = createPluginAuth(pluginService);

  // ==========================================
  // PUBLIC ENDPOINTS (no auth)
  // ==========================================

  // Lightweight connectivity test
  router.get('/ping', (req, res) => {
    res.json({ success: true, service: 'wordtosite-plugin-api', timestamp: new Date().toISOString() });
  });

  // ==========================================
  // AUTHENTICATED ENDPOINTS
  // ==========================================

  // Site registration
  router.post('/register', auth, async (req, res) => {
    try {
      const registration = await pluginService.registerSite(
        req.pluginClient.apiKeyId,
        req.body
      );

      res.json({ success: true, registration });
    } catch (error) {
      console.error('Plugin register error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Site deregistration
  router.post('/deregister', auth, async (req, res) => {
    try {
      const result = await pluginService.deregisterSite(
        req.pluginClient.apiKeyId,
        req.body.site_url || req.pluginClient.siteUrl
      );

      res.json({ success: true, deregistered: !!result });
    } catch (error) {
      console.error('Plugin deregister error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Heartbeat
  router.post('/heartbeat', auth, async (req, res) => {
    try {
      const siteUrl = req.body.site_url || req.pluginClient.siteUrl;
      let registration = await pluginService.getRegistration(
        req.pluginClient.apiKeyId,
        siteUrl
      );

      // Auto-register if not found
      if (!registration) {
        registration = await pluginService.registerSite(
          req.pluginClient.apiKeyId,
          req.body
        );
      }

      await pluginService.updateHeartbeat(registration.id, req.body);

      res.json({ success: true, status: 'ok' });
    } catch (error) {
      console.error('Plugin heartbeat error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Pull config updates
  router.get('/config', auth, async (req, res) => {
    try {
      let checksums = {};
      if (req.query.checksums) {
        try {
          checksums = JSON.parse(req.query.checksums);
        } catch (e) { /* ignore parse errors */ }
      }

      const configs = await pluginService.getConfigForSite(checksums);

      res.json({ success: true, configs });
    } catch (error) {
      console.error('Plugin config error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Pull bot signature updates
  router.get('/bot-signatures', auth, async (req, res) => {
    try {
      const version = req.query.version || '0';
      const result = await pluginService.getBotSignatures(version);

      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Plugin bot-signatures error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Push traffic data batch
  router.post('/sync/traffic', auth, async (req, res) => {
    try {
      const siteUrl = req.body.site_url || req.pluginClient.siteUrl;
      const registration = await pluginService.getRegistration(
        req.pluginClient.apiKeyId,
        siteUrl
      );

      if (!registration) {
        return res.status(404).json({ success: false, error: 'Site not registered' });
      }

      const result = await pluginService.ingestTrafficData(
        registration.id,
        req.body.batch || []
      );

      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Plugin sync traffic error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Push content performance data
  router.post('/sync/content-perf', auth, async (req, res) => {
    try {
      // Content performance is stored as part of site health for now
      const siteUrl = req.body.site_url || req.pluginClient.siteUrl;
      const registration = await pluginService.getRegistration(
        req.pluginClient.apiKeyId,
        siteUrl
      );

      if (!registration) {
        return res.status(404).json({ success: false, error: 'Site not registered' });
      }

      res.json({ success: true, received: true });
    } catch (error) {
      console.error('Plugin sync content-perf error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Push site health data
  router.post('/sync/site-health', auth, async (req, res) => {
    try {
      const siteUrl = req.body.site_url || req.pluginClient.siteUrl;
      const registration = await pluginService.getRegistration(
        req.pluginClient.apiKeyId,
        siteUrl
      );

      if (!registration) {
        return res.status(404).json({ success: false, error: 'Site not registered' });
      }

      await pluginService.ingestSiteHealth(registration.id, req.body.data || {});

      res.json({ success: true });
    } catch (error) {
      console.error('Plugin sync site-health error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get pending agent actions
  router.get('/agent/actions', auth, async (req, res) => {
    try {
      const siteUrl = req.query.site_url || req.pluginClient.siteUrl;
      const registration = await pluginService.getRegistration(
        req.pluginClient.apiKeyId,
        siteUrl
      );

      if (!registration) {
        return res.json({ success: true, actions: [] });
      }

      const actions = await pluginService.getAgentActions(registration.id);

      res.json({ success: true, actions });
    } catch (error) {
      console.error('Plugin agent actions error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Report agent action result
  router.post('/agent/actions/:id/result', auth, async (req, res) => {
    try {
      const result = await pluginService.reportActionResult(
        req.params.id,
        req.body
      );

      res.json({ success: true, action: result });
    } catch (error) {
      console.error('Plugin agent action result error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
