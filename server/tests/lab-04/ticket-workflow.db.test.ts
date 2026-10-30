import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ActionStatus, TicketStatus, UserRole } from '@prisma/client';
import app from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { signToken } from '../../src/lib/auth.js';

// A real database is mandatory; direct invocation without the disposable runner
// fails instead of skipping assertions or touching the configured application DB.
const database = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/invalid');
if (process.env.WORKFLOW_TEST_DATABASE !== 'isolated-runner'
  || !['127.0.0.1', 'localhost'].includes(database.hostname)
  || database.pathname !== '/workflow_test') throw new Error('Run npm run test:workflow-db against the isolated test cluster.');

let staff: number; let otherStaff: number; let requester: number; let otherRequester: number; let inactive: number; let category: number;
const since = new Date('2026-10-01T00:00:00Z');
beforeAll(async () => {
  const suffix = randomUUID();
  const makeUser = async (name: string, role: UserRole, isActive = true) => (await prisma.user.create({ data: {
    name, email: `${name}-${suffix}@test.invalid`, role, isActive, mustChangePassword: false, passwordHash: 'synthetic-token-only-fixture',
  } })).id;
  staff = await makeUser('workflow-staff', 'IT_STAFF');
  otherStaff = await makeUser('workflow-other-staff', 'ADMINISTRATOR');
  requester = await makeUser('workflow-requester', 'REQUESTER');
  otherRequester = await makeUser('workflow-other-requester', 'REQUESTER');
  inactive = await makeUser('workflow-inactive', 'IT_STAFF', false);
  category = (await prisma.category.create({ data: { name: `Workflow-${suffix}` } })).id;
});
afterAll(async () => { await prisma.$disconnect(); });
function cookie(id = staff, role: UserRole = 'IT_STAFF') { return `tkt_token=${signToken(id, role)}`; }
async function ticket(status: TicketStatus = 'IN_PROGRESS', owner: number | null = staff) {
  return prisma.ticket.create({ data: {
    ticketNumber: `WF-${randomUUID()}`, requesterId: requester, categoryId: category, summary: 'Workflow fixture', description: 'Synthetic test data',
    ticketOwnerId: owner, currentStatus: status, createdAt: since, ticketDate: since,
  } });
}
async function storedAction(ticketId: number, status: ActionStatus = 'COMPLETED', values: Record<string, unknown> = {}) {
  return prisma.actionTaken.create({ data: {
    ticketId, performedById: staff, assigneeId: staff, updatedById: staff,
    actionAt: since, description: 'Completed fixture work', status,
    result: status === 'COMPLETED' ? 'Verified service restored' : null,
    idempotencyKey: randomUUID(), requestFingerprint: 'fixture-only',
    createdAt: since, ...values,
  } });
}
async function statusChange(id: number, status: TicketStatus, identity = cookie()) {
  const current = await prisma.ticket.findUniqueOrThrow({ where: { id } });
  return request(app).patch(`/api/tickets/${id}/status`).set('Cookie', identity).send({ status, expectedVersion: current.version });
}
function createBody(version: number, extra: Record<string, unknown> = {}) {
  return { expectedTicketVersion: version, actionAt: new Date().toISOString(), description: 'Inspect network adapter', followUpRequired: false, ...extra };
}
async function createWork(id: number, extra: Record<string, unknown> = {}, key = randomUUID()) {
  const current = await prisma.ticket.findUniqueOrThrow({ where: { id } });
  return request(app).post(`/api/tickets/${id}/actions`).set('Cookie', cookie()).set('Idempotency-Key', key).send(createBody(current.version, extra));
}

