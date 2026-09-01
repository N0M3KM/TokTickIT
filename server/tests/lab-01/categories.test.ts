import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('../../src/lib/prisma.js', () => ({ prisma: { category: { findMany } } }));

import request from 'supertest';
import app from '../../src/app.js';

describe('API-02 GET /api/categories', () => {
  // Categories are now ordered by name asc and filtered by isActive (Lab 2 refactor).
  const seededCategories = [
    { id: 1, name: 'Account and Access' },
    { id: 2, name: 'Hardware' },
    { id: 3, name: 'Network' },
    { id: 4, name: 'Software' },
  ];

  beforeEach(() => findMany.mockResolvedValue(seededCategories));

  it('returns the seeded categories ordered by name ascending', async () => {
    const response = await request(app).get('/api/categories');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(seededCategories);
    expect(findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  });
});
