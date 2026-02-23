/**
 * Proxy Auth Middleware
 * Validates Authorization: Bearer wts_... header for AI proxy endpoints
 */

export default function createProxyAuth(proxyService) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer wts_')) {
      return res.status(401).json({
        error: {
          message: 'Missing or invalid API key. Include Authorization: Bearer wts_... header.',
          type: 'authentication_error',
        },
      });
    }

    const apiKey = authHeader.slice(7); // Remove 'Bearer '

    try {
      const site = await proxyService.validateKey(apiKey);

      if (!site) {
        return res.status(401).json({
          error: {
            message: 'Invalid or revoked API key.',
            type: 'authentication_error',
          },
        });
      }

      const quota = await proxyService.checkQuota(site.id, site.monthly_token_limit);

      if (!quota.allowed) {
        return res.status(429).json({
          error: {
            message: `Monthly token quota exceeded. Used ${quota.used} of ${quota.limit} tokens.`,
            type: 'quota_exceeded',
            usage: quota,
          },
        });
      }

      req.proxySite = site;
      req.proxyQuota = quota;

      next();
    } catch (error) {
      console.error('Proxy auth error:', error);
      return res.status(500).json({
        error: {
          message: 'Authentication error.',
          type: 'server_error',
        },
      });
    }
  };
}
