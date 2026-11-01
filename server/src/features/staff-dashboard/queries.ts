import { Priority, TicketStatus, type Prisma } from '@prisma/client';
import { REQUESTER_ACTIVE_STATUSES } from '../requester-dashboard-preparation/filters.js';
import { DashboardInputError, parseDashboardInstant, type RequesterSnapshotWindow } from '../requester-dashboard-preparation/window.js';

const activeTickets = () => ({ currentStatus: { in: [...REQUESTER_ACTIVE_STATUSES] } });
export const STAFF_STATUS_ORDER = Object.freeze(Object.values(TicketStatus));
export const STAFF_PRIORITY_ORDER = Object.freeze(Object.values(Priority));
export const STAFF_PREVIEW_LIMIT = 5;
function actorId(value: number) {
  if (!Number.isSafeInteger(value) || value < 1) throw new DashboardInputError();
  return value;
}
function timeRange(from: unknown, to: unknown) {
  const start = parseDashboardInstant(from); const end = parseDashboardInstant(to);
  if (Date.parse(start) >= Date.parse(end)) throw new DashboardInputError();
  return { gte: start, lt: end };
}
export function activeAssignedActionWhere(sessionActorId: number): Prisma.ActionTakenWhereInput {
  return { assigneeId: actorId(sessionActorId), status: { in: ['PLANNED', 'IN_PROGRESS'] }, ticket: activeTickets() };
}
export function activeAssignedTicketWhere(sessionActorId: number): Prisma.TicketWhereInput {
  // EXISTS preserves distinct parent ticket counts regardless of child cardinality.
  return { ...activeTickets(), actions: { some: { assigneeId: actorId(sessionActorId), status: { in: ['PLANNED', 'IN_PROGRESS'] } } } };
}
export function buildStaffPredicates(sessionActorId: number, snapshot: RequesterSnapshotWindow) {
  const actor = actorId(sessionActorId);
  const range = timeRange(snapshot.window.from, snapshot.window.to);
  if (snapshot.timeZone !== 'Asia/Bangkok' || parseDashboardInstant(snapshot.asOf) !== range.lt) throw new DashboardInputError();
  return { open: activeTickets(), unassigned: { ...activeTickets(), ticketOwnerId: null },
    ownedByMe: { ...activeTickets(), ticketOwnerId: actor }, recentlyUpdated: { updatedAt: range },
    myActions: activeAssignedActionWhere(actor), myActionTickets: activeAssignedTicketWhere(actor) };
}
export function completeBuckets<K extends string>(order: readonly K[], counts: ReadonlyArray<{ key: K; count: number }>): Array<{ key: K; count: number }> {
  const byKey = new Map(counts.map(row => [row.key, row.count]));
  return order.map(key => ({ key, count: byKey.get(key) ?? 0 }));
}
export function buildStaffDrilldown(sessionActorId: number, query: Readonly<Record<string, unknown>>): Prisma.TicketWhereInput {
  const actor = actorId(sessionActorId);
  if (Object.keys(query).some(key => !['dashboardFilter', 'from', 'to'].includes(key))) throw new DashboardInputError();
  const filter = query.dashboardFilter;
  if (filter === undefined) {
    if (query.from !== undefined || query.to !== undefined) throw new DashboardInputError();
    return {};
  }
  if (typeof filter !== 'string' || !['open', 'unassigned', 'ownedByMe', 'myActions', 'recentlyUpdated'].includes(filter)) throw new DashboardInputError();
  if (filter === 'recentlyUpdated') return { updatedAt: timeRange(query.from, query.to) };
  if (query.from !== undefined || query.to !== undefined) throw new DashboardInputError();
  if (filter === 'myActions') return activeAssignedTicketWhere(actor);
  if (filter === 'unassigned') return { ...activeTickets(), ticketOwnerId: null };
  if (filter === 'ownedByMe') return { ...activeTickets(), ticketOwnerId: actor };
  return activeTickets();
}

/** Exact ActionPreview contract; never copy a full action or user object. */
export function staffActionPreview(action: { id: number; ticketId: number; ticket: { ticketNumber: string }; description: string; status: string; actionAt: Date; followUpRequired: boolean }) {
  return { id: action.id, ticketId: action.ticketId, ticketNumber: action.ticket.ticketNumber,
    description: Array.from(action.description).slice(0, 120).join(''), status: action.status,
    actionAt: action.actionAt, followUpRequired: action.followUpRequired, href: `/tickets/${action.ticketId}#action-${action.id}` };
}
