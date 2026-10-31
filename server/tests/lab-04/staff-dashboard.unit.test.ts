import { describe, expect, it } from 'vitest';
import { buildStaffDrilldown, buildStaffPredicates, completeBuckets, STAFF_PRIORITY_ORDER, STAFF_STATUS_ORDER, staffActionPreview } from '../../src/features/staff-dashboard/queries.js';
import { createRequesterWindow, DashboardInputError } from '../../src/features/requester-dashboard-preparation/window.js';

describe('Staff dashboard query contract', () => {
  it('returns all zero buckets in the documented enum order', () => {
    expect(completeBuckets(STAFF_STATUS_ORDER, []).map(row => row.key)).toEqual(['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED']);
    expect(completeBuckets(STAFF_PRIORITY_ORDER, [{ key: 'HIGH', count: 3 }])).toEqual([
      { key: 'LOW', count: 0 }, { key: 'MEDIUM', count: 0 }, { key: 'HIGH', count: 3 }, { key: 'CRITICAL', count: 0 },
    ]);
  });
  it('uses current assignee and EXISTS parent scope, not creator or ticket owner', () => {
    const predicates = buildStaffPredicates(9, createRequesterWindow('2026-11-01T17:00:00Z'));
    expect(predicates.myActions.assigneeId).toBe(9);
    expect(predicates.myActions).not.toHaveProperty('performedById');
    expect(predicates.myActionTickets).toMatchObject({ actions: { some: { assigneeId: 9, status: { in: ['PLANNED', 'IN_PROGRESS'] } } } });
    expect(predicates.ownedByMe.ticketOwnerId).toBe(9);
    expect(buildStaffDrilldown(9, { dashboardFilter: 'myActions' })).toEqual(predicates.myActionTickets);
  });
  it('bounds Unicode previews and emits only public action fields', () => {
    const row = staffActionPreview({ id: 7, ticketId: 8, ticket: { ticketNumber: 'T-8' }, description: '😀'.repeat(121),
      status: 'PLANNED', actionAt: new Date('2026-10-31T00:00:00Z'), followUpRequired: true });
    expect(Array.from(row.description)).toHaveLength(120);
    expect(row.href).toBe('/tickets/8#action-7');
    expect(Object.keys(row).sort()).toEqual(['id', 'ticketId', 'ticketNumber', 'description', 'status', 'actionAt', 'followUpRequired', 'href'].sort());
  });
  it.each([{ dashboardFilter: 'waiting' }, { dashboardFilter: ['open'] }, { dashboardFilter: 'open', from: '2026-10-01T00:00:00Z' },
    { dashboardFilter: 'ownedByMe', actorId: 1 }, { dashboardFilter: 'recentlyUpdated' },
    { dashboardFilter: 'recentlyUpdated', from: '2026-11-01T00:00:00Z', to: '2026-10-01T00:00:00Z' }])('rejects unsupported or identity-selecting query %j', query => {
    expect(() => buildStaffDrilldown(9, query)).toThrow(DashboardInputError);
  });
});
