import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Prisma, type TicketStatus, type UserRole } from '@prisma/client';
import app from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { signToken } from '../../src/lib/auth.js';

const database = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/invalid');
if (process.env.WORKFLOW_TEST_DATABASE !== 'isolated-runner'
  || !['127.0.0.1', 'localhost'].includes(database.hostname)
  || database.pathname !== '/workflow_test') throw new Error('Run npm run test:workflow-db against the isolated test cluster.');

// Date alone is frozen: network/timers and performance.now remain real.
const asOf = new Date('2026-11-01T17:00:00.000Z'); // 2 November midnight Bangkok.
const from = new Date('2026-10-26T17:00:00.000Z');
const inside = new Date('2026-10-30T05:00:00.000Z');
let owner: number; let empty: number; let other: number; let staff: number; let admin: number; let inactive: number; let passwordChange: number; let category: number;
let boundaryLower: number; let boundaryBefore: number; let boundaryUpper: number; let boundaryLast: number; let legacy: number;
const secret = 'PRIVATE_DESCRIPTION_INTERNAL_NOTE_PASSWORD';
const cookie = (id = owner, role: UserRole = 'REQUESTER') => `tkt_token=${signToken(id, role)}`;
async function makeUser(name: string, role: UserRole = 'REQUESTER', extra: Record<string, unknown> = {}) {
  return (await prisma.user.create({ data: { name, email: `${name}-${randomUUID()}@test.invalid`, role,
    passwordHash: secret, mustChangePassword: false, ...extra } })).id;
}
async function makeTicket(currentStatus: TicketStatus, updatedAt: Date, extra: Partial<Prisma.TicketUncheckedCreateInput> = {}) {
  return prisma.ticket.create({ data: { ticketNumber: `DASH-${randomUUID()}`, requesterId: owner, categoryId: category,
    summary: 'Safe dashboard fixture', description: secret, ticketOwnerId: staff,
    currentStatus, createdAt: new Date('2026-10-01T00:00:00Z'), ticketDate: new Date('2026-10-01T00:00:00Z'), updatedAt,
    ...extra } });
}
const dashboard = (identity = cookie()) => request(app).get('/api/dashboards/requester').set('Cookie', identity);

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(asOf);
  owner = await makeUser('dashboard-owner'); empty = await makeUser('dashboard-empty'); other = await makeUser('dashboard-other');
  staff = await makeUser('dashboard-staff', 'IT_STAFF'); admin = await makeUser('dashboard-admin', 'ADMINISTRATOR');
  inactive = await makeUser('dashboard-inactive', 'REQUESTER', { isActive: false });
  passwordChange = await makeUser('dashboard-password-change', 'REQUESTER', { mustChangePassword: true });
  category = (await prisma.category.create({ data: { name: `Dashboard-${randomUUID()}` } })).id;
  for (const status of ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED', 'CANCELLED'] as const) await makeTicket(status, inside);
  boundaryLower = (await makeTicket('RESOLVED', from, { resolvedAt: from })).id;
  boundaryBefore = (await makeTicket('RESOLVED', new Date(from.getTime() - 1), { resolvedAt: new Date(from.getTime() - 1) })).id;
  boundaryUpper = (await makeTicket('CLOSED', asOf, { resolvedAt: asOf })).id;
  boundaryLast = (await makeTicket('CLOSED', new Date(asOf.getTime() - 1), { resolvedAt: new Date(asOf.getTime() - 1) })).id;
  legacy = (await makeTicket('RESOLVED', inside, { resolvedAt: inside, resolutionTimeEstimated: true })).id;
  // Reopened tickets with a stale resolution timestamp cannot inflate resolved metrics.
  await makeTicket('REOPENED', inside, { resolvedAt: inside });
  for (let index = 0; index < 7; index++) await makeTicket('RESOLVED', inside, { resolvedAt: inside, summary: `Tie fixture ${index}` });
  await makeTicket('WAITING_FOR_REQUESTER', inside, { requesterId: other, summary: 'OTHER_ACCOUNT_TICKET' });
  const withPrivateNote = await makeTicket('OPEN', inside);
  await prisma.internalNote.create({ data: { ticketId: withPrivateNote.id, authorId: staff, content: secret } });
});
afterAll(async () => { vi.useRealTimers(); vi.restoreAllMocks(); await prisma.$disconnect(); });

