import { createHash } from 'node:crypto';

/** Lab 4 transport validation only. Routes must still authorize and check DB state. */
export class ActionValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';

  constructor(readonly fields: Record<string, string>) {
    super('Please correct the action fields.');
    this.name = 'ActionValidationError';
  }
}

export type ActionStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface CreateActionInput {
  expectedTicketVersion: number;
  actionAt: string;
  description: string;
  result: string | null;
  assigneeId: number;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
}

/** Business snapshot read from the authorized action, not from the request. */
export interface ActionRecordFields extends Omit<CreateActionInput, 'expectedTicketVersion'> {
  status: ActionStatus;
  cancellationReason: string | null;
}

export interface UpdateActionInput extends ActionRecordFields {
  expectedTicketVersion: number;
  expectedVersion: number;
}

interface CreateContext {
  actorId: number;
  ticketCreatedAt: Date;
  now: Date;
}

const CREATE_FIELDS = new Set([
  'expectedTicketVersion', 'actionAt', 'description', 'result', 'assigneeId',
  'followUpRequired', 'followUpNote', 'attachmentNotes',
]);

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function textField(
  value: unknown, field: string, limit: number, required: boolean,
  errors: Record<string, string>,
): string | null {
  if (value === null || value === undefined) {
    if (required) errors[field] = 'This field is required.';
    return null;
  }
  if (typeof value !== 'string') {
    errors[field] = 'Enter plain text.';
    return null;
  }
  const text = value.trim();
  if (required && !text) errors[field] = 'This field is required.';
  if (text.length > limit) errors[field] = `Use no more than ${limit} characters.`;
  return text || null;
}

/** Reject normalized-but-invalid calendar values such as February 30 or 24:00. */
function parseInstant(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offset] = match;
  const [year, month, day, hour, minute, second] = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number);
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > days[month - 1]) return null;
  if (offset !== 'Z' && (Number(offset.slice(1, 3)) > 23 || Number(offset.slice(4, 6)) > 59)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function parseCreateAction(body: unknown, context: CreateContext): CreateActionInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ActionValidationError({ body: 'Send a JSON object.' });
  }
  const input = body as Record<string, unknown>;
  const errors: Record<string, string> = {};
  // Do not echo arbitrary key names (which could contain secrets or HTML) into errors.
  if (Object.keys(input).some(key => !CREATE_FIELDS.has(key))) errors.body = 'Unsupported fields were supplied.';
  if (!positiveInteger(input.expectedTicketVersion)) errors.expectedTicketVersion = 'A positive ticket version is required.';
  const assigneeId = Object.prototype.hasOwnProperty.call(input, 'assigneeId') ? input.assigneeId : context.actorId;
  if (!positiveInteger(assigneeId)) errors.assigneeId = 'Select a valid staff assignee.';

  const description = textField(input.description, 'description', 2000, true, errors);
  const result = textField(input.result, 'result', 2000, false, errors);
  const attachmentNotes = textField(input.attachmentNotes, 'attachmentNotes', 1000, false, errors);
  if (typeof input.followUpRequired !== 'boolean') errors.followUpRequired = 'Use a boolean follow-up flag.';
  const followUpRequired = input.followUpRequired === true;
  const followUpNote = textField(input.followUpNote, 'followUpNote', 2000, followUpRequired, errors);
  if (!followUpRequired && followUpNote) errors.followUpNote = 'Clear the note when follow-up is not required.';

  const actionAt = parseInstant(input.actionAt);
  if (!actionAt) {
    errors.actionAt = 'Use a valid ISO date/time with an explicit time-zone offset.';
  } else if (actionAt.getTime() < context.ticketCreatedAt.getTime() || actionAt.getTime() > context.now.getTime() + 5 * 60_000) {
    errors.actionAt = 'The action must be between ticket creation and five minutes after the current time.';
  }
  if (Object.keys(errors).length) throw new ActionValidationError(errors);

  return {
    expectedTicketVersion: input.expectedTicketVersion as number,
    actionAt: actionAt!.toISOString(), description: description!, result,
    assigneeId: assigneeId as number, followUpRequired, followUpNote, attachmentNotes,
  };
}

