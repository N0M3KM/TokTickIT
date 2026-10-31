import { randomUUID, randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient, type Priority, type TicketStatus, type ActionStatus, type UserRole } from '@prisma/client';
import app from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { signToken } from '../../src/lib/auth.js';

const database = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/invalid');
if (process.env.WORKFLOW_TEST_DATABASE !== 'isolated-runner' || !['127.0.0.1', 'localhost'].includes(database.hostname)
  || database.pathname !== '/workflow_test') throw new Error('Use npm run test:workflow-db with the isolated cluster.');
const now = new Date('2026-11-01T17:00:00Z'); const from = new Date('2026-10-26T17:00:00Z');
const inside = new Date('2026-10-30T05:00:00Z'); const created = new Date('2026-10-01T00:00:00Z');
const secret = 'STAFF_PRIVATE_NOTE_PASSWORD_ATTACHMENT';
let staff: number; let admin: number; let colleague: number; let emptyStaff: number; let requester: number; let inactive: number; let category: number;
let firstParent: number; let secondParent: number; let lower: number; let before: number; let last: number; let upper: number;
const cookie = (id = staff, role: UserRole = 'IT_STAFF') => `tkt_token=${signToken(id, role)}`;
const dashboard = (identity = cookie()) => request(app).get('/api/dashboards/staff').set('Cookie', identity);
async function user(name: string, role: UserRole, active = true) {
  return (await prisma.user.create({ data: { name, email: `${name}-${randomUUID()}@test.invalid`, role, isActive: active,
    mustChangePassword: false, passwordHash: secret } })).id;
}
async function ticket(status: TicketStatus = 'OPEN', owner: number | null = colleague, updatedAt = inside, priority: Priority = 'MEDIUM') {
  return prisma.ticket.create({ data: { ticketNumber: `STAFF-${randomUUID()}`, requesterId: requester, categoryId: category,
    ticketOwnerId: owner, summary: 'Staff safe fixture', description: secret, currentStatus: status, itPriority: priority,
    createdAt: created, ticketDate: created, updatedAt } });
}
async function action(ticketId: number, assigneeId = staff, status: ActionStatus = 'PLANNED', performedById = colleague, description = 'Shared work') {
  return prisma.actionTaken.create({ data: { ticketId, assigneeId, status, performedById, updatedById: performedById,
    description, actionAt: inside, result: status === 'COMPLETED' ? 'Done' : null,
    cancellationReason: status === 'CANCELLED' ? 'Obsolete' : null,
    idempotencyKey: randomUUID(), requestFingerprint: 'isolated-staff-fixture' } });
}
beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now);
  staff = await user('staff-dashboard-current', 'IT_STAFF'); admin = await user('staff-dashboard-admin', 'ADMINISTRATOR');
  colleague = await user('staff-dashboard-colleague', 'IT_STAFF'); emptyStaff = await user('staff-dashboard-empty', 'IT_STAFF');
  requester = await user('staff-dashboard-requester', 'REQUESTER'); inactive = await user('staff-dashboard-inactive', 'IT_STAFF', false);
  category = (await prisma.category.create({ data: { name: `Staff-${randomUUID()}` } })).id;
  firstParent = (await ticket('OPEN', colleague, inside, 'LOW')).id;
  await action(firstParent, staff, 'PLANNED', inactive, '😀'.repeat(130));
  await action(firstParent, staff, 'IN_PROGRESS');
  for (let index = 0; index < 4; index++) await action(firstParent);
  secondParent = (await ticket('WAITING_FOR_REQUESTER', null, inside, 'HIGH')).id;
  await action(secondParent);
  const mine = await ticket('IN_PROGRESS', staff, inside, 'CRITICAL');
  await action(mine.id, colleague, 'PLANNED', staff); // creator/owner must not imply assignment.
  const terminal = await ticket('CLOSED', staff); await action(terminal.id); // historical active child is excluded.
  await action(firstParent, staff, 'COMPLETED'); await action(firstParent, staff, 'CANCELLED');
  const administrative = await ticket('OPEN', admin); await action(administrative.id, admin);
  for (const status of ['NEW', 'RESOLVED', 'REOPENED', 'CANCELLED'] as const) await ticket(status);
  lower = (await ticket('OPEN', null, from)).id; before = (await ticket('OPEN', null, new Date(from.getTime() - 1))).id;
  last = (await ticket('OPEN', null, new Date(now.getTime() - 1))).id; upper = (await ticket('OPEN', null, now)).id;
  await prisma.internalNote.create({ data: { ticketId: firstParent, authorId: staff, content: secret } });
});
afterAll(async () => { vi.useRealTimers(); vi.restoreAllMocks(); await prisma.$disconnect(); });