describe('Real PostgreSQL requester dashboard', () => {
  it('reconciles every metric with independent SQL, preserving exact Bangkok boundaries', async () => {
    const response = await dashboard(); expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({ asOf: asOf.toISOString(), timeZone: 'Asia/Bangkok', window: { from: from.toISOString(), to: asOf.toISOString() } });
    const [sql] = await prisma.$queryRaw<Array<{ open: number; waiting: number; resolved: number; updated: number }>>`
      SELECT count(*) FILTER (WHERE "currentStatus" IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED'))::int AS open,
      count(*) FILTER (WHERE "currentStatus" = 'WAITING_FOR_REQUESTER')::int AS waiting,
      count(*) FILTER (WHERE "currentStatus" IN ('RESOLVED','CLOSED') AND "resolvedAt" >= ${from} AND "resolvedAt" < ${asOf})::int AS resolved,
      count(*) FILTER (WHERE "updatedAt" AT TIME ZONE 'UTC' >= ${from} AND "updatedAt" AT TIME ZONE 'UTC' < ${asOf})::int AS updated
      FROM "Ticket" WHERE "requesterId" = ${owner}`;
    expect(Object.fromEntries(Object.entries(response.body.metrics).map(([key, value]) => [key, (value as { count: number }).count])))
      .toEqual({ open: sql.open, waiting: sql.waiting, recentlyResolved: sql.resolved, recentlyUpdated: sql.updated });
  });

  it('reconciles drill-down totals with metrics, exact boundaries and estimated legacy resolution', async () => {
    const summary = await dashboard();
    for (const name of ['open', 'waiting', 'recentlyResolved', 'recentlyUpdated']) {
      const metric = summary.body.metrics[name];
      const list = await request(app).get(`/api${metric.href}&pageSize=50`).set('Cookie', cookie());
      expect(list.status).toBe(200); expect(list.headers['cache-control']).toBe('no-store'); expect(list.body.pagination.total).toBe(metric.count);
      expect(list.body.data.every((row: { requesterId: number }) => row.requesterId === owner)).toBe(true);
      if (name === 'recentlyResolved' || name === 'recentlyUpdated') {
        const ids = list.body.data.map((row: { id: number }) => row.id);
        expect(ids).toContain(boundaryLower); expect(ids).toContain(boundaryLast);
        expect(ids).not.toContain(boundaryBefore); expect(ids).not.toContain(boundaryUpper);
        expect(ids).toContain(legacy);
        expect(list.body.data.find((row: { id: number }) => row.id === legacy).resolutionTimeEstimated).toBe(true);
      }
    }
  });

  it('bounds both previews to five and sorts equal timestamps by descending ID using independent SQL', async () => {
    const response = await dashboard();
    const recent = await prisma.$queryRaw<Array<{ id: number }>>`SELECT id FROM "Ticket" WHERE "requesterId" = ${owner}
      AND "updatedAt" AT TIME ZONE 'UTC' >= ${from} AND "updatedAt" AT TIME ZONE 'UTC' < ${asOf}
      ORDER BY "updatedAt" DESC,id DESC LIMIT 5`;
    const resolved = await prisma.$queryRaw<Array<{ id: number }>>`SELECT id FROM "Ticket" WHERE "requesterId" = ${owner}
      AND "currentStatus" IN ('RESOLVED','CLOSED') AND "resolvedAt" >= ${from} AND "resolvedAt" < ${asOf}
      ORDER BY "resolvedAt" DESC,id DESC LIMIT 5`;
    expect(response.body.recentTickets.map((row: { id: number }) => row.id)).toEqual(recent.map(row => row.id));
    expect(response.body.recentResolvedTickets.map((row: { id: number }) => row.id)).toEqual(resolved.map(row => row.id));
    expect(response.body.recentTickets).toHaveLength(5); expect(response.body.recentResolvedTickets).toHaveLength(5);
    const allowed = ['id', 'ticketNumber', 'summary', 'currentStatus', 'itPriority', 'ticketOwner', 'updatedAt', 'resolvedAt', 'resolutionTimeEstimated', 'href'].sort();
    for (const row of [...response.body.recentTickets, ...response.body.recentResolvedTickets]) {
      expect(Object.keys(row).sort()).toEqual(allowed);
      expect(row.href).toBe(`/tickets/${row.id}`);
      if (row.ticketOwner) expect(Object.keys(row.ticketOwner).sort()).toEqual(['id', 'name']);
    }
    expect(JSON.stringify(response.body)).not.toContain(secret);
    expect(JSON.stringify(response.body)).not.toContain('OTHER_ACCOUNT_TICKET');
  });

  it('keeps empty accounts at zero and rejects role/session/account violations', async () => {
    const zero = await dashboard(cookie(empty)); expect(zero.status).toBe(200);
    expect(Object.values(zero.body.metrics).map(value => (value as { count: number }).count)).toEqual([0, 0, 0, 0]);
    expect(zero.body.recentTickets).toEqual([]); expect(zero.body.recentResolvedTickets).toEqual([]);
    expect((await request(app).get('/api/dashboards/requester')).status).toBe(401);
    expect((await dashboard(cookie(staff, 'IT_STAFF'))).status).toBe(403);
    expect((await dashboard(cookie(admin, 'ADMINISTRATOR'))).status).toBe(403);
    // Preserve the existing active-account guard's session-invalidating 401.
    expect((await dashboard(cookie(inactive))).status).toBe(401);
    expect((await dashboard(cookie(passwordChange))).status).toBe(403);
    const otherResponse = await dashboard(cookie(other));
    expect(otherResponse.body.metrics.open.count).toBe(1);
    expect(otherResponse.body.recentTickets.map((row: { summary: string }) => row.summary)).toEqual(['OTHER_ACCOUNT_TICKET']);
  });

  it.each(['requesterId=1', 'asOf=2026-11-01T00:00:00Z', 'from=2026-10-01T00:00:00Z', 'unknown=yes'])('rejects dashboard query override %s', async query => {
    const response = await request(app).get(`/api/dashboards/requester?${query}`).set('Cookie', cookie());
    expect(response.status).toBe(400); expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it.each([
    'dashboardFilter=unknown', 'dashboardFilter=open&dashboardFilter=waiting',
    'dashboardFilter=open&from=2026-10-01T00:00:00Z', 'dashboardFilter=waiting&to=2026-11-01T00:00:00Z',
    'dashboardFilter=recentlyResolved', 'dashboardFilter=recentlyUpdated&from=2026-10-01T00:00:00Z',
    'dashboardFilter=recentlyUpdated&from=2026-11-01T00:00:00Z&to=2026-10-01T00:00:00Z',
    'dashboardFilter=recentlyResolved&from=2026-02-30T00:00:00Z&to=2026-11-01T00:00:00Z',
    'dashboardFilter=recentlyResolved&from=2026-11-01T00:00:00&to=2026-11-02T00:00:00Z',
    'dashboardFilter=open&requesterId=999', 'from=2026-10-01T00:00:00Z',
    'dashboardFilter=open&unknown=1', 'dashboardFilter=open&search=a&search=b',
    'dashboardFilter=open&page=0', 'dashboardFilter=open&page=9007199254740992',
    'dashboardFilter=open&pageSize=11', 'dashboardFilter=open&status=INVALID',
    'dashboardFilter=open&priority=INVALID', 'dashboardFilter=open&categoryId=-1',
  ])('rejects malformed list drill-down %s', async query => {
    const response = await request(app).get(`/api/tickets?${query}`).set('Cookie', cookie());
    expect(response.status).toBe(400); expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('ANDs legacy search/category/status/priority with dashboard scope and preserves canonical recent sorts', async () => {
    const summary = await dashboard();
    const href = summary.body.metrics.recentlyResolved.href;
    const response = await request(app).get(`/api${href}&search=Tie%20fixture&categoryId=${category}&priority=MEDIUM&status=RESOLVED&sort=ticketNumber&order=asc&pageSize=50`).set('Cookie', cookie());
    expect(response.status).toBe(200); expect(response.body.pagination.total).toBe(7);
    const expected = await prisma.$queryRaw<Array<{ id: number }>>`SELECT id FROM "Ticket" WHERE "requesterId" = ${owner}
      AND summary LIKE 'Tie fixture%' AND "categoryId" = ${category} AND "requestedPriority" = 'MEDIUM'
      AND "currentStatus" = 'RESOLVED' AND "resolvedAt" >= ${from} AND "resolvedAt" < ${asOf}
      ORDER BY "resolvedAt" DESC,id DESC`;
    expect(response.body.data.map((row: { id: number }) => row.id)).toEqual(expected.map(row => row.id));
    const normal = await request(app).get('/api/tickets?sort=ticketNumber&order=asc&pageSize=50&requesterId=999').set('Cookie', cookie());
    expect(normal.status).toBe(200); expect(normal.body.data.every((row: { requesterId: number }) => row.requesterId === owner)).toBe(true);
    const numbers = normal.body.data.map((row: { ticketNumber: string }) => row.ticketNumber);
    expect(numbers).toEqual([...numbers].sort());
  });

  it('accepts the My Tickets recently-resolved canonical URL including resolvedAt sort', async () => {
    const summary = await dashboard();
    const href = summary.body.metrics.recentlyResolved.href;
    const response = await request(app).get(`/api${href}&sort=resolvedAt&order=desc&page=1&pageSize=10`).set('Cookie', cookie());
    expect(response.status).toBe(200); expect(response.body.pagination.total).toBe(summary.body.metrics.recentlyResolved.count);
    const expected = await prisma.$queryRaw<Array<{ id: number }>>`SELECT id FROM "Ticket" WHERE "requesterId" = ${owner}
      AND "currentStatus" IN ('RESOLVED','CLOSED') AND "resolvedAt" >= ${from} AND "resolvedAt" < ${asOf}
      ORDER BY "resolvedAt" DESC,id DESC LIMIT 10`;
    expect(response.body.data.map((row: { id: number }) => row.id)).toEqual(expected.map(row => row.id));
  });

  it('keeps one repeatable-read snapshot when another connection commits a matching ticket', async () => {
    const snapshotUser = await makeUser('dashboard-snapshot');
    const original = prisma.$transaction.bind(prisma);
    const spy = vi.spyOn(prisma, '$transaction');
    // Establish the transaction snapshot, then commit through a separate pool
    // connection before the route performs all its aggregate/list reads.
    spy.mockImplementation((callback: any, options: any) => original(async tx => {
      await tx.$queryRaw`SELECT count(*) FROM "Ticket"`;
      await makeTicket('WAITING_FOR_REQUESTER', inside, { requesterId: snapshotUser });
      return callback(tx);
    }, options) as any);
    try {
      const response = await dashboard(cookie(snapshotUser));
      expect(response.status).toBe(200); expect(response.body.metrics.open.count).toBe(0);
      expect(response.body.metrics.waiting.count).toBe(0); expect(response.body.recentTickets).toEqual([]);
      expect(spy.mock.calls[0][1]).toMatchObject({ isolationLevel: 'RepeatableRead' });
    } finally {
      // Prisma dynamically binds methods through a Proxy. Keep the original
      // bound implementation rather than deleting its synthesized descriptor.
      spy.mockImplementation(original as any);
    }
    const later = await dashboard(cookie(snapshotUser));
    expect(later.body.metrics.open.count).toBe(1); expect(later.body.metrics.waiting.count).toBe(1);
  });

  it('measures requester-only performance on 1000 tickets/3000 actions with bounded payloads', async () => {
    const perfUser = await makeUser('dashboard-performance');
    const prefix = `PERF-${randomUUID()}`;
    const states: TicketStatus[] = ['OPEN', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'CANCELLED'];
    await prisma.ticket.createMany({ data: Array.from({ length: 1000 }, (_, index) => ({
      ticketNumber: `${prefix}-${String(index).padStart(4, '0')}`, requesterId: perfUser, categoryId: category,
      summary: `Performance fixture ${index}`, description: secret, ticketOwnerId: staff,
      currentStatus: states[index % states.length], createdAt: new Date('2026-10-01T00:00:00Z'), ticketDate: new Date('2026-10-01T00:00:00Z'), updatedAt: inside,
      resolvedAt: ['RESOLVED', 'CLOSED'].includes(states[index % states.length]) ? inside : null,
    })) });
    const rows = await prisma.ticket.findMany({ where: { requesterId: perfUser }, select: { id: true, currentStatus: true } });
    await prisma.actionTaken.createMany({ data: rows.flatMap(row => Array.from({ length: 3 }, () => ({
      ticketId: row.id, actionAt: inside, description: 'Synthetic performance action', performedById: staff,
      assigneeId: staff, updatedById: staff, status: 'COMPLETED' as const, result: 'Completed synthetic fixture work',
      idempotencyKey: randomUUID(), requestFingerprint: 'performance-fixture',
    }))) });
    expect(await prisma.actionTaken.count({ where: { ticket: { requesterId: perfUser } } })).toBe(3000);
    const identity = cookie(perfUser);
    for (let warmup = 0; warmup < 5; warmup++) expect((await dashboard(identity)).status).toBe(200);
    const timings: number[] = []; let bytes = 0;
    for (let index = 0; index < 30; index++) {
      const start = performance.now(); const response = await dashboard(identity); timings.push(performance.now() - start);
      expect(response.status).toBe(200); bytes = Math.max(bytes, Buffer.byteLength(JSON.stringify(response.body)));
      expect(response.body.metrics.open.count).toBe(400); expect(response.body.metrics.waiting.count).toBe(200);
      expect(response.body.metrics.recentlyResolved.count).toBe(400); expect(response.body.metrics.recentlyUpdated.count).toBe(1000);
      expect(response.body.recentTickets).toHaveLength(5); expect(response.body.recentResolvedTickets).toHaveLength(5);
    }
    timings.sort((a, b) => a - b);
    const p50 = timings[14]; const p95 = timings[28];
    console.log(`Requester dashboard performance: PostgreSQL16, 1000 tickets/3000 actions, 5 warmups/30 measurements, p50=${p50.toFixed(2)}ms p95=${p95.toFixed(2)}ms maxPayload=${bytes} bytes; staff endpoint not measured.`);
    expect(p95).toBeLessThanOrEqual(1000); expect(bytes).toBeLessThanOrEqual(100 * 1024);
  });
});
