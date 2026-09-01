import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

/**
 * GET /api/categories
 * Returns all active categories sorted by name ascending.
 * api-spec.md §2.2
 */
router.get('/', async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    res.status(200).json(categories);
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
