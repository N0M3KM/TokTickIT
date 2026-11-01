import { Prisma, type ActionTaken } from '@prisma/client';
import { Router, type Request, type Response } from 'express';
import { ActionReadOnlyError, ActionTransitionError, ActionValidationError, actionFingerprint, parseCreateAction, parseUpdateAction, validateIdempotencyKey } from '../lib/actionValidation.js';
import { WorkflowError, withTicketTransaction } from '../lib/ticketConcurrency.js';

const router = Router();
const actorSelect = { id: true, name: true, role: true } as const;
const actionInclude = { performedBy: { select: actorSelect }, assignee: { select: { ...actorSelect, isActive: true } }, updatedBy: { select: actorSelect } } as const;
type PublicAction = Prisma.ActionTakenGetPayload<{ include: typeof actionInclude }>;
function dto(action: PublicAction) {
  return { id: action.id, ticketId: action.ticketId, actionAt: action.actionAt, description: action.description,
    result: action.result, performedBy: action.performedBy, assignee: action.assignee,
    followUpRequired: action.followUpRequired, followUpNote: action.followUpNote,
    attachmentNotes: action.attachmentNotes, status: action.status, cancellationReason: action.cancellationReason,
    version: action.version, updatedBy: action.updatedBy, createdAt: action.createdAt, updatedAt: action.updatedAt };
}
function snapshot(action: ActionTaken): Prisma.InputJsonObject {
  return { actionAt: action.actionAt.toISOString(), description: action.description, result: action.result,
    performedById: action.performedById, assigneeId: action.assigneeId, updatedById: action.updatedById,
    followUpRequired: action.followUpRequired, followUpNote: action.followUpNote,
    attachmentNotes: action.attachmentNotes, status: action.status, cancellationReason: action.cancellationReason };
}
function id(value: unknown): number {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new WorkflowError(400, 'VALIDATION_ERROR');
  return Number(value);
}
function pagination(req: Request) {
  if (Object.keys(req.query).some(key => !['page', 'pageSize'].includes(key))) throw new WorkflowError(400, 'VALIDATION_ERROR');
  const page = req.query.page === undefined ? 1 : id(req.query.page);
  const pageSize = req.query.pageSize === undefined ? 10 : id(req.query.pageSize);
  if (![10, 25, 50].includes(pageSize) || !Number.isSafeInteger((page - 1) * pageSize)) throw new WorkflowError(400, 'VALIDATION_ERROR');
  return { page, pageSize };
}
function fail(res: Response, error: unknown) {
  if (error instanceof ActionValidationError) return res.status(400).json({ error: { code: error.code, message: error.message, details: { fields: error.fields } } });
  if (error instanceof ActionTransitionError) return res.status(400).json({ error: { code: error.code, message: error.message } });
  if (error instanceof ActionReadOnlyError) return res.status(409).json({ error: { code: error.code, message: error.message } });
  if (error instanceof WorkflowError) return res.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } });
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
}
function writeAccess(req: Request) {
  if (!req.user || !['IT_STAFF', 'ADMINISTRATOR'].includes(req.user.role)) throw new WorkflowError(403, 'FORBIDDEN');
  const origin = req.get('Origin');
  if (origin) {
    try { const parsed = new URL(origin); if (!['http:', 'https:'].includes(parsed.protocol) || parsed.host !== req.get('Host')) throw new Error(); }
    catch { throw new WorkflowError(403, 'FORBIDDEN'); }
  }
  if (req.get('Sec-Fetch-Site') === 'cross-site') throw new WorkflowError(403, 'FORBIDDEN');
  if (Buffer.byteLength(JSON.stringify(req.body ?? null), 'utf8') > 32 * 1024) throw new WorkflowError(413, 'PAYLOAD_TOO_LARGE');
}
async function eligibleAssignee(tx: Prisma.TransactionClient, assigneeId: number) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${assigneeId} FOR SHARE`;
  return Boolean(await tx.user.findFirst({ where: { id: assigneeId, isActive: true, role: { in: ['IT_STAFF', 'ADMINISTRATOR'] } }, select: { id: true } }));
}
function writableParent(status: string) {
  if (['RESOLVED', 'CLOSED', 'CANCELLED'].includes(status)) throw new WorkflowError(409, 'ACTION_READ_ONLY');
}

router.use('/:id/actions', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

router.get('/:id/actions', async (req, res) => {
  try {
    const result = await withTicketTransaction(id(req.params.id), req.user!, undefined, async (tx, ticket) => {
      const { page, pageSize } = pagination(req);
      const where = { ticketId: ticket.id };
      const total = await tx.actionTaken.count({ where });
      const actions = await tx.actionTaken.findMany({ where, include: actionInclude, orderBy: [{ actionAt: 'asc' }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize });
      return { data: actions.map(dto), pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }, ticketVersion: ticket.version };
    });
    res.json(result);
  } catch (error) { fail(res, error); }
});

router.get('/:id/actions/:actionId', async (req, res) => {
  try {
    const result = await withTicketTransaction(id(req.params.id), req.user!, undefined, async (tx, ticket) => {
      if (Object.keys(req.query).length) throw new WorkflowError(400, 'VALIDATION_ERROR');
      const action = await tx.actionTaken.findFirst({ where: { id: id(req.params.actionId), ticketId: ticket.id }, include: actionInclude });
      if (!action) throw new WorkflowError(404, 'NOT_FOUND');
      return { data: dto(action), ticketVersion: ticket.version };
    });
    res.json(result);
  } catch (error) { fail(res, error); }
});

router.get('/:id/actions/:actionId/history', async (req, res) => {
  try {
    const result = await withTicketTransaction(id(req.params.id), req.user!, undefined, async (tx, ticket) => {
      const actionId = id(req.params.actionId);
      if (!await tx.actionTaken.findFirst({ where: { id: actionId, ticketId: ticket.id }, select: { id: true } })) throw new WorkflowError(404, 'NOT_FOUND');
      const { page, pageSize } = pagination(req);
      const total = await tx.actionRevision.count({ where: { actionId } });
      const data = await tx.actionRevision.findMany({ where: { actionId }, select: { id: true, actionId: true, version: true, eventType: true, editor: { select: actorSelect }, snapshot: true, createdAt: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize });
      return { data, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
    });
    res.json(result);
  } catch (error) { fail(res, error); }
});

router.post('/:id/actions', async (req, res) => {
  try {
    writeAccess(req);
    const operation = () => withTicketTransaction(id(req.params.id), req.user!, undefined, async (tx, ticket) => {
      const input = parseCreateAction(req.body, { actorId: req.user!.id, ticketCreatedAt: ticket.createdAt, now: new Date() });
      const key = validateIdempotencyKey(req.get('Idempotency-Key'));
      const fingerprint = actionFingerprint(input);
      const existing = await tx.actionTaken.findUnique({ where: { performedById_ticketId_idempotencyKey: { performedById: req.user!.id, ticketId: ticket.id, idempotencyKey: key } }, include: actionInclude });
      if (existing) {
        if (existing.requestFingerprint !== fingerprint) throw new WorkflowError(409, 'IDEMPOTENCY_CONFLICT');
        return { replay: true, data: dto(existing), ticketVersion: ticket.version };
      }
      if (ticket.version !== input.expectedTicketVersion) throw new WorkflowError(409, 'STALE_UPDATE', { currentTicketVersion: ticket.version });
      writableParent(ticket.currentStatus);
      if (!await eligibleAssignee(tx, input.assigneeId)) throw new WorkflowError(400, 'INVALID_ASSIGNEE');
      const { expectedTicketVersion: _version, ...business } = input;
      const action = await tx.actionTaken.create({ data: { ...business, ticketId: ticket.id, performedById: req.user!.id, updatedById: req.user!.id, idempotencyKey: key, requestFingerprint: fingerprint }, include: actionInclude });
      await tx.actionRevision.create({ data: { actionId: action.id, version: action.version, editorId: req.user!.id, eventType: 'CREATE', snapshot: snapshot(action) } });
      const parent = await tx.ticket.update({ where: { id: ticket.id }, data: { version: { increment: 1 } }, select: { version: true } });
      return { replay: false, data: dto(action), ticketVersion: parent.version };
    });
    let result;
    try { result = await operation(); }
    catch (error) {
      // Recover the committed winner if a duplicate request encountered the DB unique guard.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      result = await operation();
    }
    if (result.replay) res.set('Idempotency-Replayed', 'true');
    else res.location(`/api/tickets/${req.params.id}/actions/${result.data.id}`);
    res.status(result.replay ? 200 : 201).json({ data: result.data, ticketVersion: result.ticketVersion });
  } catch (error) { fail(res, error); }
});

router.patch('/:id/actions/:actionId', async (req, res) => {
  try {
    writeAccess(req);
    const result = await withTicketTransaction(id(req.params.id), req.user!, undefined, async (tx, ticket) => {
      const action = await tx.actionTaken.findFirst({ where: { id: id(req.params.actionId), ticketId: ticket.id } });
      if (!action) throw new WorkflowError(404, 'NOT_FOUND');
      const input = parseUpdateAction(req.body, { ...action, actionAt: action.actionAt.toISOString() }, { ticketCreatedAt: ticket.createdAt, now: new Date() });
      if (input.expectedTicketVersion !== ticket.version || input.expectedVersion !== action.version) {
        throw new WorkflowError(409, 'STALE_UPDATE', { currentTicketVersion: ticket.version, currentVersion: action.version });
      }
      writableParent(ticket.currentStatus);
      const cancellingExistingAssignee = input.status === 'CANCELLED' && input.assigneeId === action.assigneeId;
      if (!cancellingExistingAssignee && !await eligibleAssignee(tx, input.assigneeId)) throw new WorkflowError(400, 'INVALID_ASSIGNEE');
      const { expectedVersion: _actionVersion, expectedTicketVersion: _ticketVersion, ...business } = input;
      const updated = await tx.actionTaken.update({ where: { id: action.id }, data: { ...business, version: { increment: 1 }, updatedById: req.user!.id }, include: actionInclude });
      await tx.actionRevision.create({ data: { actionId: updated.id, version: updated.version, editorId: req.user!.id, eventType: updated.status !== action.status ? 'STATUS' : 'EDIT', snapshot: snapshot(updated) } });
      const parent = await tx.ticket.update({ where: { id: ticket.id }, data: { version: { increment: 1 } }, select: { version: true } });
      return { data: dto(updated), ticketVersion: parent.version };
    });
    res.json(result);
  } catch (error) { fail(res, error); }
});

export default router;