describe('Real PostgreSQL ticket workflow', () => {
  it('rejects cross-site mutations but accepts the preserved same-origin Host', async () => {
    const row = await ticket('OPEN');
    const denied = await request(app).patch(`/api/tickets/${row.id}/status`).set('Cookie', cookie())
      .set('Host', 'desk.test').set('Origin', 'https://untrusted.test').send({ status: 'IN_PROGRESS', expectedVersion: 1 });
    expect(denied.status).toBe(403);
    expect(await prisma.ticketWorkflowEvent.count({ where: { ticketId: row.id } })).toBe(0);
    const accepted = await request(app).patch(`/api/tickets/${row.id}/status`).set('Cookie', cookie())
      .set('Host', 'desk.test').set('Origin', 'https://desk.test').send({ status: 'IN_PROGRESS', expectedVersion: 1 });
    expect(accepted.status).toBe(200);
    expect(accepted.body.version).toBe(2);
  });
  it('requires a version and rejects stale updates without changing ticket/history', async () => {
    const row = await ticket('OPEN');
    const missing = await request(app).patch(`/api/tickets/${row.id}/status`).set('Cookie', cookie()).send({ status: 'IN_PROGRESS' });
    expect(missing.status).toBe(400);
    const stale = await request(app).patch(`/api/tickets/${row.id}/status`).set('Cookie', cookie()).send({ status: 'IN_PROGRESS', expectedVersion: 99 });
    expect(stale.status).toBe(409); expect(stale.body.error.code).toBe('STALE_UPDATE');
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: row.id } })).version).toBe(1);
    expect(await prisma.ticketWorkflowEvent.count({ where: { ticketId: row.id } })).toBe(0);
  });

  it('enforces invalid matrix edges and requester formal-resolution authority', async () => {
    const row = await ticket('NEW');
    expect((await statusChange(row.id, 'RESOLVED')).status).toBe(400);
    const forbidden = await statusChange(row.id, 'RESOLVED', cookie(requester, 'REQUESTER'));
    expect(forbidden.status).toBe(403);
    expect(await prisma.ticketWorkflowEvent.count({ where: { ticketId: row.id } })).toBe(0);
  });

  it.each([
    ['OWNER_REQUIRED', null, 'COMPLETED', false],
    ['OWNER_INACTIVE', 'inactive', 'COMPLETED', false],
    ['NO_COMPLETED_ACTION', 'staff', 'none', false],
    ['OPEN_ACTIONS', 'staff', 'PLANNED', false],
    ['FOLLOW_UP_OUTSTANDING', 'staff', 'PLANNED', true],
  ] as const)('blocks resolution for %s with zero writes', async (reason, owner, actionStatus, followUp) => {
    const row = await ticket('IN_PROGRESS', owner === null ? null : owner === 'inactive' ? inactive : staff);
    if (actionStatus !== 'none') await storedAction(row.id, actionStatus, { followUpRequired: followUp, followUpNote: followUp ? 'Outstanding work' : null });
    if (followUp) await storedAction(row.id);
    const response = await statusChange(row.id, 'RESOLVED');
    expect(response.status).toBe(409); expect(response.body.error.code).toBe('RESOLUTION_BLOCKED');
    expect(response.body.error.details.reasons).toContain(reason);
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.currentStatus).toBe('IN_PROGRESS'); expect(after.version).toBe(1); expect(after.resolvedAt).toBeNull();
    expect(await prisma.ticketWorkflowEvent.count({ where: { ticketId: row.id } })).toBe(0);
  });

  it('resolves only with completed work, preserves timestamp on close, and never counts cancelled follow-up', async () => {
    const row = await ticket();
    await storedAction(row.id);
    await storedAction(row.id, 'CANCELLED', { followUpRequired: true, followUpNote: 'Cancelled work', cancellationReason: 'No longer needed' });
    const resolved = await statusChange(row.id, 'RESOLVED');
    expect(resolved.status).toBe(200); expect(resolved.body.resolvedAt).toBeTruthy();
    const closed = await statusChange(row.id, 'CLOSED');
    expect(closed.status).toBe(200); expect(closed.body.resolvedAt).toBe(resolved.body.resolvedAt);
    expect((await prisma.ticketWorkflowEvent.findMany({ where: { ticketId: row.id } })).map(event => event.kind)).toEqual(['STATUS', 'STATUS']);
  });

  it('allows legacy resolution to close without fabricating action/history records', async () => {
    const row = await ticket('RESOLVED');
    await prisma.ticket.update({ where: { id: row.id }, data: { resolvedAt: since, resolutionTimeEstimated: true } });
    expect((await statusChange(row.id, 'CLOSED')).status).toBe(200);
    expect(await prisma.actionTaken.count({ where: { ticketId: row.id } })).toBe(0);
    expect(await prisma.ticketWorkflowEvent.count({ where: { ticketId: row.id } })).toBe(1);
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.resolvedAt).toEqual(since); expect(after.resolutionTimeEstimated).toBe(true);
  });

  it('allows only the owning requester to reopen and requires fresh completed work', async () => {
    const row = await ticket('RESOLVED'); await storedAction(row.id);
    await prisma.ticket.update({ where: { id: row.id }, data: { resolvedAt: since, resolutionTimeEstimated: true } });
    expect((await statusChange(row.id, 'REOPENED', cookie(otherRequester, 'REQUESTER'))).status).toBe(403);
    const reopened = await statusChange(row.id, 'REOPENED', cookie(requester, 'REQUESTER'));
    expect(reopened.status).toBe(200); expect(reopened.body.resolvedAt).toBeNull(); expect(reopened.body.reopenedAt).toBeTruthy();
    expect(reopened.body.resolutionTimeEstimated).toBe(false);
    expect((await statusChange(row.id, 'IN_PROGRESS')).status).toBe(200);
    const blocked = await statusChange(row.id, 'RESOLVED');
    expect(blocked.status).toBe(409); expect(blocked.body.error.details.reasons).toContain('FRESH_WORK_REQUIRED');
    const created = await createWork(row.id); expect(created.status).toBe(201);
    const started = await request(app).patch(`/api/tickets/${row.id}/actions/${created.body.data.id}`).set('Cookie', cookie()).send({ expectedVersion: 1, expectedTicketVersion: created.body.ticketVersion, status: 'IN_PROGRESS' });
    expect(started.status).toBe(200);
    const completed = await request(app).patch(`/api/tickets/${row.id}/actions/${created.body.data.id}`).set('Cookie', cookie()).send({ expectedVersion: 2, expectedTicketVersion: started.body.ticketVersion, status: 'COMPLETED', result: 'Fresh verification passed' });
    expect(completed.status).toBe(200);
    expect((await statusChange(row.id, 'RESOLVED')).status).toBe(200);
  });

  it('blocks cancellation while active actions exist without cascading their status', async () => {
    const row = await ticket('OPEN'); const action = await storedAction(row.id, 'PLANNED');
    const response = await statusChange(row.id, 'CANCELLED');
    expect(response.status).toBe(409); expect(response.body.error.code).toBe('CANCELLATION_BLOCKED');
    expect((await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } })).status).toBe('PLANNED');
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: row.id } })).version).toBe(1);
  });

  it('writes owner/priority/advisory events atomically and exposes only shared history', async () => {
    const row = await ticket('OPEN');
    const owner = await request(app).patch(`/api/tickets/${row.id}/owner`).set('Cookie', cookie()).send({ ownerId: otherStaff, expectedVersion: 1 });
    expect(owner.status).toBe(200); expect(owner.body.version).toBe(2);
    const priority = await request(app).patch(`/api/tickets/${row.id}/it-priority`).set('Cookie', cookie()).send({ itPriority: 'HIGH', expectedVersion: 2 });
    expect(priority.status).toBe(200); expect(priority.body.version).toBe(3);
    const advisory = await request(app).post(`/api/tickets/${row.id}/requester-resolved`).set('Cookie', cookie(requester, 'REQUESTER')).send({ expectedVersion: 3 });
    expect(advisory.status).toBe(200); expect(advisory.body.version).toBe(4);
    const repeat = await request(app).post(`/api/tickets/${row.id}/requester-resolved`).set('Cookie', cookie(requester, 'REQUESTER')).send({ expectedVersion: 4 });
    expect(repeat.status).toBe(409); expect(repeat.body.error.code).toBe('ALREADY_RESOLVED');
    await prisma.internalNote.create({ data: { ticketId: row.id, authorId: staff, content: 'Private sentinel must never leak' } });
    const history = await request(app).get(`/api/tickets/${row.id}/history`).set('Cookie', cookie(requester, 'REQUESTER'));
    expect(history.status).toBe(200); expect(history.body.data.map((event: { kind: string }) => event.kind)).toEqual(['OWNER', 'PRIORITY', 'REQUESTER_INDICATION']);
    expect(history.body.data.map((event: { id: number }) => event.id)).toEqual([...history.body.data.map((event: { id: number }) => event.id)].sort((a, b) => a - b));
    const serialized = JSON.stringify(history.body); expect(serialized).not.toContain('Private sentinel'); expect(serialized).not.toContain('passwordHash');
    expect((await request(app).get(`/api/tickets/${row.id}/history`).set('Cookie', cookie(otherRequester, 'REQUESTER'))).status).toBe(403);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: row.id } })).currentStatus).toBe('OPEN');
  });

  it('serializes racing same-version workflow writes into one event', async () => {
    const row = await ticket('OPEN');
    const responses = await Promise.all([
      request(app).patch(`/api/tickets/${row.id}/it-priority`).set('Cookie', cookie()).send({ itPriority: 'HIGH', expectedVersion: 1 }),
      request(app).patch(`/api/tickets/${row.id}/it-priority`).set('Cookie', cookie()).send({ itPriority: 'LOW', expectedVersion: 1 }),
    ]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: row.id } })).version).toBe(2);
    expect(await prisma.ticketWorkflowEvent.count({ where: { ticketId: row.id } })).toBe(1);
  });

  it('rolls back the ticket/version when audit append fails', async () => {
    const row = await ticket('OPEN');
    await prisma.$executeRawUnsafe(`CREATE FUNCTION workflow_test_reject_event() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'synthetic audit rejection'; END; $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER workflow_test_reject_event BEFORE INSERT ON "TicketWorkflowEvent" FOR EACH ROW EXECUTE FUNCTION workflow_test_reject_event()`);
    try {
      const response = await request(app).patch(`/api/tickets/${row.id}/owner`).set('Cookie', cookie()).send({ ownerId: otherStaff, expectedVersion: 1 });
      expect(response.status).toBe(500);
      const after = await prisma.ticket.findUniqueOrThrow({ where: { id: row.id } });
      expect(after.ticketOwnerId).toBe(staff); expect(after.version).toBe(1);
      expect(await prisma.ticketWorkflowEvent.count({ where: { ticketId: row.id } })).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER workflow_test_reject_event ON "TicketWorkflowEvent"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION workflow_test_reject_event()`);
    }
  });
});

describe('Real PostgreSQL Actions Taken prerequisite and race boundary', () => {
  it('persists attribution, assignment, revision and shared owned visibility', async () => {
    const row = await ticket();
    const created = await createWork(row.id, { assigneeId: otherStaff, followUpRequired: true, followUpNote: 'Confirm requester availability' });
    expect(created.status).toBe(201); expect(created.body.ticketVersion).toBe(2);
    expect(created.body.data.performedBy.id).toBe(staff); expect(created.body.data.assignee.id).toBe(otherStaff);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: row.id } })).ticketOwnerId).toBe(staff);
    expect(await prisma.actionRevision.count({ where: { actionId: created.body.data.id } })).toBe(1);
    const owned = await request(app).get(`/api/tickets/${row.id}/actions`).set('Cookie', cookie(requester, 'REQUESTER'));
    expect(owned.status).toBe(200); expect(owned.body.data).toHaveLength(1);
    expect(owned.headers['cache-control']).toContain('no-store');
    expect((await request(app).get(`/api/tickets/${row.id}/actions`).set('Cookie', cookie(otherRequester, 'REQUESTER'))).status).toBe(403);
    expect((await request(app).post(`/api/tickets/${row.id}/actions`).set('Cookie', cookie(requester, 'REQUESTER')).send({})).status).toBe(403);
  });

  it('rejects inactive assignee and forged performer with no action/revision/version change', async () => {
    const row = await ticket();
    expect((await createWork(row.id, { assigneeId: inactive })).status).toBe(400);
    expect((await createWork(row.id, { performedById: otherStaff })).status).toBe(400);
    expect(await prisma.actionTaken.count({ where: { ticketId: row.id } })).toBe(0);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: row.id } })).version).toBe(1);
  });

  it('serializes duplicate creations, excludes expected version from replay identity, and rejects changed intent', async () => {
    const row = await ticket(); const key = randomUUID(); const body = createBody(1);
    const send = (payload = body) => request(app).post(`/api/tickets/${row.id}/actions`).set('Cookie', cookie()).set('Idempotency-Key', key).send(payload);
    const responses = await Promise.all([send(), send()]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 201]);
    expect(responses[0].body.data.id).toBe(responses[1].body.data.id);
    expect(await prisma.actionTaken.count({ where: { ticketId: row.id } })).toBe(1);
    expect(await prisma.actionRevision.count({ where: { actionId: responses[0].body.data.id } })).toBe(1);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: row.id } })).version).toBe(2);
    const replay = await send({ ...body, expectedTicketVersion: 77 });
    expect(replay.status).toBe(200); expect(replay.headers['idempotency-replayed']).toBe('true');
    const conflict = await send({ ...body, description: 'Different intent' });
    expect(conflict.status).toBe(409); expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('appends action revision atomically, enforces stale action version and wrong parent', async () => {
    const row = await ticket(); const unrelated = await ticket(); const created = await createWork(row.id);
    const id = created.body.data.id;
    const edited = await request(app).patch(`/api/tickets/${row.id}/actions/${id}`).set('Cookie', cookie()).send({ expectedVersion: 1, expectedTicketVersion: 2, description: 'Updated diagnostic', status: 'IN_PROGRESS' });
    expect(edited.status).toBe(200); expect(edited.body.data.version).toBe(2); expect(edited.body.ticketVersion).toBe(3);
    const stale = await request(app).patch(`/api/tickets/${row.id}/actions/${id}`).set('Cookie', cookie()).send({ expectedVersion: 1, expectedTicketVersion: 3, description: 'Stale overwrite' });
    expect(stale.status).toBe(409);
    const wrong = await request(app).get(`/api/tickets/${unrelated.id}/actions/${id}`).set('Cookie', cookie());
    expect(wrong.status).toBe(404);
    const history = await request(app).get(`/api/tickets/${row.id}/actions/${id}/history`).set('Cookie', cookie(requester, 'REQUESTER'));
    expect(history.status).toBe(200); expect(history.body.data.map((revision: { version: number }) => revision.version)).toEqual([1, 2]);
    expect(history.body.data[0].snapshot.description).toBe('Inspect network adapter');
    expect(history.body.data[1].snapshot.description).toBe('Updated diagnostic');
    expect((await prisma.actionTaken.findUniqueOrThrow({ where: { id } })).description).toBe('Updated diagnostic');
  });

  it('rejects every mutation on terminal actions and terminal parent tickets', async () => {
    const row = await ticket(); const completed = await storedAction(row.id);
    const response = await request(app).patch(`/api/tickets/${row.id}/actions/${completed.id}`).set('Cookie', cookie()).send({ expectedVersion: 1, expectedTicketVersion: 1, description: 'Forbidden terminal edit' });
    expect(response.status).toBe(409); expect(response.body.error.code).toBe('ACTION_READ_ONLY');
    expect((await statusChange(row.id, 'RESOLVED')).status).toBe(200);
    const terminal = await createWork(row.id); expect(terminal.status).toBe(409); expect(terminal.body.error.code).toBe('ACTION_READ_ONLY');
  });

  it('enforces append-only revision and workflow history at the database boundary', async () => {
    const row = await ticket(); const created = await createWork(row.id);
    const revision = await prisma.actionRevision.findFirstOrThrow({ where: { actionId: created.body.data.id } });
    await expect(prisma.actionRevision.update({ where: { id: revision.id }, data: { snapshot: { description: 'Illegal overwrite' } } })).rejects.toThrow('append-only');
    await expect(prisma.actionRevision.delete({ where: { id: revision.id } })).rejects.toThrow('append-only');
    const updated = await request(app).patch(`/api/tickets/${row.id}/it-priority`).set('Cookie', cookie()).send({ itPriority: 'HIGH', expectedVersion: created.body.ticketVersion });
    expect(updated.status).toBe(200);
    const event = await prisma.ticketWorkflowEvent.findFirstOrThrow({ where: { ticketId: row.id } });
    await expect(prisma.ticketWorkflowEvent.update({ where: { id: event.id }, data: { after: { itPriority: 'LOW' } } })).rejects.toThrow('append-only');
    await expect(prisma.ticketWorkflowEvent.delete({ where: { id: event.id } })).rejects.toThrow('append-only');
    expect(await prisma.actionRevision.count({ where: { actionId: created.body.data.id } })).toBe(1);
    expect(await prisma.ticketWorkflowEvent.count({ where: { ticketId: row.id } })).toBe(1);
  });

  it('uses stable tied-date ordering and rejects invalid pagination rather than silently changing it', async () => {
    const row = await ticket(); const first = await createWork(row.id, { actionAt: '2026-10-02T01:00:00Z' });
    const second = await createWork(row.id, { actionAt: '2026-10-02T01:00:00Z' });
    const response = await request(app).get(`/api/tickets/${row.id}/actions?page=1&pageSize=10`).set('Cookie', cookie(requester, 'REQUESTER'));
    expect(response.status).toBe(200);
    expect(response.body.data.map((action: { id: number }) => action.id)).toEqual([first.body.data.id, second.body.data.id]);
    expect((await request(app).get(`/api/tickets/${row.id}/actions?pageSize=2`).set('Cookie', cookie())).status).toBe(400);
    expect((await request(app).get(`/api/tickets/${row.id}/history?page=0`).set('Cookie', cookie())).status).toBe(400);
    expect((await request(app).get(`/api/tickets/${row.id}/history?requesterId=${otherRequester}`).set('Cookie', cookie())).status).toBe(400);
  });

  it('cannot resolve concurrently with newly created open work', async () => {
    const row = await ticket(); await storedAction(row.id); const body = createBody(1);
    const responses = await Promise.all([
      request(app).patch(`/api/tickets/${row.id}/status`).set('Cookie', cookie()).send({ status: 'RESOLVED', expectedVersion: 1 }),
      request(app).post(`/api/tickets/${row.id}/actions`).set('Cookie', cookie()).set('Idempotency-Key', randomUUID()).send(body),
    ]);
    expect(responses.filter(response => response.status < 300)).toHaveLength(1);
    expect(responses.filter(response => response.status === 409)).toHaveLength(1);
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: row.id } });
    const activeCount = await prisma.actionTaken.count({ where: { ticketId: row.id, status: { in: ['PLANNED', 'IN_PROGRESS'] } } });
    expect(after.currentStatus === 'RESOLVED' && activeCount > 0).toBe(false);
    expect(after.version).toBe(2);
  });
});
