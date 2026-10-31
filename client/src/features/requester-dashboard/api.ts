import { apiFetch } from '../../lib/api.js';

export type MetricKey = 'open' | 'waiting' | 'recentlyResolved' | 'recentlyUpdated';
export interface DashboardMetric { count: number; href: string }
export interface TicketPreview {
  id: number; ticketNumber: string; summary: string; currentStatus: string; itPriority: string;
  ticketOwner: { id: number; name: string } | null; updatedAt: string; resolvedAt: string | null;
  resolutionTimeEstimated: boolean; href: string;
}
export interface RequesterDashboardDTO {
  asOf: string; timeZone: 'Asia/Bangkok'; window: { from: string; to: string };
  metrics: Record<MetricKey, DashboardMetric>; recentTickets: TicketPreview[]; recentResolvedTickets: TicketPreview[];
}
export type DashboardFailureKind = 'unauthenticated' | 'forbidden' | 'not-found' | 'failure';
export class DashboardFailure extends Error {
  constructor(readonly kind: DashboardFailureKind) { super('Could not load requester dashboard.'); }
}
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const positive = (value: unknown): value is number => nonnegative(value) && value > 0;
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new DashboardFailure('failure');
  return value;
}
function instant(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(new Date(value).getTime())) throw new DashboardFailure('failure');
  return value;
}
function metric(value: unknown, key: MetricKey, window: { from: string; to: string }): DashboardMetric {
  const raw = object(value);
  if (!raw || !nonnegative(raw.count) || typeof raw.href !== 'string' || !raw.href.startsWith('/tickets?') || /[#\\\s]/.test(raw.href)) throw new DashboardFailure('failure');
  const params = new URLSearchParams(raw.href.slice('/tickets?'.length));
  const recent = key === 'recentlyResolved' || key === 'recentlyUpdated';
  const allowed = recent ? ['dashboardFilter', 'from', 'to'] : ['dashboardFilter'];
  if ([...params.keys()].some(name => !allowed.includes(name)) || allowed.some(name => params.getAll(name).length !== 1) || params.get('dashboardFilter') !== key) throw new DashboardFailure('failure');
  if (recent && (params.get('from') !== window.from || params.get('to') !== window.to)) throw new DashboardFailure('failure');
  // Build the navigable destination from validated pieces, never raw server URLs.
  const href = `/tickets?dashboardFilter=${key}${recent ? `&from=${encodeURIComponent(window.from)}&to=${encodeURIComponent(window.to)}` : ''}`;
  return { count: raw.count, href };
}
function preview(value: unknown): TicketPreview {
  const raw = object(value);
  if (!raw || !positive(raw.id) || raw.href !== `/tickets/${raw.id}` || !['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED'].includes(String(raw.currentStatus)) || !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(raw.itPriority)) || typeof raw.resolutionTimeEstimated !== 'boolean') throw new DashboardFailure('failure');
  const owner = object(raw.ticketOwner);
  if (raw.ticketOwner !== null && (!owner || !positive(owner.id))) throw new DashboardFailure('failure');
  return {
    id: raw.id, ticketNumber: text(raw.ticketNumber, 100), summary: text(raw.summary, 2000), currentStatus: String(raw.currentStatus), itPriority: String(raw.itPriority),
    ticketOwner: owner ? { id: Number(owner.id), name: text(owner.name, 500) } : null,
    updatedAt: instant(raw.updatedAt), resolvedAt: raw.resolvedAt === null ? null : instant(raw.resolvedAt),
    resolutionTimeEstimated: raw.resolutionTimeEstimated, href: `/tickets/${raw.id}`,
  };
}
export function parseRequesterDashboard(value: unknown): RequesterDashboardDTO {
  const raw = object(value), rawWindow = object(raw?.window), rawMetrics = object(raw?.metrics);
  if (!raw || !rawWindow || !rawMetrics || raw.timeZone !== 'Asia/Bangkok') throw new DashboardFailure('failure');
  const asOf = instant(raw.asOf), window = { from: instant(rawWindow.from), to: instant(rawWindow.to) };
  if (new Date(window.from).getTime() >= new Date(window.to).getTime() || new Date(window.to).getTime() !== new Date(asOf).getTime()) throw new DashboardFailure('failure');
  const list = (value: unknown) => {
    if (!Array.isArray(value) || value.length > 5) throw new DashboardFailure('failure');
    const items = value.map(preview);
    if (new Set(items.map(item => item.id)).size !== items.length) throw new DashboardFailure('failure');
    return items;
  };
  const recentTickets = list(raw.recentTickets), recentResolvedTickets = list(raw.recentResolvedTickets);
  if (recentResolvedTickets.some(ticket => ticket.resolvedAt === null)) throw new DashboardFailure('failure');
  return {
    asOf, timeZone: 'Asia/Bangkok', window,
    metrics: { open: metric(rawMetrics.open, 'open', window), waiting: metric(rawMetrics.waiting, 'waiting', window), recentlyResolved: metric(rawMetrics.recentlyResolved, 'recentlyResolved', window), recentlyUpdated: metric(rawMetrics.recentlyUpdated, 'recentlyUpdated', window) },
    recentTickets, recentResolvedTickets,
  };
}
export async function fetchRequesterDashboard(signal: AbortSignal): Promise<RequesterDashboardDTO> {
  let response: Response;
  try { response = await apiFetch('/api/dashboards/requester', { signal }); }
  catch { throw new DashboardFailure('failure'); }
  if (!response.ok) throw new DashboardFailure(response.status === 401 ? 'unauthenticated' : response.status === 403 ? 'forbidden' : response.status === 404 ? 'not-found' : 'failure');
  return parseRequesterDashboard(await response.json().catch(() => null));
}
