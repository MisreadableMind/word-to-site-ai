import { Router } from 'express';
import { createUserAuth } from '../middleware/user-auth.js';

/**
 * Create editor chat router
 * Mounted at /api/editor/chat
 */
export default function createEditorRouter(editorService, authService) {
  const router = Router();
  const auth = createUserAuth(authService);

  router.use(auth);

  // Create new chat session
  router.post('/sessions', async (req, res) => {
    try {
      const { siteId } = req.body;

      if (!siteId) {
        return res.status(400).json({
          error: { message: 'siteId is required', type: 'validation_error' },
        });
      }

      const session = await editorService.createSession(req.user.id, siteId);
      res.json({ success: true, session });
    } catch (error) {
      if (error.code === 'SITE_NOT_FOUND') {
        return res.status(404).json({
          error: { message: 'Site not found', type: 'not_found' },
        });
      }
      console.error('Create session error:', error);
      res.status(500).json({
        error: { message: 'Failed to create session', type: 'server_error' },
      });
    }
  });

  // List sessions for a site
  router.get('/sessions', async (req, res) => {
    try {
      const { siteId } = req.query;

      if (!siteId) {
        return res.status(400).json({
          error: { message: 'siteId query param is required', type: 'validation_error' },
        });
      }

      const sessions = await editorService.listSessions(req.user.id, siteId);
      res.json({ success: true, sessions });
    } catch (error) {
      console.error('List sessions error:', error);
      res.status(500).json({
        error: { message: 'Failed to list sessions', type: 'server_error' },
      });
    }
  });

  // Get session with messages
  router.get('/sessions/:id', async (req, res) => {
    try {
      const session = await editorService.getSession(req.params.id, req.user.id);

      if (!session) {
        return res.status(404).json({
          error: { message: 'Session not found', type: 'not_found' },
        });
      }

      res.json({ success: true, session });
    } catch (error) {
      console.error('Get session error:', error);
      res.status(500).json({
        error: { message: 'Failed to get session', type: 'server_error' },
      });
    }
  });

  // Send message to session
  router.post('/sessions/:id/messages', async (req, res) => {
    try {
      const { message } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({
          error: { message: 'message is required', type: 'validation_error' },
        });
      }

      const result = await editorService.sendMessage(req.params.id, req.user.id, message.trim());
      res.json({ success: true, ...result });
    } catch (error) {
      if (error.code === 'SESSION_NOT_FOUND') {
        return res.status(404).json({
          error: { message: 'Session not found', type: 'not_found' },
        });
      }
      if (error.code === 'SITE_NOT_FOUND') {
        return res.status(404).json({
          error: { message: 'Site not found', type: 'not_found' },
        });
      }
      console.error('Send message error:', error);
      res.status(500).json({
        error: { message: 'Failed to process message', type: 'server_error' },
      });
    }
  });

  // Delete session
  router.delete('/sessions/:id', async (req, res) => {
    try {
      const deleted = await editorService.deleteSession(req.params.id, req.user.id);

      if (!deleted) {
        return res.status(404).json({
          error: { message: 'Session not found', type: 'not_found' },
        });
      }

      res.json({ success: true, message: 'Session deleted' });
    } catch (error) {
      console.error('Delete session error:', error);
      res.status(500).json({
        error: { message: 'Failed to delete session', type: 'server_error' },
      });
    }
  });

  return router;
}
