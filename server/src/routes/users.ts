import { Prisma, UserRole } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { Request, Response, Router } from 'express';
import { hashPassword } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
const select = { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true, createdAt: true, updatedAt: true } as const;
const validRole = (value: unknown): value is UserRole => typeof value === 'string' && Object.values(UserRole).includes(value as UserRole);
const normalEmail = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : '';
const validName = (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 100;
const error = (res: Response, status: number, code: string, message: string) => res.status(status).json({ error: { code, message } });
const generateInitialPassword = () => `Aa1!${randomBytes(24).toString('base64url')}`;

router.get('/', async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const role = validRole(req.query.role) ? req.query.role : undefined;
  const where: Prisma.UserWhereInput = { ...(role ? { role } : {}), ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : {}) };
  try { res.json(await prisma.user.findMany({ where, select, orderBy: { name: 'asc' } })); }
  catch { error(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.'); }
});

router.post('/', async (req, res) => {
  const { name, role, isActive = true } = req.body ?? {};
  const email = normalEmail(req.body?.email);
  if (!validName(name) || !email || !validRole(role) || typeof isActive !== 'boolean') return error(res, 400, 'VALIDATION_ERROR', 'Name, email, role, and active state are required.');
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return error(res, 409, 'DUPLICATE_EMAIL', 'Email address is already in use.');
    const initialPassword = generateInitialPassword();
    const user = await prisma.user.create({ data: { name: name.trim(), email, role, isActive, passwordHash: await hashPassword(initialPassword), mustChangePassword: true }, select });
    // This is intentionally the only response that includes the temporary password.
    res.status(201).json({ user, initialPassword });
  } catch { error(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.'); }
});

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return error(res, 404, 'NOT_FOUND', 'User not found.');
  const { name, role, isActive } = req.body ?? {};
  const email = req.body?.email === undefined ? undefined : normalEmail(req.body.email);
  if (name !== undefined && !validName(name)) return error(res, 400, 'VALIDATION_ERROR', 'Name must be between 1 and 100 characters.');
  if (role !== undefined && !validRole(role)) return error(res, 400, 'VALIDATION_ERROR', 'Role is invalid.');
  if (isActive !== undefined && typeof isActive !== 'boolean') return error(res, 400, 'VALIDATION_ERROR', 'isActive must be boolean.');
  try {
    const current = await prisma.user.findUnique({ where: { id } });
    if (!current) return error(res, 404, 'NOT_FOUND', 'User not found.');
    if (id === req.user!.id && isActive === false) return error(res, 409, 'SELF_DEACTIVATION', 'Administrators cannot deactivate their own account.');
    const removesActiveAdmin = current.role === 'ADMINISTRATOR' && current.isActive && (isActive === false || role !== undefined && role !== 'ADMINISTRATOR');
    if (removesActiveAdmin) {
      const activeAdmins = await prisma.user.count({ where: { role: 'ADMINISTRATOR', isActive: true } });
      if (activeAdmins <= 1) return error(res, 409, 'LAST_ADMIN', 'At least one active Administrator must remain.');
    }
    if (email && email !== current.email) {
      const duplicate = await prisma.user.findUnique({ where: { email } });
      if (duplicate) return error(res, 409, 'DUPLICATE_EMAIL', 'Email address is already in use.');
    }
    res.json(await prisma.user.update({ where: { id }, data: { ...(name !== undefined ? { name: name.trim() } : {}), ...(email !== undefined ? { email } : {}), ...(role !== undefined ? { role } : {}), ...(isActive !== undefined ? { isActive } : {}) }, select }));
  } catch { error(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.'); }
});

router.post('/:id/set-password', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return error(res, 404, 'NOT_FOUND', 'User not found.');
  try {
    const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return error(res, 404, 'NOT_FOUND', 'User not found.');
    const initialPassword = generateInitialPassword();
    await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(initialPassword), mustChangePassword: true } });
    // The cleartext password is returned once and is never persisted or logged.
    res.json({ message: 'Initial password generated. The user must change it at next login.', initialPassword });
  } catch { error(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.'); }
});

export default router;
