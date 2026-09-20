import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';

/**
 * requireRole — restricts a route to one or more permitted roles.
 * Must run AFTER requireAuth so req.user is set.
 * FR-03, §6.2 Authorization and Safe Errors
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action.' } });
      return;
    }

    next();
  };
}
