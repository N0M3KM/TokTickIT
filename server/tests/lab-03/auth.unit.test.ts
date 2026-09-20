import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  hashPassword,
  comparePassword,
  validatePasswordComplexity,
  signToken,
  verifyToken,
  blockToken,
  isTokenBlocked,
} from '../../src/lib/auth.js';
import { UserRole } from '@prisma/client';

// ── UNIT-01: bcrypt hash is not plaintext ─────────────────────────────────
describe('UNIT-01 — password hashing', () => {
  it('hash is not equal to the plaintext password', async () => {
    const hash = await hashPassword('MySecret@1');
    expect(hash).not.toBe('MySecret@1');
    expect(hash).toMatch(/^\$2b\$/);
  });

  it('comparePassword returns true for correct password', async () => {
    const hash = await hashPassword('MySecret@1');
    expect(await comparePassword('MySecret@1', hash)).toBe(true);
  });

  it('comparePassword returns false for wrong password', async () => {
    const hash = await hashPassword('MySecret@1');
    expect(await comparePassword('WrongPass@1', hash)).toBe(false);
  });
});

// ── UNIT-02 / UNIT-03 / UNIT-04: password complexity ─────────────────────
describe('UNIT-02 — valid password passes complexity check', () => {
  it('returns empty array for a valid password', () => {
    expect(validatePasswordComplexity('Secure@123')).toHaveLength(0);
  });
});

describe('UNIT-03 — missing uppercase fails complexity', () => {
  it('returns error listing uppercase rule', () => {
    const errs = validatePasswordComplexity('secure@123');
    expect(errs.some(e => /uppercase/i.test(e))).toBe(true);
  });
});

describe('UNIT-04 — too short fails complexity', () => {
  it('returns error for password shorter than 8 chars', () => {
    const errs = validatePasswordComplexity('S@1xYz');
    expect(errs.some(e => /8 char/i.test(e))).toBe(true);
  });

  it('missing digit is flagged', () => {
    const errs = validatePasswordComplexity('SecurePass@');
    expect(errs.some(e => /number/i.test(e))).toBe(true);
  });

  it('missing special character is flagged', () => {
    const errs = validatePasswordComplexity('SecurePass1');
    expect(errs.some(e => /special/i.test(e))).toBe(true);
  });
});

// ── UNIT-08: email normalisation is handled at route level — test sign/verify ─
describe('JWT sign and verify', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, JWT_SECRET: 'test-secret-for-unit-tests', JWT_EXPIRES_IN: '1h' };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('signToken returns a JWT string', () => {
    const token = signToken(1, UserRole.REQUESTER);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('verifyToken returns correct payload', () => {
    const token = signToken(42, UserRole.IT_STAFF);
    const payload = verifyToken(token);
    expect(payload.sub).toBe(42);
    expect(payload.role).toBe(UserRole.IT_STAFF);
    expect(typeof payload.jti).toBe('string');
  });

  it('verifyToken throws on tampered token', () => {
    const token = signToken(1, UserRole.REQUESTER);
    expect(() => verifyToken(token + 'tamper')).toThrow();
  });
});

// ── Token blocklist ───────────────────────────────────────────────────────
describe('token blocklist', () => {
  it('isTokenBlocked returns false for unknown jti', () => {
    expect(isTokenBlocked('unknown-jti-xyz')).toBe(false);
  });

  it('isTokenBlocked returns true after blockToken', () => {
    const jti = `test-${Date.now()}`;
    blockToken(jti, Date.now() + 60_000);
    expect(isTokenBlocked(jti)).toBe(true);
  });

  it('isTokenBlocked returns false for expired blocklist entry', () => {
    const jti = `expired-${Date.now()}`;
    blockToken(jti, Date.now() - 1); // already expired
    expect(isTokenBlocked(jti)).toBe(false);
  });
});
