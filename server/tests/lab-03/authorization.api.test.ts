import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { userFindUnique } = vi.hoisted(() => ({ userFindUnique: vi.fn() }));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { user: { findUnique: userFindUnique } },
}));

vi.mock('bcrypt', () => ({
  default: { hash: vi.fn().mockResolvedValue('$2b$12$x'), compare: vi.fn().mockResolvedValue(true) },
  hash:    vi.fn().mockResolvedValue('$2b$12$x'),
  compare: vi.fn().mockResolvedValue(true),
}));

import request from 'supertest';
import app from '../../src/app.js';
import { signToken } from '../../src/lib/auth.js';
import { UserRole } from '@prisma/client';

const OLD_ENV = process.env;
beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...OLD_ENV, JWT_SECRET: 'test-secret-authz', JWT_EXPIRES_IN: '1h', NODE_ENV: 'test' };
});

/** Build a cookie header with a valid JWT for given userId + role */
function authCookie(userId: number, role: UserRole): string {
  const token = signToken(userId, role);
  return `tkt_token=${token}`;
}

// Active user lookup used by requirePasswordChanged
const activeUser = { mustChangePassword: false, isActive: true };

// ---------------------------------------------------------------------------
// API-06 / FR-03: no JWT → 401 on any protected endpoint
// ---------------------------------------------------------------------------
describe('API-06 — protected endpoint without JWT returns 401', () => {
  it('GET /api/tickets returns 401', async () => {
    const res = await request(app).get('/api/tickets');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('POST /api/auth/logout returns 401 without cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// API-07 / AC-17: non-Admin cannot access /api/users
// ---------------------------------------------------------------------------
describe('API-07 / AC-17 — non-Admin GET /api/users returns 403', () => {
  it('Requester is forbidden', async () => {
    userFindUnique.mockResolvedValue(activeUser);
    const res = await request(app).get('/api/users')
      .set('Cookie', authCookie(1, UserRole.REQUESTER));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('IT_STAFF is forbidden', async () => {
    userFindUnique.mockResolvedValue(activeUser);
    const res = await request(app).get('/api/users')
      .set('Cookie', authCookie(2, UserRole.IT_STAFF));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// API-08 / AC-04: Requester cannot access Internal Notes endpoint
// ---------------------------------------------------------------------------
describe('API-08 / AC-04 — Requester GET /api/tickets/:id/notes returns 403', () => {
  it('returns 403 and does not expose note content', async () => {
    userFindUnique.mockResolvedValue(activeUser);
    const res = await request(app).get('/api/tickets/1/notes')
      .set('Cookie', authCookie(1, UserRole.REQUESTER));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(JSON.stringify(res.body)).not.toContain('content');
  });
});

// ---------------------------------------------------------------------------
// API-09 / AC-18: non-Staff cannot access /api/queue
// ---------------------------------------------------------------------------
describe('API-09 / AC-18 — non-IT-Staff GET /api/queue returns 403', () => {
  it('Requester is forbidden', async () => {
    userFindUnique.mockResolvedValue(activeUser);
    const res = await request(app).get('/api/queue')
      .set('Cookie', authCookie(1, UserRole.REQUESTER));
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// API-05 / AC-05: logout invalidates token
// ---------------------------------------------------------------------------
describe('API-05 / AC-05 — logout invalidates token', () => {
  it('returns 200 on logout; subsequent request with same token returns 401', async () => {
    userFindUnique.mockResolvedValue(activeUser);
    const cookie = authCookie(1, UserRole.REQUESTER);

    const logoutRes = await request(app).post('/api/auth/logout')
      .set('Cookie', cookie);
    expect(logoutRes.status).toBe(200);

    // After logout the token should be blocklisted
    userFindUnique.mockResolvedValue(activeUser);
    const afterLogout = await request(app).get('/api/tickets')
      .set('Cookie', cookie);
    expect(afterLogout.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// SEC-01: passwordHash never returned in any response
// ---------------------------------------------------------------------------
describe('SEC-01 — passwordHash never in any API response', () => {
  it('GET /api/auth/me does not include passwordHash', async () => {
    userFindUnique
      .mockResolvedValueOnce(activeUser) // requirePasswordChanged
      .mockResolvedValueOnce({            // /me handler
        id: 1, name: 'Test', email: 'test@example.com',
        role: 'REQUESTER', mustChangePassword: false, isActive: true,
      });

    const res = await request(app).get('/api/auth/me')
      .set('Cookie', authCookie(1, UserRole.REQUESTER));

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('$2b$');
  });
});

// ---------------------------------------------------------------------------
// SEC-03: all protected endpoints reject missing JWT
// ---------------------------------------------------------------------------
describe('SEC-03 — all key protected endpoints reject missing JWT', () => {
  const protectedRoutes = [
    { method: 'get',    path: '/api/tickets'   },
    { method: 'post',   path: '/api/tickets'   },
    { method: 'get',    path: '/api/auth/me'   },
  ] as const;

  for (const route of protectedRoutes) {
    it(`${route.method.toUpperCase()} ${route.path} → 401 without cookie`, async () => {
      const res = await (request(app) as Record<string, (p: string) => request.Test>)
        [route.method](route.path);
      expect(res.status).toBe(401);
    });
  }
});
