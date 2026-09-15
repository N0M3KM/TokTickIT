import { Request, Response, NextFunction } from 'express';
import { verifyToken, isTokenBlocked, JwtPayload } from '../lib/auth.js';
import { UserRole } from '@prisma/client';

// Extend Express Request so downstream handlers have req.user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: number; role: UserRole; jti: string };
    }
  }
}

/**
 * requireAuth — verifies the JWT cookie and attaches req.user.
 * Returns 401 if the cookie is missing, invalid, or the token is blocklisted.
 * FR-03, BR-07
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token: string | undefined = req.cookies?.tkt_token;

  if (!token) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } });
    return;
  }

  try {
    const payload = verifyToken(token) as JwtPayload;

    if (isTokenBlocked(payload.jti)) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Session has been invalidated.' } });
      return;
    }

    req.user = { id: payload.sub, role: payload.role, jti: payload.jti };
    next();
  } catch {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Invalid or expired token.' } });
  }
}
