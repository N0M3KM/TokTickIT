import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

/**
 * GET /api/related-systems
 * Returns all active RelatedSystems sorted by name ascending.
 * api-spec.md §2.3
 */
router.get('/', async (_req, res) => {
  try {
    const systems = await prisma.relatedSystem.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    res.status(200).json(systems);
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