describe('Real PostgreSQL staff/admin dashboard', () => {
  it('reconciles all metrics and every bucket with independent SQL without join inflation', async () => {
    const response = await dashboard(); expect(response.status).toBe(200); expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.window).toEqual({ from: from.toISOString(), to: now.toISOString() });
    const [counts] = await prisma.$queryRaw<Array<{ unassigned: number; owned: number; recent: number }>>`SELECT
      count(*) FILTER (WHERE "currentStatus" IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED') AND "ticketOwnerId" IS NULL)::int unassigned,
      count(*) FILTER (WHERE "currentStatus" IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED') AND "ticketOwnerId"=${staff})::int owned,
      count(*) FILTER (WHERE "updatedAt" AT TIME ZONE 'UTC'>=${from} AND "updatedAt" AT TIME ZONE 'UTC'<${now})::int recent FROM "Ticket"`;
    expect(response.body.metrics.unassigned.count).toBe(counts.unassigned); expect(response.body.metrics.ownedByMe.count).toBe(counts.owned);
    expect(response.body.metrics.recentlyUpdated.count).toBe(counts.recent);
    const statuses = await prisma.$queryRaw<Array<{ status: string; count: number }>>`SELECT "currentStatus"::text status,count(*)::int count FROM "Ticket" GROUP BY "currentStatus"`;
    const priorities = await prisma.$queryRaw<Array<{ priority: string; count: number }>>`SELECT "itPriority"::text priority,count(*)::int count FROM "Ticket"
      WHERE "currentStatus" IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED') GROUP BY "itPriority"`;
    expect(response.body.metrics.byStatus.map((row: { status: string }) => row.status)).toEqual(['NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','RESOLVED','CLOSED','REOPENED','CANCELLED']);
    expect(response.body.metrics.byPriority.map((row: { itPriority: string }) => row.itPriority)).toEqual(['LOW','MEDIUM','HIGH','CRITICAL']);
    for (const row of response.body.metrics.byStatus) expect(row.count).toBe(statuses.find(value => value.status === row.status)?.count ?? 0);
    for (const row of response.body.metrics.byPriority) expect(row.count).toBe(priorities.find(value => value.priority === row.itPriority)?.count ?? 0);
    const [actions] = await prisma.$queryRaw<Array<{ actions: number; tickets: number }>>`SELECT count(*)::int actions,count(DISTINCT a."ticketId")::int tickets
      FROM "ActionTaken" a JOIN "Ticket" t ON t.id=a."ticketId" WHERE a."assigneeId"=${staff} AND a.status IN ('PLANNED','IN_PROGRESS')
      AND t."currentStatus" IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED')`;
    expect(response.body.myActions.actionCount).toBe(actions.actions); expect(response.body.myActions.ticketCount).toBe(actions.tickets);
    expect(actions).toEqual({ actions: 7, tickets: 2 });
  });

  it('uses current administrator identity for mine while retaining identical global staff scope', async () => {
    const staffResponse = await dashboard(); const response = await dashboard(cookie(admin, 'ADMINISTRATOR'));
    expect(response.status).toBe(200); expect(response.body.metrics.byStatus).toEqual(staffResponse.body.metrics.byStatus);
    expect(response.body.metrics.byPriority).toEqual(staffResponse.body.metrics.byPriority);
    expect(response.body.metrics.unassigned).toEqual(staffResponse.body.metrics.unassigned);
    expect(response.body.myActions.actionCount).toBe(1); expect(response.body.myActions.ticketCount).toBe(1);
    expect(response.body.metrics.ownedByMe.count).toBe(1);
    const emptyResponse = await dashboard(cookie(emptyStaff));
    expect(emptyResponse.body.myActions).toMatchObject({ actionCount: 0, ticketCount: 0, items: [] });
    expect(emptyResponse.body.metrics.ownedByMe.count).toBe(0);
  });

  it('returns bounded public previews in stable order, including inactive historical performer work', async () => {
    const response = await dashboard();
    const expected = await prisma.$queryRaw<Array<{ id: number }>>`SELECT a.id FROM "ActionTaken" a JOIN "Ticket" t ON t.id=a."ticketId"
      WHERE a."assigneeId"=${staff} AND a.status IN ('PLANNED','IN_PROGRESS') AND t."currentStatus" IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED')
      ORDER BY a."actionAt" ASC,a.id ASC LIMIT 5`;
    expect(response.body.myActions.items.map((row: { id: number }) => row.id)).toEqual(expected.map(row => row.id));
    expect(response.body.myActions.items).toHaveLength(5); expect(response.body.recentTickets).toHaveLength(5);
    expect(Array.from(response.body.myActions.items[0].description)).toHaveLength(120);
    for (const row of response.body.myActions.items) {
      expect(Object.keys(row).sort()).toEqual(['id','ticketId','ticketNumber','description','status','actionAt','followUpRequired','href'].sort());
      expect(row.href).toBe(`/tickets/${row.ticketId}#action-${row.id}`);
    }
    for (const row of response.body.recentTickets) expect(Object.keys(row).sort()).toEqual(['id','ticketNumber','summary','currentStatus','itPriority','ticketOwner','updatedAt','resolvedAt','resolutionTimeEstimated','href'].sort());
    expect(JSON.stringify(response.body)).not.toContain(secret);
  });

  it('makes every dashboard link total agree with the queue and includes only correct recent bounds', async () => {
    const summary = await dashboard();
    const links = [summary.body.metrics.unassigned, summary.body.metrics.ownedByMe, summary.body.metrics.recentlyUpdated,
      ...summary.body.metrics.byStatus, ...summary.body.metrics.byPriority,
      { href: summary.body.myActions.href, count: summary.body.myActions.ticketCount }];
    for (const link of links) {
      const response = await request(app).get(`/api${link.href}&pageSize=50`).set('Cookie', cookie());
      expect(response.status, link.href).toBe(200); expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body.pagination.total, link.href).toBe(link.count);
    }
    const mine = await request(app).get('/api/queue?dashboardFilter=myActions').set('Cookie', cookie());
    expect(mine.body.data.map((row: { id: number }) => row.id).sort()).toEqual([firstParent, secondParent].sort());
    const recent = await request(app).get(`/api${summary.body.metrics.recentlyUpdated.href}&pageSize=50&sort=ticketNumber&order=asc`).set('Cookie', cookie());
    const expected = await prisma.$queryRaw<Array<{ id: number }>>`SELECT id FROM "Ticket" WHERE "updatedAt" AT TIME ZONE 'UTC'>=${from}
      AND "updatedAt" AT TIME ZONE 'UTC'<${now} ORDER BY "updatedAt" DESC,id DESC LIMIT 50`;
    expect(recent.body.data.map((row: { id: number }) => row.id)).toEqual(expected.map(row => row.id));
    const own = recent.body.data.map((row: { id: number }) => row.id);
    expect(own).toContain(lower); expect(own).toContain(last); expect(own).not.toContain(before); expect(own).not.toContain(upper);
  });

  it('ANDs legacy queue filters and uses stable descending ID ties for all normal sorts', async () => {
    const response = await request(app).get(`/api/queue?dashboardFilter=myActions&categoryId=${category}&status=OPEN&itPriority=LOW&requestedPriority=MEDIUM&search=Staff&ownerId=${colleague}&sort=updatedAt&order=desc`).set('Cookie', cookie());
    expect(response.status).toBe(200); expect(response.body.pagination.total).toBe(1); expect(response.body.data[0].id).toBe(firstParent);
    const normal = await request(app).get(`/api/queue?categoryId=${category}&sort=updatedAt&order=desc&pageSize=50`).set('Cookie', cookie());
    const expected = await prisma.ticket.findMany({ where: { categoryId: category }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], select: { id: true } });
    expect(normal.body.data.map((row: { id: number }) => row.id)).toEqual(expected.map(row => row.id));
  });

  it('enforces requester/session roles and forbids all dashboard query overrides', async () => {
    expect((await request(app).get('/api/dashboards/staff')).status).toBe(401);
    expect((await dashboard(cookie(requester, 'REQUESTER'))).status).toBe(403);
    expect((await dashboard(cookie(inactive))).status).toBe(401);
    for (const query of ['actorId=1','assigneeId=1','ownerId=1','from=2026-10-01T00:00:00Z','unknown=true']) {
      const response = await request(app).get(`/api/dashboards/staff?${query}`).set('Cookie', cookie());
      expect(response.status).toBe(400); expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });
  it.each(['dashboardFilter=waiting','dashboardFilter=open&dashboardFilter=ownedByMe','dashboardFilter=myActions&assigneeId=999',
    'dashboardFilter=ownedByMe&requesterId=999','dashboardFilter=open&from=2026-10-01T00:00:00Z','dashboardFilter=recentlyUpdated',
    'dashboardFilter=recentlyUpdated&from=2026-11-01T00:00:00Z&to=2026-10-01T00:00:00Z',
    'dashboardFilter=recentlyUpdated&from=2026-02-30T00:00:00Z&to=2026-11-01T00:00:00Z',
    'dashboardFilter=open&page=0','dashboardFilter=open&pageSize=11','dashboardFilter=open&status=INVALID',
    'dashboardFilter=open&itPriority=INVALID','dashboardFilter=open&search=a&search=b'])('rejects malformed queue drill-down %s', async query => {
    const response = await request(app).get(`/api/queue?${query}`).set('Cookie', cookie());
    expect(response.status).toBe(400); expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('retains one repeatable snapshot across a concurrent ticket/action assignment commit', async () => {
    const current = await dashboard();
    const original = prisma.$transaction.bind(prisma); const spy = vi.spyOn(prisma, '$transaction');
    spy.mockImplementation((callback: any, options: any) => original(async tx => {
      await tx.$queryRaw`SELECT count(*) FROM "Ticket"`;
      const added = await ticket('OPEN', staff); await action(added.id);
      return callback(tx);
    }, options) as any);
    try {
      const during = await dashboard(); expect(during.status).toBe(200);
      expect(during.body.metrics.ownedByMe).toEqual(current.body.metrics.ownedByMe);
      expect(during.body.myActions).toEqual(current.body.myActions);
      expect(spy.mock.calls[0][1]).toMatchObject({ isolationLevel: 'RepeatableRead' });
    } finally { spy.mockImplementation(original as any); }
    const later = await dashboard(); expect(later.body.myActions.actionCount).toBe(current.body.myActions.actionCount + 1);
    expect(later.body.myActions.ticketCount).toBe(current.body.myActions.ticketCount + 1);
  });

  it('measures BOTH endpoints on an exact isolated 1000-ticket/3000-action fixture with constant SQL counts', async () => {
    const dbName = `workflow_staff_perf_${randomBytes(6).toString('hex')}`;
    if (!/^workflow_staff_perf_[a-f0-9]{12}$/.test(dbName)) throw new Error('Invalid isolated performance database name');
    await prisma.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
    const url = new URL(database); url.pathname = `/${dbName}`;
    const measured = new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [{ level: 'query', emit: 'event' }] });
    const queries: string[] = []; measured.$on('query', event => queries.push(event.query));
    const original = prisma.$transaction.bind(prisma); let spy: ReturnType<typeof vi.spyOn> | undefined;
    try {
      await promisify(execFile)(process.execPath, ['../node_modules/prisma/build/index.js','migrate','deploy','--schema','prisma/schema.prisma'], {
        env: { ...process.env, DATABASE_URL: url.toString() }, windowsHide: true,
      });
      await measured.user.createMany({ data: [
        { id: requester, name: 'Performance requester', email: 'requester@perf.invalid', role: 'REQUESTER', passwordHash: secret, mustChangePassword: false },
        { id: staff, name: 'Performance staff', email: 'staff@perf.invalid', role: 'IT_STAFF', passwordHash: secret, mustChangePassword: false },
      ] });
      const cat = await measured.category.create({ data: { name: 'Performance' } });
      // Verify genuine global zero buckets on the fresh database before seeding.
      spy = vi.spyOn(prisma, '$transaction'); spy.mockImplementation(measured.$transaction.bind(measured) as any);
      const zero = await dashboard(); expect(zero.status).toBe(200);
      expect(zero.body.metrics.unassigned.count).toBe(0); expect(zero.body.metrics.ownedByMe.count).toBe(0);
      expect(zero.body.metrics.recentlyUpdated.count).toBe(0);
      expect(zero.body.metrics.byStatus).toHaveLength(8); expect(zero.body.metrics.byPriority).toHaveLength(4);
      expect(zero.body.metrics.byStatus.every((row: { count: number }) => row.count === 0)).toBe(true);
      expect(zero.body.metrics.byPriority.every((row: { count: number }) => row.count === 0)).toBe(true);
      expect(zero.body.myActions).toMatchObject({ actionCount: 0, ticketCount: 0, items: [] });
      expect(zero.body.recentTickets).toEqual([]);
      const statuses: TicketStatus[] = ['OPEN','WAITING_FOR_REQUESTER','RESOLVED','CLOSED','CANCELLED'];
      await measured.ticket.createMany({ data: Array.from({ length: 1000 }, (_, index) => ({
        ticketNumber: `PERF-${String(index).padStart(4,'0')}`, requesterId: requester, categoryId: cat.id,
        summary: `Performance ${index}`, description: secret, ticketOwnerId: index % 2 ? staff : null,
        currentStatus: statuses[index % 5], itPriority: (['LOW','MEDIUM','HIGH','CRITICAL'] as const)[index % 4],
        createdAt: created, ticketDate: created, updatedAt: inside,
        resolvedAt: ['RESOLVED','CLOSED'].includes(statuses[index % 5]) ? inside : null,
      })) });
      const rows = await measured.ticket.findMany({ select: { id: true, currentStatus: true } });
      await measured.actionTaken.createMany({ data: rows.flatMap(row => Array.from({ length: 3 }, () => ({
        ticketId: row.id, performedById: staff, assigneeId: staff, updatedById: staff, actionAt: inside,
        description: 'Synthetic performance work', result: ['OPEN','WAITING_FOR_REQUESTER'].includes(row.currentStatus) ? null : 'Completed',
        status: ['OPEN','WAITING_FOR_REQUESTER'].includes(row.currentStatus) ? 'PLANNED' as const : 'COMPLETED' as const,
        idempotencyKey: randomUUID(), requestFingerprint: 'isolated-performance',
      }))) });
      expect(await measured.ticket.count()).toBe(1000); expect(await measured.actionTaken.count()).toBe(3000);
      // Authentication uses matching synthetic identities in the runner database;
      // all dashboard SQL is routed to this dedicated, query-logged fixture DB.
      for (const endpoint of ['requester','staff'] as const) {
        const identity = endpoint === 'staff' ? cookie() : cookie(requester,'REQUESTER');
        const fetch = () => request(app).get(`/api/dashboards/${endpoint}`).set('Cookie', identity);
        for (let index = 0; index < 5; index++) expect((await fetch()).status).toBe(200);
        const durations: number[] = []; const queryCounts: number[] = []; let maxBytes = 0;
        for (let index = 0; index < 30; index++) {
          queries.length = 0; const start = performance.now(); const response = await fetch(); durations.push(performance.now() - start);
          expect(response.status).toBe(200); maxBytes = Math.max(maxBytes, Buffer.byteLength(JSON.stringify(response.body)));
          queryCounts.push(queries.filter(sql => !/^(BEGIN|COMMIT|SET TRANSACTION)/.test(sql)).length);
          expect(response.body.recentTickets).toHaveLength(5);
          if (endpoint === 'staff') {
            expect(response.body.myActions.actionCount).toBe(1200); expect(response.body.myActions.ticketCount).toBe(400);
            expect(response.body.myActions.items).toHaveLength(5); expect(response.body.metrics.ownedByMe.count).toBe(200);
          } else expect(response.body.metrics.open.count).toBe(400);
        }
        durations.sort((a,b) => a-b); const p50 = durations[14]; const p95 = durations[28];
        expect(new Set(queryCounts).size).toBe(1); expect(queryCounts[0]).toBeLessThanOrEqual(15);
        expect(p95).toBeLessThanOrEqual(1000); expect(maxBytes).toBeLessThanOrEqual(100*1024);
        console.log(`${endpoint} dashboard PERF: isolated PostgreSQL16, exact1000tickets/3000actions,5warmups/30measured, p50=${p50.toFixed(2)}ms p95=${p95.toFixed(2)}ms maxPayload=${maxBytes}bytes SQLqueries=${queryCounts[0]} constant`);
      }
      const plan = await measured.$queryRaw<Array<{ 'QUERY PLAN': string }>>`EXPLAIN ANALYZE SELECT count(DISTINCT a."ticketId") FROM "ActionTaken" a JOIN "Ticket" t ON t.id=a."ticketId"
        WHERE a."assigneeId"=${staff} AND a.status IN ('PLANNED','IN_PROGRESS') AND t."currentStatus" IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED')`;
      console.log(`Staff distinct-parent query plan: ${plan.map(row => row['QUERY PLAN']).join(' | ')}`);
    } finally {
      if (spy) spy.mockImplementation(original as any);
      await measured.$disconnect();
      await prisma.$executeRawUnsafe(`DROP DATABASE "${dbName}"`);
    }
  });
});
