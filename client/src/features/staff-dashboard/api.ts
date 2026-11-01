import { apiFetch } from '../../lib/api.js';
import type { TicketPreview } from '../requester-dashboard/api.js';

export const STATUS_ORDER = ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED'] as const;
export const PRIORITY_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export interface Metric { count: number; href: string }
export interface ActionPreview { id: number; ticketId: number; ticketNumber: string; description: string; status: 'PLANNED' | 'IN_PROGRESS'; actionAt: string; followUpRequired: boolean; href: string }
export interface StaffDashboardDTO {
  asOf: string; timeZone: 'Asia/Bangkok'; window: { from: string; to: string };
  metrics: {
    unassigned: Metric; ownedByMe: Metric; recentlyUpdated: Metric;
    byStatus: (Metric & { status: typeof STATUS_ORDER[number] })[];
    byPriority: (Metric & { itPriority: typeof PRIORITY_ORDER[number] })[];
  };
  myActions: { actionCount: number; ticketCount: number; href: string; items: ActionPreview[] };
  recentTickets: TicketPreview[];
}
export type FailureKind = 'unauthenticated' | 'forbidden' | 'not-found' | 'failure';
export class StaffDashboardFailure extends Error {
  constructor(readonly kind: FailureKind) { super('Could not load staff dashboard.'); }
}
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const positive = (value: unknown): value is number => nonnegative(value) && value > 0;
const invalid = (): never => { throw new StaffDashboardFailure('failure'); };
function text(value: unknown, max: number): string { return typeof value === 'string' && value.trim() && Array.from(value).length <= max ? value : invalid(); }
function instant(value: unknown): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(new Date(value).getTime()) ? value : invalid();
}
function queueHref(value: unknown, expected: Record<string, string>): string {
  if (typeof value !== 'string' || !value.startsWith('/queue?') || /[#\\\s]/.test(value)) return invalid();
  const params = new URLSearchParams(value.slice('/queue?'.length));
  const keys = Object.keys(expected);
  if ([...params.keys()].some(key => !keys.includes(key)) || keys.some(key => params.getAll(key).length !== 1 || params.get(key) !== expected[key])) return invalid();
  return `/queue?${keys.map(key => `${encodeURIComponent(key)}=${encodeURIComponent(expected[key])}`).join('&')}`;
}
function metric(value: unknown, expected: Record<string, string>): Metric {
  const raw = object(value);
  if (!raw || !nonnegative(raw.count)) return invalid();
  return { count: raw.count, href: queueHref(raw.href, expected) };
}
function action(value: unknown): ActionPreview {
  const raw = object(value);
  if (!raw || !positive(raw.id) || !positive(raw.ticketId) || raw.href !== `/tickets/${raw.ticketId}#action-${raw.id}` || !['PLANNED', 'IN_PROGRESS'].includes(String(raw.status)) || typeof raw.followUpRequired !== 'boolean') return invalid();
  return { id: raw.id, ticketId: raw.ticketId, ticketNumber: text(raw.ticketNumber, 100), description: text(raw.description, 120), status: raw.status as ActionPreview['status'], actionAt: instant(raw.actionAt), followUpRequired: raw.followUpRequired, href: `/tickets/${raw.ticketId}#action-${raw.id}` };
}
function ticket(value: unknown): TicketPreview {
  const raw = object(value);
  if (!raw || !positive(raw.id) || raw.href !== `/tickets/${raw.id}` || !STATUS_ORDER.includes(raw.currentStatus as typeof STATUS_ORDER[number]) || !PRIORITY_ORDER.includes(raw.itPriority as typeof PRIORITY_ORDER[number]) || typeof raw.resolutionTimeEstimated !== 'boolean') return invalid();
  const owner = object(raw.ticketOwner);
  if (raw.ticketOwner !== null && (!owner || !positive(owner.id))) return invalid();
  return {
    id: raw.id, ticketNumber: text(raw.ticketNumber, 100), summary: text(raw.summary, 2000), currentStatus: String(raw.currentStatus), itPriority: String(raw.itPriority),
    ticketOwner: owner ? { id: Number(owner.id), name: text(owner.name, 500) } : null,
    updatedAt: instant(raw.updatedAt), resolvedAt: raw.resolvedAt === null ? null : instant(raw.resolvedAt), resolutionTimeEstimated: raw.resolutionTimeEstimated, href: `/tickets/${raw.id}`,
  };
}
function boundedList<T extends { id: number }>(value: unknown, parse: (value: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > 5) return invalid();
  const items = value.map(parse);
  return new Set(items.map(item => item.id)).size === items.length ? items : invalid();
}
export function parseStaffDashboard(value: unknown): StaffDashboardDTO {
  const raw = object(value), windowRaw = object(raw?.window), metricsRaw = object(raw?.metrics), actionsRaw = object(raw?.myActions);
  if (!raw || raw.timeZone !== 'Asia/Bangkok' || !windowRaw || !metricsRaw || !actionsRaw) return invalid();
  const asOf = instant(raw.asOf), window = { from: instant(windowRaw.from), to: instant(windowRaw.to) };
  if (Date.parse(window.from) >= Date.parse(window.to) || Date.parse(window.to) !== Date.parse(asOf)) return invalid();
  if (!Array.isArray(metricsRaw.byStatus) || metricsRaw.byStatus.length !== STATUS_ORDER.length || !Array.isArray(metricsRaw.byPriority) || metricsRaw.byPriority.length !== PRIORITY_ORDER.length) return invalid();
  const byStatusRaw = metricsRaw.byStatus, byPriorityRaw = metricsRaw.byPriority;
  const byStatus = STATUS_ORDER.map(status => {
    const matches = byStatusRaw.filter(value => object(value)?.status === status);
    return matches.length === 1 ? { status, ...metric(matches[0], { status }) } : invalid();
  });
  const byPriority = PRIORITY_ORDER.map(itPriority => {
    const matches = byPriorityRaw.filter(value => object(value)?.itPriority === itPriority);
    return matches.length === 1 ? { itPriority, ...metric(matches[0], { dashboardFilter: 'open', itPriority }) } : invalid();
  });
  if (!nonnegative(actionsRaw.actionCount) || !nonnegative(actionsRaw.ticketCount) || actionsRaw.ticketCount > actionsRaw.actionCount) return invalid();
  const items = boundedList(actionsRaw.items, action);
  if (items.length > actionsRaw.actionCount || new Set(items.map(item => item.ticketId)).size > actionsRaw.ticketCount) return invalid();
  return {
    asOf, timeZone: 'Asia/Bangkok', window,
    metrics: { unassigned: metric(metricsRaw.unassigned, { dashboardFilter: 'unassigned' }), ownedByMe: metric(metricsRaw.ownedByMe, { dashboardFilter: 'ownedByMe' }), recentlyUpdated: metric(metricsRaw.recentlyUpdated, { dashboardFilter: 'recentlyUpdated', from: window.from, to: window.to }), byStatus, byPriority },
    myActions: { actionCount: actionsRaw.actionCount, ticketCount: actionsRaw.ticketCount, href: queueHref(actionsRaw.href, { dashboardFilter: 'myActions' }), items },
    recentTickets: boundedList(raw.recentTickets, ticket),
  };
}
export async function fetchStaffDashboard(signal: AbortSignal): Promise<StaffDashboardDTO> {
  let response: Response;
  try { response = await apiFetch('/api/dashboards/staff', { signal }); } catch { throw new StaffDashboardFailure('failure'); }
  if (!response.ok) throw new StaffDashboardFailure(response.status === 401 ? 'unauthenticated' : response.status === 403 ? 'forbidden' : response.status === 404 ? 'not-found' : 'failure');
  return parseStaffDashboard(await response.json().catch(() => null));
}