const ACTION_TRANSITIONS: Record<ActionStatus, readonly ActionStatus[]> = {
  PLANNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const UPDATE_FIELDS = new Set([...CREATE_FIELDS, 'expectedVersion', 'status', 'cancellationReason']);

export class ActionReadOnlyError extends Error {
  readonly code = 'ACTION_READ_ONLY';

  constructor() {
    super('Completed and cancelled actions are read-only.');
    this.name = 'ActionReadOnlyError';
  }
}

/**
 * Normalize a PATCH against a fresh authorized snapshot. The caller must still
 * enforce parent state, active assignee, versions and atomic revision persistence
 * inside its transaction. This helper neither checks versions nor writes data.
 */
export function parseUpdateAction(
  body: unknown,
  current: ActionRecordFields,
  context: Omit<CreateContext, 'actorId'>,
): UpdateActionInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ActionValidationError({ body: 'Send a JSON object.' });
  }
  const input = body as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const keys = Object.keys(input);
  if (keys.some(key => !UPDATE_FIELDS.has(key))) errors.body = 'Unsupported fields were supplied.';
  if (!keys.some(key => UPDATE_FIELDS.has(key) && key !== 'expectedVersion' && key !== 'expectedTicketVersion')) {
    errors.body = 'Supply at least one action field to update.';
  }
  if (!positiveInteger(input.expectedVersion)) errors.expectedVersion = 'A positive action version is required.';
  if (!positiveInteger(input.expectedTicketVersion)) errors.expectedTicketVersion = 'A positive ticket version is required.';
  const hasStatus = Object.prototype.hasOwnProperty.call(input, 'status');
  if (hasStatus && (typeof input.status !== 'string' || !Object.prototype.hasOwnProperty.call(ACTION_TRANSITIONS, input.status))) {
    errors.status = 'Select a valid action status.';
  }
  if (Object.keys(errors).length) throw new ActionValidationError(errors);
  if (current.status === 'COMPLETED' || current.status === 'CANCELLED') throw new ActionReadOnlyError();

  // Build the create-shaped business fields explicitly; never copy arbitrary keys.
  const merged: Record<string, unknown> = { expectedTicketVersion: input.expectedTicketVersion };
  for (const key of CREATE_FIELDS) {
    if (key === 'expectedTicketVersion') continue;
    merged[key] = Object.prototype.hasOwnProperty.call(input, key)
      ? input[key] : current[key as keyof ActionRecordFields];
  }
  if (input.followUpRequired === false && !Object.prototype.hasOwnProperty.call(input, 'followUpNote')) {
    merged.followUpNote = null;
  }
  const normalized = parseCreateAction(merged, { ...context, actorId: current.assigneeId });
  const status = hasStatus ? input.status as ActionStatus : current.status;
  if (hasStatus && !ACTION_TRANSITIONS[current.status].includes(status)) {
    throw new ActionTransitionError('INVALID_TRANSITION', 'That action status transition is not permitted.');
  }
  const cancelling = hasStatus && status === 'CANCELLED';
  const cancellationReason = textField(input.cancellationReason, 'cancellationReason', 500, cancelling, errors);
  if (!cancelling && cancellationReason !== null) errors.cancellationReason = 'A cancellation reason is only accepted when cancelling.';
  if (status === 'COMPLETED') {
    textField(normalized.result, 'result', 2000, true, errors);
    if (normalized.followUpRequired) errors.followUpRequired = 'Complete the follow-up before completing this action.';
  }
  if (Object.keys(errors).length) throw new ActionValidationError(errors);
  return { ...normalized, expectedVersion: input.expectedVersion as number, status, cancellationReason };
}

export class ActionTransitionError extends Error {
  constructor(readonly code: 'INVALID_TRANSITION' | 'INVALID_ASSIGNEE', message: string) {
    super(message);
    this.name = 'ActionTransitionError';
  }
}

interface TransitionFields {
  result: string | null;
  followUpRequired: boolean;
  followUpNote: string | null;
  cancellationReason: string | null;
  /** Must be computed from fresh DB state, including both active flag and role. */
  assigneeIsActive: boolean;
}

export function validateActionTransition(from: ActionStatus, to: ActionStatus, fields: TransitionFields): void {
  if (!ACTION_TRANSITIONS[from]?.includes(to)) {
    throw new ActionTransitionError('INVALID_TRANSITION', 'That action status transition is not permitted.');
  }
  if (to !== 'CANCELLED' && !fields.assigneeIsActive) {
    throw new ActionTransitionError('INVALID_ASSIGNEE', 'Reassign this action to active IT Staff or an Administrator.');
  }
  const errors: Record<string, string> = {};
  if (to === 'COMPLETED') {
    textField(fields.result, 'result', 2000, true, errors);
    if (fields.followUpRequired) errors.followUpRequired = 'Complete the follow-up before completing this action.';
    if (fields.followUpNote?.trim()) errors.followUpNote = 'Clear the note when follow-up is not required.';
  }
  if (to === 'CANCELLED') textField(fields.cancellationReason, 'cancellationReason', 500, true, errors);
  if (Object.keys(errors).length) throw new ActionValidationError(errors);
}

export function validateIdempotencyKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ActionValidationError({ idempotencyKey: 'Supply a valid UUID Idempotency-Key header.' });
  }
  return value.toLowerCase();
}

/** Input must already be normalized. Scope key uniqueness by creator and ticket in DB. */
export function actionFingerprint(input: CreateActionInput): string {
  const businessIntent = [input.actionAt, input.description, input.result, input.assigneeId,
    input.followUpRequired, input.followUpNote, input.attachmentNotes];
  return createHash('sha256').update(JSON.stringify(businessIntent)).digest('hex');
}
