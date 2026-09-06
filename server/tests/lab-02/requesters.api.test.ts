import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks before any imports so vi.mock hoisting works correctly in ESM
// ---------------------------------------------------------------------------
const { devRequesterFindMany } = vi.hoisted(() => ({
  devRequesterFindMany: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    devRequester: { findMany: devRequesterFindMany },
  },
}));

import request from 'supertest';
import app from '../../src/app.js';

// ---------------------------------------------------------------------------
// Seed data mirrors the values from prisma/seed.ts
// ---------------------------------------------------------------------------
const activeRequesters = [
  { id: 1, name: 'Araya Phongphan',  email: 'araya.p@example.com'     },
  { id: 2, name: 'Nattaporn Srisuk', email: 'nattaporn.s@example.com' },
  { id: 3, name: 'Somchai Jaidee',   email: 'somchai.j@example.com'   },
  { id: 4, name: 'Wiroj Tanaka',     email: 'wiroj.t@example.com'     },
];

const inactiveRequester = {
  id: 5,
  name: 'Prayut Mahachai',
  email: 'prayut.m@example.com',
};

describe('GET /api/requesters', () => {
  // -------------------------------------------------------------------------
  // API-29: returns only active requesters with correct shape (200)
  // -------------------------------------------------------------------------
  describe('API-29 — active requesters returned', () => {
    beforeEach(() => {
      devRequesterFindMany.mockResolvedValue(activeRequesters);
    });

    it('returns 200 with an array of active requesters', async () => {
      const res = await request(app).get('/api/requesters');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('calls Prisma with isActive:true and name asc order', async () => {
      await request(app).get('/api/requesters');

      expect(devRequesterFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      });
    });

    it('returns id, name, and email for each requester', async () => {
      const res = await request(app).get('/api/requesters');

      expect(res.body).toEqual(activeRequesters);
      res.body.forEach((r: unknown) => {
        expect(r).toHaveProperty('id');
        expect(r).toHaveProperty('name');
        expect(r).toHaveProperty('email');
      });
    });
  });

  // -------------------------------------------------------------------------
  // API-30: inactive requester is absent from the response (BR-04, BR-05)
  // -------------------------------------------------------------------------
  describe('API-30 — inactive requester excluded', () => {
    beforeEach(() => {
      // Prisma honours the where:isActive:true filter — inactive never returned
      devRequesterFindMany.mockResolvedValue(activeRequesters);
    });

    it('does not include the inactive requester in the response', async () => {
      const res = await request(app).get('/api/requesters');

      const emails = res.body.map((r: { email: string }) => r.email);
      expect(emails).not.toContain(inactiveRequester.email);
    });
  });

  // -------------------------------------------------------------------------
  // Empty list — returns [] not 404 (api-spec.md §2.1)
  // -------------------------------------------------------------------------
  describe('empty active requester list', () => {
    beforeEach(() => {
      devRequesterFindMany.mockResolvedValue([]);
    });

    it('returns 200 with an empty array when no active requesters exist', async () => {
      const res = await request(app).get('/api/requesters');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Server error — safe 500 envelope, no stack trace (FR-19, api-spec.md §1)
  // -------------------------------------------------------------------------
  describe('server error handling', () => {
    beforeEach(() => {
      devRequesterFindMany.mockRejectedValue(new Error('DB connection lost'));
    });

    it('returns 500 with a safe INTERNAL_ERROR code', async () => {
      const res = await request(app).get('/api/requesters');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred.',
        },
      });
    });

    it('does not expose a stack trace in the error response', async () => {
      const res = await request(app).get('/api/requesters');

      expect(JSON.stringify(res.body)).not.toContain('stack');
      expect(JSON.stringify(res.body)).not.toContain('DB connection lost');
    });
  });
});
