import { Priority, TicketStatus, UserRole } from '@prisma/client';
import { Request, Response, Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { canTransition, isTicketStatus, validateContent } from '../lib/ticketStatus.js';

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

router.patch('/:id/owner', async (req, res) => {
  try {
    if (!staffRoles.includes(req.user!.role)) return deny(res);
    const ticket = await ticketAccess(req, res); if (!ticket) return;
    const { ownerId } = req.body ?? {};
    if (ownerId !== null && (!Number.isInteger(ownerId) || ownerId < 1)) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'ownerId must be an active IT Staff or Administrator.' } });
    if (ownerId !== null) {
      const owner = await prisma.user.findFirst({ where: { id: ownerId, isActive: true, role: { in: staffRoles } } });
      if (!owner) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'ownerId must be an active IT Staff or Administrator.' } });
    }
    res.json(await prisma.ticket.update({ where: { id: ticket.id }, data: { ticketOwnerId: ownerId ?? null } }));
  } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } }); }
});

router.patch('/:id/it-priority', async (req, res) => {
  try {
    if (!staffRoles.includes(req.user!.role)) return deny(res);
    const ticket = await ticketAccess(req, res); if (!ticket) return;
    const value = req.body?.itPriority;
    if (!Object.values(Priority).includes(value)) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'itPriority must be a valid priority.' } });
    res.json(await prisma.ticket.update({ where: { id: ticket.id }, data: { itPriority: value } }));
  } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } }); }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const ticket = await ticketAccess(req, res); if (!ticket) return;
    const status = req.body?.status;
    if (!isTicketStatus(status)) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'status must be a valid ticket status.' } });
    if (!canTransition(ticket.currentStatus, status, req.user!.role)) return res.status(400).json({ error: { code: 'INVALID_TRANSITION', message: `Cannot transition from ${ticket.currentStatus} to ${status}.` } });
    res.json(await prisma.ticket.update({ where: { id: ticket.id }, data: { currentStatus: status } }));
  } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } }); }
});

router.post('/:id/requester-resolved', async (req, res) => {
  try {
    if (req.user!.role !== 'REQUESTER') return deny(res);
    const ticket = await ticketAccess(req, res); if (!ticket) return;
    if (ticket.requesterResolvedAt) return res.status(409).json({ error: { code: 'ALREADY_RESOLVED', message: 'This ticket has already been marked as resolved by the requester.' } });
    const updated = await prisma.ticket.update({ where: { id: ticket.id }, data: { requesterResolvedAt: new Date() } });
    res.json({ requesterResolvedAt: updated.requesterResolvedAt });
  } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } }); }
});

router.get('/:id/comments', async (req, res) => {
  try { if (!await ticketAccess(req, res)) return; res.json(await prisma.publicComment.findMany({ where: { ticketId: idOf(req) }, include: { author: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: 'asc' } })); }
  catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } }); }
});
router.post('/:id/comments', async (req, res) => {
  try { if (!await ticketAccess(req, res)) return; const error = validateContent(req.body?.content); if (error) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error } }); res.status(201).json(await prisma.publicComment.create({ data: { ticketId: idOf(req), authorId: req.user!.id, content: req.body.content.trim() }, include: { author: { select: { id: true, name: true, role: true } } } })); }
  catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } }); }
});
router.get('/:id/notes', async (req, res) => {
  try { if (!staffRoles.includes(req.user!.role)) return deny(res); if (!await ticketAccess(req, res)) return; res.json(await prisma.internalNote.findMany({ where: { ticketId: idOf(req) }, include: { author: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: 'asc' } })); }
  catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } }); }
});
router.post('/:id/notes', async (req, res) => {
  try { if (!staffRoles.includes(req.user!.role)) return deny(res); if (!await ticketAccess(req, res)) return; const error = validateContent(req.body?.content); if (error) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error } }); res.status(201).json(await prisma.internalNote.create({ data: { ticketId: idOf(req), authorId: req.user!.id, content: req.body.content.trim() }, include: { author: { select: { id: true, name: true, role: true } } } })); }
  catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } }); }
});

export default router;
