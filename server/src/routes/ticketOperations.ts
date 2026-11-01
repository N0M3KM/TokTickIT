import { UserRole } from '@prisma/client';
import { Request, Response, Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { validateContent } from '../lib/ticketStatus.js';

const router = Router();
const staffRoles: UserRole[] = ['IT_STAFF', 'ADMINISTRATOR'];
const idOf = (req: Request) => Number(req.params.id);
const deny = (res: Response) => res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action.' } });
const missing = (res: Response) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ticket not found.' } });

async function ticketAccess(req: Request, res: Response) {
  const ticket = await prisma.ticket.findUnique({ where: { id: idOf(req) } });
  if (!ticket) { missing(res); return null; }
  if (req.user!.role === 'REQUESTER' && ticket.requesterId !== req.user!.id) { deny(res); return null; }
  return ticket;
}

router.get('/:id/comments', async (req, res) => {
  try { if (!await ticketAccess(req, res)) return; res.json(await prisma.publicComment.findMany({ where: { ticketId: idOf(req) }, include: { author: { select: { id: true, name: true, role: true } } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })); }
  catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } }); }
});
router.post('/:id/comments', async (req, res) => {
  try { if (!await ticketAccess(req, res)) return; const error = validateContent(req.body?.content); if (error) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error } }); res.status(201).json(await prisma.publicComment.create({ data: { ticketId: idOf(req), authorId: req.user!.id, content: req.body.content.trim() }, include: { author: { select: { id: true, name: true, role: true } } } })); }
  catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } }); }
});
router.get('/:id/notes', async (req, res) => {
  try { if (!staffRoles.includes(req.user!.role)) return deny(res); if (!await ticketAccess(req, res)) return; res.json(await prisma.internalNote.findMany({ where: { ticketId: idOf(req) }, include: { author: { select: { id: true, name: true, role: true } } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })); }
  catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } }); }
});
router.post('/:id/notes', async (req, res) => {
  try { if (!staffRoles.includes(req.user!.role)) return deny(res); if (!await ticketAccess(req, res)) return; const error = validateContent(req.body?.content); if (error) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error } }); res.status(201).json(await prisma.internalNote.create({ data: { ticketId: idOf(req), authorId: req.user!.id, content: req.body.content.trim() }, include: { author: { select: { id: true, name: true, role: true } } } })); }
  catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } }); }
});

export default router;
