/**
 * Plugin Auth Middleware
 * Validates X-ATO-Api-Key header for plugin API endpoints
 */

export default function createPluginAuth(pluginService) {
  return async (req, res, next) => {
    const apiKey = req.headers['x-ato-api-key'];

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Missing API key. Include X-ATO-Api-Key header.',
      });
    }

    try {
      const keyData = await pluginService.validateApiKey(apiKey);

      if (!keyData) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or revoked API key.',
        });
      }

      // Attach client info to request
      req.pluginClient = {
        apiKeyId: keyData.id,
        clientId: keyData.client_id,
        clientName: keyData.client_name,
        metadata: keyData.metadata,
        siteUrl: req.headers['x-ato-site-url'] || '',
        pluginVersion: req.headers['x-ato-plugin-version'] || '',
      };

      next();
    } catch (error) {
      console.error('Plugin auth error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authentication error.',
      });
    }
  };
}
