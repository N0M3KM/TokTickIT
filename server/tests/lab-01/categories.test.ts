import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany, userFindUnique } = vi.hoisted(() => ({ findMany: vi.fn(), userFindUnique: vi.fn() }));
vi.mock('../../src/lib/prisma.js', () => ({ prisma: { category: { findMany }, user: { findUnique: userFindUnique } } }));

import request from 'supertest';
import app from '../../src/app.js';
import { signToken } from '../../src/lib/auth.js';

// Lab 3 protects reference data; use a real signed cookie and active fresh role.
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('JWT_SECRET', 'lab1-category-fixture-secret');
  userFindUnique.mockResolvedValue({ id: 1, isActive: true, mustChangePassword: false, role: 'REQUESTER' });
});
afterEach(() => vi.unstubAllEnvs());

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
    const response = await request(app).get('/api/categories').set('Cookie', `tkt_token=${signToken(1, 'REQUESTER')}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(seededCategories);
    expect(findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  });
  it('requires an authenticated session before reading reference data', async () => {
    const response = await request(app).get('/api/categories');
    expect(response.status).toBe(401); expect(findMany).not.toHaveBeenCalled();
  });
});
