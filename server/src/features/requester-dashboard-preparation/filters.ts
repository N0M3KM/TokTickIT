import type { Prisma, TicketStatus } from '@prisma/client';
import { DashboardInputError, parseDashboardInstant, type RequesterSnapshotWindow } from './window.js';

export const REQUESTER_ACTIVE_STATUSES: readonly TicketStatus[] = Object.freeze(['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED']);
export const REQUESTER_PREVIEW_LIMIT = 5;
export type RequesterMetric = 'open' | 'waiting' | 'recentlyResolved' | 'recentlyUpdated';
function requesterIdentity(sessionRequesterId: number): number {
  if (!Number.isSafeInteger(sessionRequesterId) || sessionRequesterId < 1) throw new DashboardInputError();
  return sessionRequesterId;
}
function range(from: unknown, to: unknown) {
  const normalizedFrom = parseDashboardInstant(from);
  const normalizedTo = parseDashboardInstant(to);
  if (Date.parse(normalizedFrom) >= Date.parse(normalizedTo)) throw new DashboardInputError();
  return { gte: normalizedFrom, lt: normalizedTo };
}

/** Pass only an authenticated requester ID; query parameters never select identity. */
export function buildRequesterMetricPredicates(sessionRequesterId: number, snapshot: RequesterSnapshotWindow): Record<RequesterMetric, Prisma.TicketWhereInput> {
  const requesterId = requesterIdentity(sessionRequesterId);
  const timeRange = range(snapshot.window.from, snapshot.window.to);
  if (snapshot.timeZone !== 'Asia/Bangkok' || parseDashboardInstant(snapshot.asOf) !== timeRange.lt) throw new DashboardInputError();
  return {
    open: { requesterId, currentStatus: { in: [...REQUESTER_ACTIVE_STATUSES] } },
    waiting: { requesterId, currentStatus: 'WAITING_FOR_REQUESTER' },
    recentlyResolved: { requesterId, currentStatus: { in: ['RESOLVED', 'CLOSED'] }, resolvedAt: { ...timeRange } },
    recentlyUpdated: { requesterId, updatedAt: { ...timeRange } },
  };
}

export function requesterRecentOrder(metric: RequesterMetric): Prisma.TicketOrderByWithRelationInput[] {
  return metric === 'recentlyResolved' ? [{ resolvedAt: 'desc' }, { id: 'desc' }] : [{ updatedAt: 'desc' }, { id: 'desc' }];
}
export function requesterPreviewQuery(sessionRequesterId: number, snapshot: RequesterSnapshotWindow, metric: 'recentlyResolved' | 'recentlyUpdated') {
  return { where: buildRequesterMetricPredicates(sessionRequesterId, snapshot)[metric], orderBy: requesterRecentOrder(metric), take: REQUESTER_PREVIEW_LIMIT };
}

/**
 * Parse only dashboard-specific parameters. A future route must combine legacy
 * list filters with AND, never spread over this requester predicate. Unknown
 * keys (including caller identity) are rejected.
 */
export function buildRequesterDrilldown(sessionRequesterId: number, query: Readonly<Record<string, unknown>>): { where: Prisma.TicketWhereInput; orderBy: Prisma.TicketOrderByWithRelationInput[] } {
  const requesterId = requesterIdentity(sessionRequesterId);
  if (Object.keys(query).some(key => !['dashboardFilter', 'from', 'to'].includes(key))) throw new DashboardInputError();
  const filter = query.dashboardFilter;
  if (filter === undefined) {
    if (query.from !== undefined || query.to !== undefined) throw new DashboardInputError();
    return { where: { requesterId }, orderBy: requesterRecentOrder('recentlyUpdated') };
  }
  if (typeof filter !== 'string' || !['open', 'waiting', 'recentlyResolved', 'recentlyUpdated'].includes(filter)) throw new DashboardInputError();
  const metric = filter as RequesterMetric;
  if (metric === 'open' || metric === 'waiting') {
    if (query.from !== undefined || query.to !== undefined) throw new DashboardInputError();
    return { where: { requesterId, currentStatus: metric === 'open' ? { in: [...REQUESTER_ACTIVE_STATUSES] } : 'WAITING_FOR_REQUESTER' }, orderBy: requesterRecentOrder(metric) };
  }
  const window = range(query.from, query.to);
  return { where: metric === 'recentlyResolved'
    ? { requesterId, currentStatus: { in: ['RESOLVED', 'CLOSED'] }, resolvedAt: window }
    : { requesterId, updatedAt: window }, orderBy: requesterRecentOrder(metric) };
}
