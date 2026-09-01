import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

/**
 * GET /api/requesters
 * Returns only active DevRequesters sorted by name ascending.
 * Inactive requesters (isActive = false) are never included — BR-04, BR-05.
 * Returns [] (not 404) when no active requesters exist.
 * api-spec.md §2.1
 */
router.get('/', async (_req, res) => {
  try {
    const requesters = await prisma.devRequester.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
    res.status(200).json(requesters);
  } catch {
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
  }
});

export default router;
