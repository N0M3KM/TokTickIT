import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks before any imports
// ---------------------------------------------------------------------------
const { userFindUnique, userUpdate } = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate:     vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: userFindUnique, update: userUpdate },
  },
}));

// Mock bcrypt so tests don't take 1+ seconds per hash
vi.mock('bcrypt', () => ({
  default: {
    hash:    vi.fn().mockResolvedValue('$2b$12$hashedvalue'),
    compare: vi.fn(),
  },
  hash:    vi.fn().mockResolvedValue('$2b$12$hashedvalue'),
  compare: vi.fn(),
}));

import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../src/app.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const OLD_ENV = process.env;
beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...OLD_ENV, JWT_SECRET: 'test-secret-auth', JWT_EXPIRES_IN: '1h', NODE_ENV: 'test' };
});

const activeRequester = {
  id: 1,
  name: 'Somchai Jaidee',
  role: 'REQUESTER',
  isActive: true,
  mustChangePassword: false,
  passwordHash: '$2b$12$hashedvalue',
};

const inactiveUser = { ...activeRequester, id: 5, isActive: false };
const mustChangePwdUser = { ...activeRequester, id: 6, mustChangePassword: true };

// ---------------------------------------------------------------------------
// API-01: valid login returns 200 + user data + cookie
// ---------------------------------------------------------------------------
describe('API-01 — valid login', () => {
  beforeEach(() => {
    userFindUnique.mockResolvedValue(activeRequester);
    (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
  });

  it('returns 200 with id, name, role, mustChangePassword', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'somchai.j@example.com', password: 'Change@123' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, name: 'Somchai Jaidee', role: 'REQUESTER' });
  });

  it('sets an httpOnly cookie named "token"', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'somchai.j@example.com', password: 'Change@123' });

    const cookies: string[] = res.headers['set-cookie'] ?? [];
    const tokenCookie = cookies.find((c: string) => c.startsWith('token='));
    expect(tokenCookie).toBeDefined();
    expect(tokenCookie).toMatch(/HttpOnly/i);
  });

  it('does not return passwordHash in response (SEC-01)', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'somchai.j@example.com', password: 'Change@123' });

    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('$2b$');
  });

  it('email lookup is case-insensitive (UNIT-08)', async () => {
    // userFindUnique is called with lowercase email
    await request(app).post('/api/auth/login')
      .send({ email: 'SOMCHAI.J@EXAMPLE.COM', password: 'Change@123' });

    expect(userFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'somchai.j@example.com' } })
    );
  });
});

// ---------------------------------------------------------------------------
// API-02: wrong password → 401 generic message (BR-08)
// ---------------------------------------------------------------------------
describe('API-02 — wrong password returns 401 generic error', () => {
  beforeEach(() => {
    userFindUnique.mockResolvedValue(activeRequester);
    (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);
  });

  it('returns 401 with INVALID_CREDENTIALS code', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'somchai.j@example.com', password: 'WrongPass@1' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('does not reveal whether email exists', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'somchai.j@example.com', password: 'WrongPass@1' });

    expect(res.body.error.message).toMatch(/email or password/i);
  });
});

// ---------------------------------------------------------------------------
// API-03: unknown email → same 401 generic message (BR-08)
// ---------------------------------------------------------------------------
describe('API-03 — unknown email returns same 401 as wrong password', () => {
  beforeEach(() => {
    userFindUnique.mockResolvedValue(null); // user not found
  });

  it('returns 401 with identical message as wrong-password case', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Whatever@1' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.error.message).toMatch(/email or password/i);
  });
});

// ---------------------------------------------------------------------------
// API-04 / AC-06: inactive account → 403 with safe message (BR-09)
// ---------------------------------------------------------------------------
describe('API-04 / AC-06 — inactive account returns 403', () => {
  beforeEach(() => {
    userFindUnique.mockResolvedValue(inactiveUser);
  });

  it('returns 403 with ACCOUNT_INACTIVE code', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'prayut.m@example.com', password: 'Change@123' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
  });

  it('does not expose credential details', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'prayut.m@example.com', password: 'Change@123' });

    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });
});

