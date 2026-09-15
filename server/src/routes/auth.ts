import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import {
  comparePassword,
  hashPassword,
  signToken,
  verifyToken,
  blockToken,
  validatePasswordComplexity,
  type JwtPayload,
} from '../lib/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requirePasswordChanged } from '../middleware/requirePasswordChanged.js';

const router = Router();

const COOKIE_NAME = 'tkt_token';
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 8 * 60 * 60 * 1000, // 8 hours in ms
};

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many sign-in attempts. Please try again later.' } },
});

function internalError(res: Response): void {
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
}

// ---------------------------------------------------------------------------
// POST /api/auth/login — BR-01, BR-08, BR-09, AC-01
// ---------------------------------------------------------------------------
router.post('/login', loginRateLimit, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required.' },
      });
    }

    const normalised = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalised },
      select: { id: true, name: true, role: true, isActive: true, mustChangePassword: true, passwordHash: true },
    });

    // Generic 401 — do NOT distinguish "email not found" from "wrong password" (BR-08)
    if (!user) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      });
    }

    // Inactive account — 403 with safe message (BR-09)
    if (!user.isActive) {
      return res.status(403).json({
        error: { code: 'ACCOUNT_INACTIVE', message: 'This account has been deactivated. Please contact an administrator.' },
      });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      });
    }

    const token = signToken(user.id, user.role);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);

    return res.status(200).json({
      id: user.id,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });
  } catch {
    return internalError(res);
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout — AC-05
// ---------------------------------------------------------------------------
router.post('/logout', requireAuth, (req: Request, res: Response) => {
  try {
    const token: string = req.cookies?.[COOKIE_NAME];
    if (token) {
      try {
        const payload = verifyToken(token) as JwtPayload;
        // Block the token for 8 hours (same as token TTL)
        blockToken(payload.jti, Date.now() + 8 * 60 * 60 * 1000);
      } catch { /* ignore verify errors on logout */ }
    }
    res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'strict' });
    return res.status(200).json({ message: 'Logged out successfully.' });
  } catch {
    return internalError(res);
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/me — return current authenticated user (FR-05)
// ---------------------------------------------------------------------------
// `/me` is deliberately available before the mandatory password change so the
// client can restore a pending session and route it to `/change-password`.
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, role: true, mustChangePassword: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } });
    }

    return res.status(200).json(user);
  } catch {
    return internalError(res);
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/change-password — BR-02, BR-10, BR-11, AC-02, AC-20, AC-21
// Accessible even when mustChangePassword = true (that is precisely when it is needed)
// ---------------------------------------------------------------------------
router.post('/change-password', requireAuth, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body ?? {};

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'currentPassword, newPassword, and confirmPassword are required.' },
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'New password and confirmation do not match.', fields: { confirmPassword: 'Passwords do not match.' } },
      });
    }

    // Complexity check (BR-10, AC-21)
    const complexityErrors = validatePasswordComplexity(newPassword as string);
    if (complexityErrors.length > 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Password does not meet complexity requirements.',
          fields: { newPassword: complexityErrors.join(' ') },
        },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, passwordHash: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Account is inactive.' } });
    }

    const currentValid = await comparePassword(currentPassword as string, user.passwordHash);
    if (!currentValid) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Current password is incorrect.', fields: { currentPassword: 'Current password is incorrect.' } },
      });
    }

    // New password must differ from current (BR-11, AC-20)
    const sameAsCurrent = await comparePassword(newPassword as string, user.passwordHash);
    if (sameAsCurrent) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'New password must differ from the current password.', fields: { newPassword: 'New password must differ from the current password.' } },
      });
    }

    const newHash = await hashPassword(newPassword as string);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, mustChangePassword: false },
    });

    return res.status(200).json({ message: 'Password changed successfully.' });
  } catch {
    return internalError(res);
  }
});

export default router;
