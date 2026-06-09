import { Router } from 'express';
import { config } from '../config';

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : null;
}

const ITEM_NAME = 'Flexify – 100% Elementor WordPress Theme';
const ITEM_ID = '20492';
const LICENSE_LABEL = 'Mini-site';

const STATUS_MESSAGE = {
  not_paid: 'Not paid',
  expired: 'Expired',
  disabled: 'Disabled',
};

function maskKey(code) {
  return typeof code === 'string' && code.length > 14 ? `${code.slice(0, 14)}…` : String(code);
}

export default function createLicenseRouter(licenseService) {
  const router = Router();

  function apiKeyAuth(req, res, next) {
    if (!config.license.apiKey) {
      return res.status(500).json({ error: 'License check endpoint not configured' });
    }
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (token !== config.license.apiKey) {
      console.log(`[license] check 403 status=bad_api_key ip=${req.ip}`);
      return res.status(403).json({ error: 'Invalid API key' });
    }
    next();
  }

  function adminAuth(req, res, next) {
    if (!config.license.adminSecret) {
      return res.status(500).json({
        error: { message: 'Admin endpoint not configured', type: 'server_misconfigured' },
      });
    }
    const secret = req.headers['x-license-admin-secret'];
    if (secret !== config.license.adminSecret) {
      return res.status(401).json({
        error: { message: 'Invalid or missing admin secret', type: 'authentication_error' },
      });
    }
    next();
  }

  router.get('/check', apiKeyAuth, async (req, res) => {
    try {
      const code = req.query.code;
      if (!code || typeof code !== 'string') {
        console.log(`[license] check 404 status=missing_code ip=${req.ip}`);
        return res.status(404).end();
      }
      const result = await licenseService.checkLicense(code);
      if (!result.found) {
        console.log(`[license] check 404 status=not_found code=${maskKey(code)} ip=${req.ip}`);
        return res.status(404).end();
      }
      if (result.status !== 'active') {
        console.log(`[license] check 401 status=${result.status} code=${maskKey(code)} ip=${req.ip}`);
        return res.status(401).json({ error: STATUS_MESSAGE[result.status] || 'Not valid' });
      }
      console.log(`[license] check 200 status=active code=${maskKey(code)} ip=${req.ip}`);
      res.json({
        item_name: ITEM_NAME,
        item_id: ITEM_ID,
        created_at: dateOnly(result.createdAt),
        user_name: result.userName || null,
        license: LICENSE_LABEL,
        supported_until: dateOnly(result.supportedUntil),
      });
    } catch (error) {
      console.error('License check error:', error);
      res.status(500).json({ error: 'Failed to check license' });
    }
  });

  router.post('/admin/set-status', adminAuth, async (req, res) => {
    try {
      const key = req.body && req.body.key;
      const status = req.body && req.body.status;
      if (!key || !status) {
        return res.status(400).json({
          error: { message: 'key and status are required', type: 'invalid_request' },
        });
      }
      const result = await licenseService.setStatus(key, status);
      if (!result.ok && result.reason === 'invalid_status') {
        return res.status(400).json({ error: { message: 'Invalid status', type: 'invalid_request' } });
      }
      if (!result.ok) {
        return res.status(404).json({ error: { message: 'License not found', type: 'not_found' } });
      }
      res.json({ success: true, status: result.status });
    } catch (error) {
      console.error('License set-status error:', error);
      res.status(500).json({ error: { message: 'Failed to set status', type: 'server_error' } });
    }
  });

  return router;
}
