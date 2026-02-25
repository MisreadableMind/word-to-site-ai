import { Router } from 'express';
import { createUserAuth } from '../middleware/user-auth.js';

/**
 * Create site router
 * Mounted at /api/sites
 */
export default function createSiteRouter(siteService, authService) {
  const router = Router();
  const auth = createUserAuth(authService);

  // All routes require authentication
  router.use(auth);

  // List user's sites
  router.get('/', async (req, res) => {
    try {
      const sites = await siteService.listSites(req.user.id);
      res.json({ success: true, sites });
    } catch (error) {
      console.error('List sites error:', error);
      res.status(500).json({
        error: { message: 'Failed to list sites', type: 'server_error' },
      });
    }
  });

  // Get site detail
  router.get('/:id', async (req, res) => {
    try {
      const site = await siteService.getSiteById(req.params.id, req.user.id);

      if (!site) {
        return res.status(404).json({
          error: { message: 'Site not found', type: 'not_found' },
        });
      }

      res.json({ success: true, site });
    } catch (error) {
      console.error('Get site error:', error);
      res.status(500).json({
        error: { message: 'Failed to get site', type: 'server_error' },
      });
    }
  });

  // Soft delete site
  router.delete('/:id', async (req, res) => {
    try {
      const site = await siteService.deleteSite(req.params.id, req.user.id);

      if (!site) {
        return res.status(404).json({
          error: { message: 'Site not found', type: 'not_found' },
        });
      }

      res.json({ success: true, message: 'Site deleted' });
    } catch (error) {
      console.error('Delete site error:', error);
      res.status(500).json({
        error: { message: 'Failed to delete site', type: 'server_error' },
      });
    }
  });

  return router;
}
