import { Router } from 'express';
import { config } from '../config.js';
import { createUserAuth } from '../middleware/user-auth.js';

/**
 * Create auth router
 * Mounted at /api/auth
 */
export default function createAuthRouter(authService) {
  const router = Router();
  const auth = createUserAuth(authService);

  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV !== 'development',
    path: '/',
    maxAge: config.auth.sessionMaxAge,
  };

  // ==========================================
  // PUBLIC
  // ==========================================

  router.post('/register', async (req, res) => {
    try {
      const { email, password, displayName } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: { message: 'Email and password are required', type: 'validation_error' },
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          error: { message: 'Password must be at least 8 characters', type: 'validation_error' },
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          error: { message: 'Invalid email address', type: 'validation_error' },
        });
      }

      const user = await authService.register(email, password, displayName);
      const session = await authService.createSession(user.id, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      res.cookie('wts_session', session.token, cookieOptions);

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          planTier: user.plan_tier,
        },
      });
    } catch (error) {
      if (error.code === 'EMAIL_EXISTS') {
        return res.status(409).json({
          error: { message: 'Email already registered', type: 'conflict' },
        });
      }
      console.error('Register error:', error);
      res.status(500).json({
        error: { message: 'Registration failed', type: 'server_error' },
      });
    }
  });

  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: { message: 'Email and password are required', type: 'validation_error' },
        });
      }

      const user = await authService.login(email, password);
      const session = await authService.createSession(user.id, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      res.cookie('wts_session', session.token, cookieOptions);

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          planTier: user.plan_tier,
        },
      });
    } catch (error) {
      if (error.code === 'INVALID_CREDENTIALS' || error.code === 'ACCOUNT_DISABLED') {
        return res.status(401).json({
          error: { message: error.message, type: 'authentication_error' },
        });
      }
      console.error('Login error:', error);
      res.status(500).json({
        error: { message: 'Login failed', type: 'server_error' },
      });
    }
  });

  // ==========================================
  // AUTHENTICATED
  // ==========================================

  router.post('/logout', auth, async (req, res) => {
    try {
      await authService.deleteSession(req.session.token);
      res.clearCookie('wts_session', { path: '/' });
      res.json({ success: true });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        error: { message: 'Logout failed', type: 'server_error' },
      });
    }
  });

  router.get('/me', auth, async (req, res) => {
    res.json({
      success: true,
      user: req.user,
    });
  });

  router.put('/password', auth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          error: { message: 'Current and new password are required', type: 'validation_error' },
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          error: { message: 'New password must be at least 8 characters', type: 'validation_error' },
        });
      }

      await authService.updatePassword(req.user.id, currentPassword, newPassword);

      res.json({ success: true, message: 'Password updated' });
    } catch (error) {
      if (error.code === 'INVALID_PASSWORD') {
        return res.status(403).json({
          error: { message: 'Current password is incorrect', type: 'authentication_error' },
        });
      }
      console.error('Password update error:', error);
      res.status(500).json({
        error: { message: 'Password update failed', type: 'server_error' },
      });
    }
  });

  router.put('/profile', auth, async (req, res) => {
    try {
      const { displayName } = req.body;

      const user = await authService.updateProfile(req.user.id, { displayName });

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          planTier: user.plan_tier,
          status: user.status,
          createdAt: user.created_at,
        },
      });
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({
        error: { message: 'Profile update failed', type: 'server_error' },
      });
    }
  });

  router.delete('/account', auth, async (req, res) => {
    try {
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({
          error: { message: 'Password is required to delete account', type: 'validation_error' },
        });
      }

      await authService.deleteUser(req.user.id, password);
      res.clearCookie('wts_session', { path: '/' });

      res.json({ success: true, message: 'Account deleted' });
    } catch (error) {
      if (error.code === 'INVALID_PASSWORD') {
        return res.status(403).json({
          error: { message: 'Password is incorrect', type: 'authentication_error' },
        });
      }
      console.error('Account deletion error:', error);
      res.status(500).json({
        error: { message: 'Account deletion failed', type: 'server_error' },
      });
    }
  });

  return router;
}
