import { Prisma, Priority, UserRole } from '@prisma/client';
import { Request, Response, Router } from 'express';
import { WorkflowError, withTicketTransaction } from '../lib/ticketConcurrency.js';
import { allowedTicketTransitions, readResolutionGate } from '../lib/ticketWorkflow.js';
import { canTransition, isTicketStatus } from '../lib/ticketStatus.js';

const router = Router();
const staffRoles: UserRole[] = ['IT_STAFF', 'ADMINISTRATOR'];
function fail(res: Response, error: unknown) {
  if (error instanceof WorkflowError) return res.status(error.status).json({ error: {
    code: error.code, message: error.status === 409 ? 'The ticket changed or does not meet the workflow requirements.' : 'The request could not be completed.',
    ...(error.details ? { details: error.details } : {}),
  } });
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
}
function ticketId(req: Request) {
  if (typeof req.params.id !== 'string' || !/^[1-9]\d*$/.test(req.params.id)) throw new WorkflowError(400, 'VALIDATION_ERROR');
  const value = Number(req.params.id);
  if (!Number.isSafeInteger(value) || value < 1) throw new WorkflowError(400, 'VALIDATION_ERROR');
  return value;
}
function bodyOf(req: Request, fields: string[]) {
  const body: unknown = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some(key => !['expectedVersion', ...fields].includes(key))) throw new WorkflowError(400, 'VALIDATION_ERROR');
  const input = body as Record<string, unknown>;
  if (typeof input.expectedVersion !== 'number' || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) throw new WorkflowError(400, 'VALIDATION_ERROR');
  return input as Record<string, unknown> & { expectedVersion: number };
}
function requireStaff(req: Request) {
  if (!staffRoles.includes(req.user!.role)) throw new WorkflowError(403, 'FORBIDDEN');
}
const actorSelect = { id: true, name: true, role: true } as const;