// ---------------------------------------------------------------------------
// API-29: new password same as current → 400 (AC-20)
// ---------------------------------------------------------------------------
describe('API-29 / AC-20 — change-password rejects same password', () => {
  it('returns 400 when new password equals current', async () => {
    userFindUnique
      .mockResolvedValueOnce(activeRequester)  // requireAuth me lookup
      .mockResolvedValueOnce({ id: 1, isActive: true }) // requirePasswordChanged
      .mockResolvedValueOnce({ id: 1, passwordHash: '$2b$12$hashedvalue', isActive: true }); // change-password handler

    (bcrypt.compare as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(true)   // currentPassword correct
      .mockResolvedValueOnce(true);  // newPassword === current

    // Get a valid JWT cookie first
    (userFindUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(activeRequester);
    (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);
    const loginRes = await request(app).post('/api/auth/login')
      .send({ email: 'somchai.j@example.com', password: 'Change@123' });
    const cookie = (loginRes.headers['set-cookie'] as string[])?.[0];

    // Reset mocks for the change-password call
    vi.clearAllMocks();
    userFindUnique
      .mockResolvedValueOnce({ ...activeRequester, mustChangePassword: false }) // requirePasswordChanged
      .mockResolvedValueOnce({ id: 1, passwordHash: '$2b$12$hashedvalue', isActive: true }); // handler
    (bcrypt.compare as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(true)  // currentPassword correct
      .mockResolvedValueOnce(true); // same as current

    const res = await request(app).post('/api/auth/change-password')
      .set('Cookie', cookie ?? '')
      .send({ currentPassword: 'Change@123', newPassword: 'Change@123', confirmPassword: 'Change@123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// API-30: weak password → 400 with rule list (AC-21)
// ---------------------------------------------------------------------------
describe('API-30 / AC-21 — change-password rejects weak new password', () => {
  it('returns 400 PASSWORD_TOO_WEAK with rules array', async () => {
    // Get a valid JWT first
    userFindUnique.mockResolvedValueOnce(activeRequester);
    (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);
    const loginRes = await request(app).post('/api/auth/login')
      .send({ email: 'somchai.j@example.com', password: 'Change@123' });
    const cookie = (loginRes.headers['set-cookie'] as string[])?.[0];

    vi.clearAllMocks();
    userFindUnique.mockResolvedValueOnce({ ...activeRequester, mustChangePassword: false });

    const res = await request(app).post('/api/auth/change-password')
      .set('Cookie', cookie ?? '')
      .send({ currentPassword: 'Change@123', newPassword: 'weak', confirmPassword: 'weak' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PASSWORD_TOO_WEAK');
    expect(Array.isArray(res.body.error.rules)).toBe(true);
    expect(res.body.error.rules.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// API-31 / AC-02 / BR-02: mustChangePassword blocks protected routes
// ---------------------------------------------------------------------------
describe('API-31 / AC-02 — mustChangePassword blocks normal app routes', () => {
  it('returns 403 PASSWORD_CHANGE_REQUIRED when accessing /api/tickets', async () => {
    // Login with a user that must change password
    userFindUnique.mockResolvedValueOnce(mustChangePwdUser);
    (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);
    const loginRes = await request(app).post('/api/auth/login')
      .send({ email: 'somchai.j@example.com', password: 'Change@123' });
    const cookie = (loginRes.headers['set-cookie'] as string[])?.[0];

    vi.clearAllMocks();
    // requirePasswordChanged queries the user
    userFindUnique.mockResolvedValueOnce({ mustChangePassword: true, isActive: true });

    const res = await request(app).get('/api/tickets')
      .set('Cookie', cookie ?? '');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });
});

// ---------------------------------------------------------------------------
// API-32 / AC-19: POST /api/tickets uses JWT identity, ignores requesterId body
// ---------------------------------------------------------------------------
describe('API-32 / AC-19 — create ticket uses JWT identity (BR-03)', () => {
  it('does not require requesterId in body — uses req.user.id', async () => {
    // Just verify the endpoint is reachable with a valid JWT + password-changed user
    userFindUnique.mockResolvedValueOnce(activeRequester);
    (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);
    const loginRes = await request(app).post('/api/auth/login')
      .send({ email: 'somchai.j@example.com', password: 'Change@123' });
    const cookie = (loginRes.headers['set-cookie'] as string[])?.[0];

    vi.clearAllMocks();
    userFindUnique.mockResolvedValueOnce({ mustChangePassword: false, isActive: true });

    // POST without requesterId in body — should reach ticket validation (not a 400 for missing requesterId)
    const res = await request(app).post('/api/tickets')
      .set('Cookie', cookie ?? '')
      .send({ summary: '', description: '', requestedPriority: 'INVALID', categoryId: 0 });

    // Should get 400 validation error (not 400 for missing requesterId)
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    // requesterId should NOT appear as a field error (it comes from JWT now)
    expect(res.body.error.fields?.requesterId).toBeUndefined();
  });
});
