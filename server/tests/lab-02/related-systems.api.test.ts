import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks before any imports
// ---------------------------------------------------------------------------
const { relatedSystemFindMany } = vi.hoisted(() => ({
  relatedSystemFindMany: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    relatedSystem: { findMany: relatedSystemFindMany },
  },
}));

import request from 'supertest';
import app from '../../src/app.js';

const activeSystems = [
  { id: 1, name: 'Campus Wi-Fi'         },
  { id: 2, name: 'Corporate Laptop'     },
  { id: 3, name: 'Email'                },
  { id: 4, name: 'Grade Submission App' },
  { id: 5, name: 'LEB2 App'             },
  { id: 6, name: 'Printer'              },
  { id: 7, name: 'VPN'                  },
];

describe('GET /api/related-systems', () => {
  // -------------------------------------------------------------------------
  // Happy path — returns active systems sorted by name asc (api-spec §2.3)
  // -------------------------------------------------------------------------
  describe('active related systems returned', () => {
    beforeEach(() => {
      relatedSystemFindMany.mockResolvedValue(activeSystems);
    });

    it('returns 200 with an array of related systems', async () => {
      const res = await request(app).get('/api/related-systems');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('calls Prisma with isActive:true, id+name select, and name asc order', async () => {
      await request(app).get('/api/related-systems');

      expect(relatedSystemFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
    });

    it('returns id and name for each system', async () => {
      const res = await request(app).get('/api/related-systems');

      expect(res.body).toEqual(activeSystems);
      res.body.forEach((s: unknown) => {
        expect(s).toHaveProperty('id');
        expect(s).toHaveProperty('name');
      });
    });

    it('returns all 7 seeded related systems', async () => {
      const res = await request(app).get('/api/related-systems');

      expect(res.body).toHaveLength(7);
    });
  });

  // -------------------------------------------------------------------------
  // Empty list — returns [] not 404
  // -------------------------------------------------------------------------
  describe('empty related systems list', () => {
    beforeEach(() => {
      relatedSystemFindMany.mockResolvedValue([]);
    });

    it('returns 200 with an empty array when no active systems exist', async () => {
      const res = await request(app).get('/api/related-systems');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Server error — safe 500 envelope, no stack trace
  // -------------------------------------------------------------------------
  describe('server error handling', () => {
    beforeEach(() => {
      relatedSystemFindMany.mockRejectedValue(new Error('Connection refused'));
    });

    it('returns 500 with INTERNAL_ERROR code', async () => {
      const res = await request(app).get('/api/related-systems');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred.',
        },
      });
    });

    it('does not expose a stack trace or raw error message', async () => {
      const res = await request(app).get('/api/related-systems');

      expect(JSON.stringify(res.body)).not.toContain('stack');
      expect(JSON.stringify(res.body)).not.toContain('Connection refused');
    });
  });
});
