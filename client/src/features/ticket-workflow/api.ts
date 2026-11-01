import { apiFetch } from '../../lib/api.js';

export const statuses = ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED'];
export const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export interface OperationalTicket {
  id: number; ticketOwnerId: number | null; itPriority: string; currentStatus: string;
  requesterResolvedAt: string | null; version: number; resolvedAt: string | null;
  reopenedAt: string | null; resolutionTimeEstimated: boolean; allowedTransitions: string[];
  resolutionGate?: { reasons: string[] };
}
export const gateMessages: Record<string, string> = {
  OWNER_REQUIRED: 'Assign a Ticket Owner before resolving.',
  OWNER_INACTIVE: 'Assign an active Ticket Owner before resolving.',
  NO_COMPLETED_ACTION: 'Complete an action before resolving.',
  OPEN_ACTIONS: 'Complete or cancel all open actions before resolving.',
  FOLLOW_UP_OUTSTANDING: 'Finish outstanding follow-up before resolving.',
  FRESH_WORK_REQUIRED: 'Complete fresh work after reopening before resolving again.',
};
export const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
export class WorkflowError extends Error {
  constructor(readonly status: number, readonly code: string, readonly reasons: string[] = []) {
    super(status === 401 ? 'Your session expired. Sign in again; this draft may be cleared.'
      : status === 403 ? 'You do not have permission to update this ticket.'
      : status === 404 ? 'Ticket not found.'
      : code === 'RESOLUTION_BLOCKED' ? 'This ticket cannot be resolved yet.'
      : code === 'CANCELLATION_BLOCKED' ? 'Complete or cancel all active actions before cancelling this ticket.'
      : code === 'ALREADY_RESOLVED' ? 'Your problem-resolved indication is already recorded.'
      : code === 'STALE_UPDATE' ? 'This ticket changed while you were editing. Reload the latest values and reconcile your draft.'
      : code === 'INVALID_TRANSITION' ? 'This status change is no longer permitted. Reload the latest ticket.'
      : status === 400 ? 'Check the selected owner, priority and permitted status before saving.'
      : 'Could not confirm the ticket update. Reload the latest values before retrying.');
  }
}
export async function workflowJson(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try { response = await apiFetch(path, init); }
  catch { throw new WorkflowError(0, 'UNKNOWN_OUTCOME'); }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = record(record(body)?.error);
    const details = record(error?.details);
    const reasons = Array.isArray(details?.reasons) ? details.reasons.filter((reason): reason is string => typeof reason === 'string' && Boolean(gateMessages[reason])) : [];
    throw new WorkflowError(response.status, typeof error?.code === 'string' ? error.code : 'REQUEST_FAILED', reasons);
  }
  return body;
}
export function parseOperationalTicket(value: unknown, fallback?: OperationalTicket): OperationalTicket {
  const raw = record(value);
  if (!raw || !positive(raw.id) || !positive(raw.version) || (raw.ticketOwnerId !== null && !positive(raw.ticketOwnerId)) || !priorities.includes(String(raw.itPriority)) || !statuses.includes(String(raw.currentStatus))) throw new WorkflowError(0, 'INVALID_RESPONSE');
  const timestamp = (field: string): string | null => {
    const value = raw[field];
    if (value === undefined && fallback) return fallback[field as 'resolvedAt'];
    if (value === null) return null;
    if (typeof value !== 'string' || !Number.isFinite(new Date(value).getTime())) throw new WorkflowError(0, 'INVALID_RESPONSE');
    return value;
  };
  const gate = record(raw.resolutionGate);
  return {
    id: raw.id, version: raw.version, ticketOwnerId: raw.ticketOwnerId as number | null,
    itPriority: String(raw.itPriority), currentStatus: String(raw.currentStatus),
    requesterResolvedAt: timestamp('requesterResolvedAt'), resolvedAt: timestamp('resolvedAt'), reopenedAt: timestamp('reopenedAt'),
    resolutionTimeEstimated: raw.resolutionTimeEstimated === true,
    allowedTransitions: Array.isArray(raw.allowedTransitions) ? raw.allowedTransitions.filter((value): value is string => typeof value === 'string' && statuses.includes(value)) : fallback?.allowedTransitions ?? [],
    resolutionGate: { reasons: Array.isArray(gate?.reasons) ? gate.reasons.filter((value): value is string => typeof value === 'string' && Boolean(gateMessages[value])) : [] },
  };
}
