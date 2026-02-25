/**
 * User Auth Middleware
 * Validates session token from cookie (wts_session) or Authorization: Bearer header
 */

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(val);
  }
  return cookies;
}

function extractToken(req) {
  // Try cookie first
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.wts_session) return cookies.wts_session;

  // Fall back to Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

export function createUserAuth(authService) {
  return async (req, res, next) => {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        error: { message: 'Authentication required', type: 'authentication_error' },
      });
    }

    try {
      const result = await authService.validateSession(token);

      if (!result) {
        return res.status(401).json({
          error: { message: 'Invalid or expired session', type: 'authentication_error' },
        });
      }

      req.user = result.user;
      req.session = result.session;
      next();
    } catch (error) {
      console.error('User auth error:', error);
      return res.status(500).json({
        error: { message: 'Authentication error', type: 'server_error' },
      });
    }
  };
}

export function createOptionalUserAuth(authService) {
  return async (req, res, next) => {
    const token = extractToken(req);

    if (!token) {
      return next();
    }

    try {
      const result = await authService.validateSession(token);
      if (result) {
        req.user = result.user;
        req.session = result.session;
      }
    } catch (error) {
      // Silently continue — optional auth
    }

    next();
  };
}