router.patch('/:id/owner', async (req, res) => {
  try {
    requireStaff(req);
    const input = bodyOf(req, ['ownerId']);
    if (input.ownerId !== null && (typeof input.ownerId !== 'number' || !Number.isSafeInteger(input.ownerId) || input.ownerId < 1)) throw new WorkflowError(400, 'VALIDATION_ERROR');
    const result = await withTicketTransaction(ticketId(req), req.user!, input.expectedVersion, async (tx, ticket) => {
      const ownerId = input.ownerId as number | null;
      if (ownerId !== null) await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${ownerId} FOR SHARE`;
      const owner = ownerId === null ? null : await tx.user.findFirst({ where: { id: ownerId, isActive: true, role: { in: staffRoles } }, select: { id: true, name: true } });
      if (ownerId !== null && !owner) throw new WorkflowError(400, 'INVALID_ASSIGNEE');
      const previous = ticket.ticketOwnerId === null ? null : await tx.user.findUnique({ where: { id: ticket.ticketOwnerId }, select: { id: true, name: true } });
      const updated = await tx.ticket.update({ where: { id: ticket.id }, data: { ticketOwnerId: ownerId, version: { increment: 1 } } });
      await tx.ticketWorkflowEvent.create({ data: { ticketId: ticket.id, actorId: req.user!.id, kind: 'OWNER', before: { ticketOwner: previous }, after: { ticketOwner: owner } } });
      return { ...updated, allowedTransitions: allowedTicketTransitions(updated.currentStatus, req.user!.role), resolutionGate: await readResolutionGate(tx, updated) };
    });
    res.set('Cache-Control', 'no-store').json(result);
  } catch (error) { fail(res, error); }
});

router.patch('/:id/it-priority', async (req, res) => {
  try {
    requireStaff(req);
    const input = bodyOf(req, ['itPriority']);
    if (typeof input.itPriority !== 'string' || !Object.values(Priority).includes(input.itPriority as Priority)) throw new WorkflowError(400, 'VALIDATION_ERROR');
    const result = await withTicketTransaction(ticketId(req), req.user!, input.expectedVersion, async (tx, ticket) => {
      const updated = await tx.ticket.update({ where: { id: ticket.id }, data: { itPriority: input.itPriority as Priority, version: { increment: 1 } } });
      await tx.ticketWorkflowEvent.create({ data: { ticketId: ticket.id, actorId: req.user!.id, kind: 'PRIORITY', before: { itPriority: ticket.itPriority }, after: { itPriority: updated.itPriority } } });
      return { ...updated, allowedTransitions: allowedTicketTransitions(updated.currentStatus, req.user!.role), resolutionGate: await readResolutionGate(tx, updated) };
    });
    res.set('Cache-Control', 'no-store').json(result);
  } catch (error) { fail(res, error); }
});

router.patch('/:id/status', async (req, res) => {
  try {
    if (req.user!.role === 'REQUESTER' && req.body?.status !== 'REOPENED') throw new WorkflowError(403, 'FORBIDDEN');
    const input = bodyOf(req, ['status']);
    if (!isTicketStatus(input.status)) throw new WorkflowError(400, 'VALIDATION_ERROR');
    const status = input.status;
    const result = await withTicketTransaction(ticketId(req), req.user!, input.expectedVersion, async (tx, ticket) => {
      if (!canTransition(ticket.currentStatus, status, req.user!.role)) throw new WorkflowError(400, 'INVALID_TRANSITION');
      if (status === 'RESOLVED') {
        const gate = await readResolutionGate(tx, ticket);
        if (gate.reasons.length) throw new WorkflowError(409, 'RESOLUTION_BLOCKED', { reasons: gate.reasons });
      }
      if (status === 'CANCELLED' && await tx.actionTaken.count({ where: { ticketId: ticket.id, status: { in: ['PLANNED', 'IN_PROGRESS'] } } }) > 0) throw new WorkflowError(409, 'CANCELLATION_BLOCKED');
      const now = new Date();
      const updated = await tx.ticket.update({ where: { id: ticket.id }, data: {
        currentStatus: status, version: { increment: 1 },
        ...(status === 'RESOLVED' ? { resolvedAt: now, resolutionTimeEstimated: false } : {}),
        ...(status === 'REOPENED' ? { resolvedAt: null, reopenedAt: now, resolutionTimeEstimated: false } : {}),
      } });
      const snapshot = (value: typeof updated) => ({ currentStatus: value.currentStatus,
        resolvedAt: value.resolvedAt?.toISOString() ?? null, reopenedAt: value.reopenedAt?.toISOString() ?? null,
        resolutionTimeEstimated: value.resolutionTimeEstimated });
      await tx.ticketWorkflowEvent.create({ data: { ticketId: ticket.id, actorId: req.user!.id, kind: 'STATUS', before: snapshot(ticket), after: snapshot(updated) } });
      return { ...updated, allowedTransitions: allowedTicketTransitions(updated.currentStatus, req.user!.role), resolutionGate: await readResolutionGate(tx, updated) };
    });
    res.set('Cache-Control', 'no-store').json(result);
  } catch (error) { fail(res, error); }
});

router.post('/:id/requester-resolved', async (req, res) => {
  try {
    if (req.user!.role !== 'REQUESTER') throw new WorkflowError(403, 'FORBIDDEN');
    const input = bodyOf(req, []);
    const result = await withTicketTransaction(ticketId(req), req.user!, input.expectedVersion, async (tx, ticket) => {
      if (ticket.requesterResolvedAt) throw new WorkflowError(409, 'ALREADY_RESOLVED');
      const updated = await tx.ticket.update({ where: { id: ticket.id }, data: { requesterResolvedAt: new Date(), version: { increment: 1 } } });
      await tx.ticketWorkflowEvent.create({ data: { ticketId: ticket.id, actorId: req.user!.id, kind: 'REQUESTER_INDICATION', before: { requesterResolvedAt: null }, after: { requesterResolvedAt: updated.requesterResolvedAt!.toISOString() } } });
      return { requesterResolvedAt: updated.requesterResolvedAt, version: updated.version };
    });
    res.set('Cache-Control', 'no-store').json(result);
  } catch (error) { fail(res, error); }
});

function pageOf(query: Request['query']) {
  if (Object.keys(query).some(key => !['page', 'pageSize'].includes(key))) throw new WorkflowError(400, 'VALIDATION_ERROR');
  const rawPage = query.page ?? '1', rawSize = query.pageSize ?? '10';
  if (typeof rawPage !== 'string' || !/^[1-9]\d*$/.test(rawPage) || typeof rawSize !== 'string' || !['10', '25', '50'].includes(rawSize)) throw new WorkflowError(400, 'VALIDATION_ERROR');
  const page = Number(rawPage), pageSize = Number(rawSize);
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger((page - 1) * pageSize)) throw new WorkflowError(400, 'VALIDATION_ERROR');
  return { page, pageSize };
}
/** Only the public workflow values written above are returned, even for old JSON. */
function publicSnapshot(value: Prisma.JsonValue) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, Prisma.JsonValue> = {};
  for (const field of ['itPriority', 'currentStatus', 'requesterResolvedAt', 'resolvedAt', 'reopenedAt', 'resolutionTimeEstimated']) {
    const item = value[field];
    if (item === null || typeof item === 'string' || typeof item === 'boolean') result[field] = item;
  }
  const owner = value.ticketOwner;
  if (owner === null) result.ticketOwner = null;
  else if (owner && typeof owner === 'object' && !Array.isArray(owner) && typeof owner.id === 'number' && typeof owner.name === 'string') result.ticketOwner = { id: owner.id, name: owner.name };
  return result;
}

router.get('/:id/history', async (req, res) => {
  try {
    const { page, pageSize } = pageOf(req.query);
    const result = await withTicketTransaction(ticketId(req), req.user!, undefined, async (tx, ticket) => {
      const where = { ticketId: ticket.id };
      const total = await tx.ticketWorkflowEvent.count({ where });
      const events = await tx.ticketWorkflowEvent.findMany({ where, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize, select: {
        id: true, ticketId: true, kind: true, actor: { select: actorSelect }, before: true, after: true, createdAt: true,
      } });
      return { data: events.map(event => ({ ...event, before: publicSnapshot(event.before), after: publicSnapshot(event.after) })), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 } };
    });
    res.set('Cache-Control', 'no-store').json(result);
  } catch (error) { fail(res, error); }
});

export default router;
