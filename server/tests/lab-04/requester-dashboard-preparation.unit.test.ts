import { describe, expect, it } from 'vitest';
import { createRequesterWindow, DashboardInputError, parseDashboardInstant } from '../../src/features/requester-dashboard-preparation/window.js';
import { buildRequesterDrilldown, buildRequesterMetricPredicates, requesterPreviewQuery, requesterRecentOrder } from '../../src/features/requester-dashboard-preparation/filters.js';

describe('Feature 22 preparation: Bangkok calendar window', () => {
  it.each([
    ['2026-10-30T16:59:59.999Z', '2026-10-23T17:00:00.000Z'],
    ['2026-10-30T17:00:00.000Z', '2026-10-24T17:00:00.000Z'],
    ['2026-01-01T00:00:00.000Z', '2025-12-25T17:00:00.000Z'],
    ['2024-03-01T05:00:00.000Z', '2024-02-23T17:00:00.000Z'],
    ['2026-10-30T21:00:00+07:00', '2026-10-23T17:00:00.000Z'],
  ])('uses local midnight and calendar boundaries for %s', (asOf, from) => {
    const snapshot = createRequesterWindow(asOf);
    expect(snapshot.window).toEqual({ from, to: new Date(asOf).toISOString() });
    expect(snapshot.timeZone).toBe('Asia/Bangkok');
    expect(snapshot.asOf).toBe(snapshot.window.to);
  });
  it('does not mutate the Date input and returns frozen primitive metadata', () => {
    const date = new Date('2026-10-30T14:00:00Z');
    const time = date.getTime();
    const snapshot = createRequesterWindow(date);
    expect(date.getTime()).toBe(time);
    date.setUTCFullYear(2000);
    expect(snapshot.asOf).toBe(new Date(time).toISOString());
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.window)).toBe(true);
  });
  it.each(['2026-02-30T00:00:00Z', '2025-02-29T00:00:00Z', '2026-10-30T24:00:00Z', '2026-10-30T12:00:00', '2026-10-30', 'invalid', '2026-10-30T12:00:00+24:00', '2026-10-30T12:00:00+07:99', '0000-01-01T00:00:00Z'])('rejects invalid snapshot %s', asOf => {
    expect(() => createRequesterWindow(asOf)).toThrow(DashboardInputError);
  });
  it('rejects invalid Date and normalizes equivalent offset instants', () => {
    expect(() => createRequesterWindow(new Date(NaN))).toThrow(DashboardInputError);
    expect(parseDashboardInstant('2024-02-29T12:00:00+07:00')).toBe('2024-02-29T05:00:00.000Z');
  });
});

describe('Feature 22 preparation: authorized metric and drill-down predicates', () => {
  const snapshot = createRequesterWindow('2026-10-30T14:00:00Z');
  it('uses exact active set and waiting status for the session identity', () => {
    const metrics = buildRequesterMetricPredicates(2, snapshot);
    expect(metrics.open).toEqual({ requesterId: 2, currentStatus: { in: ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED'] } });
    expect(metrics.waiting).toEqual({ requesterId: 2, currentStatus: 'WAITING_FOR_REQUESTER' });
    for (const metric of Object.values(metrics)) expect(metric.requesterId).toBe(2);
    for (const metric of Object.values(buildRequesterMetricPredicates(3, snapshot))) expect(metric.requesterId).toBe(3);
  });
  it('matches metric/drill-down inclusive and exclusive bounds exactly', () => {
    const metrics = buildRequesterMetricPredicates(2, snapshot);
    for (const dashboardFilter of ['recentlyResolved', 'recentlyUpdated'] as const) {
      expect(buildRequesterDrilldown(2, { dashboardFilter, ...snapshot.window }).where).toEqual(metrics[dashboardFilter]);
    }
    expect(metrics.recentlyResolved).toEqual({ requesterId: 2, currentStatus: { in: ['RESOLVED', 'CLOSED'] }, resolvedAt: { gte: snapshot.window.from, lt: snapshot.asOf } });
    expect(metrics.recentlyResolved).not.toHaveProperty('resolutionTimeEstimated');
    expect(metrics.recentlyUpdated).toEqual({ requesterId: 2, updatedAt: { gte: snapshot.window.from, lt: snapshot.asOf } });
  });
  it('keeps open/waiting links equivalent to metrics without time overrides', () => {
    const metrics = buildRequesterMetricPredicates(2, snapshot);
    for (const dashboardFilter of ['open', 'waiting'] as const) expect(buildRequesterDrilldown(2, { dashboardFilter }).where).toEqual(metrics[dashboardFilter]);
    expect(buildRequesterDrilldown(2, {}).where).toEqual({ requesterId: 2 });
  });
  it('bounds previews and retains deterministic ties without sharing mutable sort results', () => {
    const recent = requesterPreviewQuery(2, snapshot, 'recentlyUpdated');
    const resolved = requesterPreviewQuery(2, snapshot, 'recentlyResolved');
    expect(recent.take).toBe(5);
    expect(resolved.take).toBe(5);
    expect(recent.orderBy).toEqual([{ updatedAt: 'desc' }, { id: 'desc' }]);
    expect(resolved.orderBy).toEqual([{ resolvedAt: 'desc' }, { id: 'desc' }]);
    recent.orderBy.pop();
    expect(requesterRecentOrder('recentlyUpdated')).toHaveLength(2);
  });
  it.each([0, -1, 1.1, NaN, Number.MAX_SAFE_INTEGER + 1])('rejects invalid session identity %s', identity => {
    expect(() => buildRequesterMetricPredicates(identity, snapshot)).toThrow(DashboardInputError);
  });
  it.each([
    { requesterId: 99 }, { dashboardFilter: 'myActions' }, { dashboardFilter: ['open'] },
    { dashboardFilter: '' }, { dashboardFilter: 'open', from: snapshot.window.from },
    { dashboardFilter: 'waiting', to: snapshot.window.to }, { from: snapshot.window.from },
    { dashboardFilter: 'recentlyUpdated' }, { dashboardFilter: 'recentlyResolved', from: snapshot.window.from },
    { dashboardFilter: 'recentlyResolved', from: snapshot.window.to, to: snapshot.window.from },
    { dashboardFilter: 'recentlyUpdated', from: snapshot.window.to, to: snapshot.window.to },
    { dashboardFilter: 'recentlyUpdated', from: '2026-02-30T00:00:00Z', to: snapshot.window.to },
  ])('rejects unknown filters, identity overrides and invalid ranges %j', query => {
    expect(() => buildRequesterDrilldown(2, query)).toThrow(DashboardInputError);
  });
});
