import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { userFindUnique, userFindMany, passwordCompare } = vi.hoisted(() => ({ userFindUnique: vi.fn(), userFindMany: vi.fn(), passwordCompare: vi.fn() }));
vi.mock('../../src/lib/prisma.js', () => ({ prisma: { user: { findUnique: userFindUnique, findMany: userFindMany } } }));
vi.mock('bcrypt', () => ({ default: { compare: passwordCompare, hash: vi.fn() } }));
import request from 'supertest';
import app from '../../src/app.js';
import { signToken } from '../../src/lib/auth.js';
import type { UserRole } from '@prisma/client';

// API-29/30 migration: the public DevRequester directory/empty picker was
// deliberately retired. Active identities now come from credential verification
// and the current cookie session; no account enumeration is reintroduced.
const activeSession = { id: 7, name: 'Authenticated requester', email: 'requester@test.invalid', role: 'REQUESTER', isActive: true, mustChangePassword: false };
const loginRecord = { ...activeSession, passwordHash: 'synthetic-test-hash' };
const cookie = (id = 7, role: UserRole = 'REQUESTER') => `tkt_token=${signToken(id, role)}`;
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('JWT_SECRET', 'retired-requester-directory-fixture-secret');
  userFindUnique.mockResolvedValue(activeSession); passwordCompare.mockResolvedValue(true);
});
afterEach(() => vi.unstubAllEnvs());

describe('retired requester enumeration stays unavailable', () => {
  it('returns 404 instead of publicly listing requester identities', async () => {
    const response = await request(app).get('/api/requesters');
    expect(response.status).toBe(404); expect(userFindMany).not.toHaveBeenCalled();
    expect(response.text).not.toContain(activeSession.email); expect(response.text).not.toContain(activeSession.name);
  });
  it.each(['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR'] as const)('does not resurrect the directory for %s', async role => {
    const response = await request(app).get('/api/requesters').set('Cookie', cookie(7, role));
    expect(response.status).toBe(404); expect(userFindMany).not.toHaveBeenCalled();
  });
});

describe('current-session identity replaces active requester selection', () => {
  it('returns only the session account using an allowlisted field selection', async () => {
    const response = await request(app).get('/api/auth/me?requesterId=999').set('Cookie', cookie());
    expect(response.status).toBe(200); expect(response.body).toEqual(activeSession);
    expect(userFindUnique).toHaveBeenCalledWith({ where: { id: 7 }, select: { id: true, name: true, email: true, role: true, mustChangePassword: true, isActive: true } });
    expect(userFindMany).not.toHaveBeenCalled(); expect(response.body).not.toHaveProperty('passwordHash');
  });
  it('uses the fresh account role rather than the stale role encoded in a token', async () => {
    const response = await request(app).get('/api/auth/me').set('Cookie', cookie(7, 'ADMINISTRATOR'));
    expect(response.status).toBe(200); expect(response.body.role).toBe('REQUESTER');
  });
  it('does not expose any session identity without authentication', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401); expect(userFindUnique).not.toHaveBeenCalled();
  });
  it('rejects inactive identities instead of allowing them to be selected', async () => {
    userFindUnique.mockResolvedValue({ ...activeSession, isActive: false });
    const response = await request(app).get('/api/auth/me').set('Cookie', cookie());
    expect(response.status).toBe(401); expect(JSON.stringify(response.body)).not.toContain(activeSession.email);
  });
  it('rejects a removed account without fabricating an empty identity list', async () => {
    userFindUnique.mockResolvedValue(null);
    const response = await request(app).get('/api/auth/me').set('Cookie', cookie());
    expect(response.status).toBe(401); expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
  it('reports mandatory password state while permitting session restoration', async () => {
    userFindUnique.mockResolvedValue({ ...activeSession, mustChangePassword: true });
    const response = await request(app).get('/api/auth/me').set('Cookie', cookie());
    expect(response.status).toBe(200); expect(response.body.mustChangePassword).toBe(true);
  });
  it('returns a safe error without exposing DB failures or private account data', async () => {
    userFindUnique.mockRejectedValue(new Error('Private DB connection lost'));
    const response = await request(app).get('/api/auth/me').set('Cookie', cookie());
    expect(response.status).toBe(500); expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(response.body)).not.toMatch(/stack|Private DB|passwordHash/);
  });
});

describe('credential authentication does not enumerate requester accounts', () => {
  it('returns a cookie-bound public identity after valid credentials without revealing its password hash', async () => {
    userFindUnique.mockResolvedValue(loginRecord);
    const response = await request(app).post('/api/auth/login').send({ email: ' REQUESTER@test.invalid ', password: 'SyntheticPassword!1', requesterId: 999 });
    expect(response.status).toBe(200);
    expect(userFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: 'requester@test.invalid' } }));
    expect(passwordCompare).toHaveBeenCalledWith('SyntheticPassword!1', 'synthetic-test-hash');
    expect(response.body).toEqual({ id: 7, name: activeSession.name, role: 'REQUESTER', mustChangePassword: false });
    expect(response.headers['set-cookie'][0]).toMatch(/tkt_token=.*HttpOnly.*SameSite=Strict/i);
    expect(response.body).not.toHaveProperty('passwordHash'); expect(response.body.id).not.toBe(999);
  });
  it('returns identical generic rejection for an unknown account and a wrong password', async () => {
    userFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(loginRecord); passwordCompare.mockResolvedValue(false);
    const absent = await request(app).post('/api/auth/login').send({ email: 'absent@test.invalid', password: 'WrongPassword!1' });
    const wrong = await request(app).post('/api/auth/login').send({ email: activeSession.email, password: 'WrongPassword!1' });
    expect(absent.status).toBe(401); expect(wrong.status).toBe(401); expect(absent.body).toEqual(wrong.body);
    expect(absent.body.error.code).toBe('INVALID_CREDENTIALS');
  });
  it('never authenticates an inactive requester even when its credentials are correct', async () => {
    userFindUnique.mockResolvedValue({ ...loginRecord, isActive: false });
    const response = await request(app).post('/api/auth/login').send({ email: activeSession.email, password: 'SyntheticPassword!1' });
    expect(response.status).toBe(403); expect(response.body.error.code).toBe('ACCOUNT_INACTIVE');
    expect(response.headers['set-cookie']).toBeUndefined();
  });
  it('does not disclose inactive account status when the supplied password is wrong', async () => {
    userFindUnique.mockResolvedValue({ ...loginRecord, isActive: false }); passwordCompare.mockResolvedValue(false);
    const response = await request(app).post('/api/auth/login').send({ email: activeSession.email, password: 'WrongPassword!1' });
    expect(response.status).toBe(401); expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
