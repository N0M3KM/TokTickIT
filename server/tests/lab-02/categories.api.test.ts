import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks before any imports
// ---------------------------------------------------------------------------
const { categoryFindMany, userFindUnique } = vi.hoisted(() => ({
  categoryFindMany: vi.fn(), userFindUnique: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    category: { findMany: categoryFindMany },
    user: { findUnique: userFindUnique },
  },
}));

import request from 'supertest';
import app from '../../src/app.js';
import { signToken } from '../../src/lib/auth.js';

// Keep real authentication middleware and freshly loaded active-user role.
const activeUser = { id: 1, isActive: true, mustChangePassword: false, role: 'REQUESTER' };
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('JWT_SECRET', 'lab2-categories-fixture-secret');
  userFindUnique.mockResolvedValue(activeUser);
});
afterEach(() => vi.unstubAllEnvs());
const cookie = () => `tkt_token=${signToken(1, 'REQUESTER')}`;

const activeCategories = [
  { id: 1, name: 'Account and Access' },
  { id: 2, name: 'Hardware' },
  { id: 3, name: 'Network' },
  { id: 4, name: 'Software' },
];

describe('reference categories authentication regression', () => {
  it('does not query categories for an absent session', async () => {
    const response = await request(app).get('/api/categories');
    expect(response.status).toBe(401); expect(categoryFindMany).not.toHaveBeenCalled();
  });
  it('rejects inactive accounts before reading categories', async () => {
    userFindUnique.mockResolvedValue({ ...activeUser, isActive: false });
    const response = await request(app).get('/api/categories').set('Cookie', cookie());
    expect(response.status).toBe(401); expect(categoryFindMany).not.toHaveBeenCalled();
  });
  it('enforces mandatory password change before reading categories', async () => {
    userFindUnique.mockResolvedValue({ ...activeUser, mustChangePassword: true });
    const response = await request(app).get('/api/categories').set('Cookie', cookie());
    expect(response.status).toBe(403); expect(response.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED'); expect(categoryFindMany).not.toHaveBeenCalled();
  });
});

describe('GET /api/categories', () => {
  // -------------------------------------------------------------------------
  // Happy path โ€” returns active categories sorted by name asc (api-spec ยง2.2)
  // -------------------------------------------------------------------------
  describe('active categories returned', () => {
    beforeEach(() => {
      categoryFindMany.mockResolvedValue(activeCategories);
    });

    it('returns 200 with an array of categories', async () => {
      const res = await request(app).get('/api/categories').set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('calls Prisma with isActive:true, id+name select, and name asc order', async () => {
      await request(app).get('/api/categories').set('Cookie', cookie());

      expect(categoryFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
    });

    it('returns id and name for each category', async () => {
      const res = await request(app).get('/api/categories').set('Cookie', cookie());

      expect(res.body).toEqual(activeCategories);
      res.body.forEach((c: unknown) => {
        expect(c).toHaveProperty('id');
        expect(c).toHaveProperty('name');
      });
    });
  });

  // -------------------------------------------------------------------------
  // Empty list โ€” returns [] not 404
  // -------------------------------------------------------------------------
  describe('empty category list', () => {
    beforeEach(() => {
      categoryFindMany.mockResolvedValue([]);
    });

    it('returns 200 with an empty array when no active categories exist', async () => {
      const res = await request(app).get('/api/categories').set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Server error โ€” safe 500 envelope, no stack trace
  // -------------------------------------------------------------------------
  describe('server error handling', () => {
    beforeEach(() => {
      categoryFindMany.mockRejectedValue(new Error('DB timeout'));
    });

    it('returns 500 with INTERNAL_ERROR code', async () => {
      const res = await request(app).get('/api/categories').set('Cookie', cookie());

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred.',
        },
      });
    });

    it('does not expose a stack trace or raw error message', async () => {
      const res = await request(app).get('/api/categories').set('Cookie', cookie());

      expect(JSON.stringify(res.body)).not.toContain('stack');
      expect(JSON.stringify(res.body)).not.toContain('DB timeout');
    });
  });
});
