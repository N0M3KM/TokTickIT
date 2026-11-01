import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks before any imports
// ---------------------------------------------------------------------------
const { relatedSystemFindMany, userFindUnique } = vi.hoisted(() => ({
  relatedSystemFindMany: vi.fn(), userFindUnique: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    relatedSystem: { findMany: relatedSystemFindMany },
    user: { findUnique: userFindUnique },
  },
}));

import request from 'supertest';
import app from '../../src/app.js';
import { signToken } from '../../src/lib/auth.js';

const activeUser = { id: 1, isActive: true, mustChangePassword: false, role: 'REQUESTER' };
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('JWT_SECRET', 'lab2-systems-fixture-secret');
  userFindUnique.mockResolvedValue(activeUser);
});
afterEach(() => vi.unstubAllEnvs());
const cookie = () => `tkt_token=${signToken(1, 'REQUESTER')}`;

const activeSystems = [
  { id: 1, name: 'Campus Wi-Fi'         },
  { id: 2, name: 'Corporate Laptop'     },
  { id: 3, name: 'Email'                },
  { id: 4, name: 'Grade Submission App' },
  { id: 5, name: 'LEB2 App'             },
  { id: 6, name: 'Printer'              },
  { id: 7, name: 'VPN'                  },
];

describe('related systems authentication regression', () => {
  it('does not query related systems without a session', async () => {
    const response = await request(app).get('/api/related-systems');
    expect(response.status).toBe(401); expect(relatedSystemFindMany).not.toHaveBeenCalled();
  });
  it('blocks a required password change before returning related systems', async () => {
    userFindUnique.mockResolvedValue({ ...activeUser, mustChangePassword: true });
    const response = await request(app).get('/api/related-systems').set('Cookie', cookie());
    expect(response.status).toBe(403); expect(response.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED'); expect(relatedSystemFindMany).not.toHaveBeenCalled();
  });
});

describe('GET /api/related-systems', () => {
  // -------------------------------------------------------------------------
  // Happy path โ€” returns active systems sorted by name asc (api-spec ยง2.3)
  // -------------------------------------------------------------------------
  describe('active related systems returned', () => {
    beforeEach(() => {
      relatedSystemFindMany.mockResolvedValue(activeSystems);
    });

    it('returns 200 with an array of related systems', async () => {
      const res = await request(app).get('/api/related-systems').set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('calls Prisma with isActive:true, id+name select, and name asc order', async () => {
      await request(app).get('/api/related-systems').set('Cookie', cookie());

      expect(relatedSystemFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
    });

    it('returns id and name for each system', async () => {
      const res = await request(app).get('/api/related-systems').set('Cookie', cookie());

      expect(res.body).toEqual(activeSystems);
      res.body.forEach((s: unknown) => {
        expect(s).toHaveProperty('id');
        expect(s).toHaveProperty('name');
      });
    });

    it('returns all 7 seeded related systems', async () => {
      const res = await request(app).get('/api/related-systems').set('Cookie', cookie());

      expect(res.body).toHaveLength(7);
    });
  });

  // -------------------------------------------------------------------------
  // Empty list โ€” returns [] not 404
  // -------------------------------------------------------------------------
  describe('empty related systems list', () => {
    beforeEach(() => {
      relatedSystemFindMany.mockResolvedValue([]);
    });

    it('returns 200 with an empty array when no active systems exist', async () => {
      const res = await request(app).get('/api/related-systems').set('Cookie', cookie());

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Server error โ€” safe 500 envelope, no stack trace
  // -------------------------------------------------------------------------
  describe('server error handling', () => {
    beforeEach(() => {
      relatedSystemFindMany.mockRejectedValue(new Error('Connection refused'));
    });

    it('returns 500 with INTERNAL_ERROR code', async () => {
      const res = await request(app).get('/api/related-systems').set('Cookie', cookie());

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred.',
        },
      });
    });

    it('does not expose a stack trace or raw error message', async () => {
      const res = await request(app).get('/api/related-systems').set('Cookie', cookie());

      expect(JSON.stringify(res.body)).not.toContain('stack');
      expect(JSON.stringify(res.body)).not.toContain('Connection refused');
    });
  });
});
