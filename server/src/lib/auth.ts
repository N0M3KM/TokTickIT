import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

const BCRYPT_ROUNDS = 12;

// ---------------------------------------------------------------------------
// Password helpers
// ---------------------------------------------------------------------------

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function validatePasswordComplexity(password: string): string[] {
  const errors: string[] = [];
  if (password.length < 8)         errors.push('Be at least 8 characters.');
  if (!/[A-Z]/.test(password))     errors.push('Include at least one uppercase letter.');
  if (!/[a-z]/.test(password))     errors.push('Include at least one lowercase letter.');
  if (!/[0-9]/.test(password))     errors.push('Include at least one number.');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Include at least one special character.');
  return errors;
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

export interface JwtPayload {
  sub:  number;       // user id
  role: UserRole;
  jti:  string;       // unique token id (for blocklist)
}

function jwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET environment variable is not set');
  return s;
}

function expiresIn(): string {
  return process.env.JWT_EXPIRES_IN ?? '8h';
}

export function signToken(userId: number, role: UserRole): string {
  const jti = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return jwt.sign({ sub: userId, role, jti } as JwtPayload, jwtSecret(), {
    expiresIn: expiresIn() as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, jwtSecret()) as unknown as JwtPayload;
}

// ---------------------------------------------------------------------------
// In-memory token blocklist (logout invalidation — BR-02 spec §6.1)
// Entries: jti → expiry epoch ms. Cleaned up on each lookup.
// ---------------------------------------------------------------------------

const blocklist = new Map<string, number>();

export function blockToken(jti: string, expiryMs: number): void {
  blocklist.set(jti, expiryMs);
}

export function isTokenBlocked(jti: string): boolean {
  const exp = blocklist.get(jti);
  if (exp === undefined) return false;
  if (Date.now() > exp) { blocklist.delete(jti); return false; } // expired entry — clean up
  return true;
}
