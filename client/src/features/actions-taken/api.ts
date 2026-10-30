import { apiFetch } from '../../lib/api.js';
import type { ActionDTO, ActionPageState, ActionRevision, ActionStatus, PageInfo } from './types.js';

export interface ActionBusinessInput {
  actionAt: string;
  description: string;
  result: string | null;
  assigneeId: number;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
}
export interface CreateActionBody extends ActionBusinessInput { expectedTicketVersion: number }
export interface UpdateActionBody extends Partial<ActionBusinessInput> {
  expectedTicketVersion: number;
  expectedVersion: number;
  status?: ActionStatus;
  cancellationReason?: string | null;
}
export interface ActionEnvelope { data: ActionDTO; ticketVersion: number }
export type ActionListEnvelope = Omit<Extract<ActionPageState, { status: 'ready' }>, 'status'>;
export interface ActionHistoryEnvelope { data: ActionRevision[]; pagination: PageInfo }
export interface ActionOwner { id: number; name: string }

const errorCodes = new Set([
  'VALIDATION_ERROR', 'INVALID_ASSIGNEE', 'INVALID_TRANSITION', 'UNAUTHENTICATED',
  'FORBIDDEN', 'PASSWORD_CHANGE_REQUIRED', 'ACCOUNT_INACTIVE', 'NOT_FOUND',
  'STALE_UPDATE', 'IDEMPOTENCY_CONFLICT', 'ACTION_READ_ONLY', 'PAYLOAD_TOO_LARGE',
  'INTERNAL_ERROR', 'NETWORK_ERROR',
]);
const fieldMessages: Record<string, string> = {
  actionAt: 'Enter a valid action date and time.',
  description: 'Enter a description of no more than 2000 characters.',
  result: 'Check the action result (maximum 2000 characters).',
  assigneeId: 'Select an active staff member or administrator.',
  followUpRequired: 'Check whether follow-up is required.',
  followUpNote: 'Check the follow-up note (maximum 2000 characters).',
  attachmentNotes: 'Use no more than 1000 characters for attachment notes.',
  cancellationReason: 'Enter a cancellation reason of no more than 500 characters.',
  status: 'Select an allowed action status.',
  expectedTicketVersion: 'Reload the latest ticket before saving.',
  expectedVersion: 'Reload the latest action before saving.',
  idempotencyKey: 'Retry with the original action request.',
  body: 'Check the action fields before saving.',
};
function safeMessage(status: number): string {
  if (status === 0) return 'Could not connect. Your action draft has been kept.';
  if (status === 400) return 'Please check the action fields.';
  if (status === 401) return 'Sign in again to continue.';
  if (status === 403) return 'You do not have permission to perform this action.';
  if (status === 404) return 'This ticket or action could not be found.';
  if (status === 409) return 'This action changed or is read-only. Reload the latest information before saving.';
  if (status === 413) return 'The action request is too large.';
  if (status === 429) return 'Too many requests. Please try again shortly.';
  return 'Could not complete the action request. Please try again.';
}

/** Never display server-controlled messages or arbitrary validation details. */
export class ActionApiError extends Error {
  readonly code: string;
  readonly fields: Record<string, string>;
  constructor(readonly status: number, code: string, fields?: unknown) {
    super(safeMessage(status));
    this.name = 'ActionApiError';
    this.code = errorCodes.has(code) ? code : 'INTERNAL_ERROR';
    this.fields = {};
    if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
      for (const key of Object.keys(fields)) {
        if (Object.prototype.hasOwnProperty.call(fieldMessages, key)) this.fields[key] = fieldMessages[key];
      }
    }
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await apiFetch(url, { cache: 'no-store', ...init });
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') throw error;
    throw new ActionApiError(0, 'NETWORK_ERROR');
  }
  const body = await response.json().catch((error: unknown) => {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') throw error;
    return null;
  });
  if (!response.ok) {
    throw new ActionApiError(response.status, typeof body?.error?.code === 'string' ? body.error.code : 'INTERNAL_ERROR', body?.error?.details?.fields);
  }
  if (body === null) throw new ActionApiError(502, 'INTERNAL_ERROR');
  return body as T;
}
function actionPath(ticketId: number, actionId?: number): string {
  return `/api/tickets/${ticketId}/actions${actionId === undefined ? '' : `/${actionId}`}`;
}
export function fetchActions(ticketId: number, page: number, pageSize: PageInfo['pageSize'], signal?: AbortSignal): Promise<ActionListEnvelope> {
  return request(`${actionPath(ticketId)}?${new URLSearchParams({ page: String(page), pageSize: String(pageSize) })}`, { signal });
}
export function fetchAction(ticketId: number, actionId: number, signal?: AbortSignal): Promise<ActionEnvelope> {
  return request(actionPath(ticketId, actionId), { signal });
}
export function fetchActionHistory(ticketId: number, actionId: number, page: number, signal?: AbortSignal): Promise<ActionHistoryEnvelope> {
  return request(`${actionPath(ticketId, actionId)}/history?${new URLSearchParams({ page: String(page), pageSize: '10' })}`, { signal });
}
export function fetchActionOwners(signal?: AbortSignal): Promise<ActionOwner[]> {
  return request('/api/queue/owners', { signal });
}
export function createAction(ticketId: number, body: CreateActionBody, key: string): Promise<ActionEnvelope> {
  return request(actionPath(ticketId), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) });
}
export function updateAction(ticketId: number, actionId: number, body: UpdateActionBody): Promise<ActionEnvelope> {
  return request(actionPath(ticketId, actionId), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
