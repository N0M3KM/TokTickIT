import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

/**
 * requirePasswordChanged — blocks access to normal app routes when
 * the authenticated user still has mustChangePassword = true.
 * Must run AFTER requireAuth so req.user is set.
 * BR-02, FR-04
 */
export async function requirePasswordChanged(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { mustChangePassword: true, isActive: true },
    });

    if (!user || !user.isActive) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Account is inactive.' } });
      return;
    }

    if (user.mustChangePassword) {
      res.status(403).json({
        error: {
          code: 'PASSWORD_CHANGE_REQUIRED',
          message: 'You must change your password before accessing this resource.',
        },
      });
      return;
    }

    next();
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
  }
}
