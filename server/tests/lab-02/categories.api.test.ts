import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks before any imports
// ---------------------------------------------------------------------------
const { categoryFindMany } = vi.hoisted(() => ({
  categoryFindMany: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    category: { findMany: categoryFindMany },
  },
}));

import request from 'supertest';
import app from '../../src/app.js';

const activeCategories = [
  { id: 1, name: 'Account and Access' },
  { id: 2, name: 'Hardware' },
  { id: 3, name: 'Network' },
  { id: 4, name: 'Software' },
];

describe('GET /api/categories', () => {
  // -------------------------------------------------------------------------
  // Happy path — returns active categories sorted by name asc (api-spec §2.2)
  // -------------------------------------------------------------------------
  describe('active categories returned', () => {
    beforeEach(() => {
      categoryFindMany.mockResolvedValue(activeCategories);
    });

    it('returns 200 with an array of categories', async () => {
      const res = await request(app).get('/api/categories');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('calls Prisma with isActive:true, id+name select, and name asc order', async () => {
      await request(app).get('/api/categories');

      expect(categoryFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
    });

    it('returns id and name for each category', async () => {
      const res = await request(app).get('/api/categories');

      expect(res.body).toEqual(activeCategories);
      res.body.forEach((c: unknown) => {
        expect(c).toHaveProperty('id');
        expect(c).toHaveProperty('name');
      });
    });
  });

  // -------------------------------------------------------------------------
  // Empty list — returns [] not 404
  // -------------------------------------------------------------------------
  describe('empty category list', () => {
    beforeEach(() => {
      categoryFindMany.mockResolvedValue([]);
    });

    it('returns 200 with an empty array when no active categories exist', async () => {
      const res = await request(app).get('/api/categories');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Server error — safe 500 envelope, no stack trace
  // -------------------------------------------------------------------------
  describe('server error handling', () => {
    beforeEach(() => {
      categoryFindMany.mockRejectedValue(new Error('DB timeout'));
    });

    it('returns 500 with INTERNAL_ERROR code', async () => {
      const res = await request(app).get('/api/categories');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred.',
        },
      });
    });

    it('does not expose a stack trace or raw error message', async () => {
      const res = await request(app).get('/api/categories');

      expect(JSON.stringify(res.body)).not.toContain('stack');
      expect(JSON.stringify(res.body)).not.toContain('DB timeout');
    });
  });
});
