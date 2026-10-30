import { describe, expect, it } from 'vitest';
import { ActionValidationError, parseUpdateAction, type ActionRecordFields } from '../../src/lib/actionValidation.js';

const context = { ticketCreatedAt: new Date('2026-10-01T00:00:00Z'), now: new Date('2026-10-05T05:00:00Z') };
const current: ActionRecordFields = {
  actionAt: '2026-10-05T05:00:00.000Z', description: 'Inspect', result: null,
  assigneeId: 5, followUpRequired: true, followUpNote: 'Call requester',
  attachmentNotes: null, status: 'PLANNED', cancellationReason: null,
};
const versions = { expectedTicketVersion: 7, expectedVersion: 2 };

describe('Lab 4 PATCH validation: validate the resulting action', () => {
  it('preserves omitted fields and normalizes supplied fields', () => {
    expect(parseUpdateAction({ ...versions, description: ' New description ' }, current, context))
      .toEqual({ ...current, ...versions, description: 'New description' });
  });
  it('clears the historical follow-up note when explicitly disabling follow-up', () => {
    expect(parseUpdateAction({ ...versions, followUpRequired: false }, current, context))
      .toMatchObject({ followUpRequired: false, followUpNote: null });
    expect(current.followUpNote).toBe('Call requester');
  });
  it('requires a note when enabling follow-up', () => {
    expect(() => parseUpdateAction({ ...versions, followUpRequired: true }, { ...current, followUpRequired: false, followUpNote: null }, context)).toThrow();
  });
  it('allows changing a note while retaining true follow-up', () => {
    expect(parseUpdateAction({ ...versions, followUpNote: ' New note ' }, current, context).followUpNote).toBe('New note');
  });
  it.each([null, [], 'body', versions])('rejects malformed/empty update %j', body => {
    expect(() => parseUpdateAction(body, current, context)).toThrow();
  });
  it.each(['expectedVersion', 'expectedTicketVersion'])('requires valid %s', key => {
    for (const value of [undefined, null, 0, -1, 1.5, '2', Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => parseUpdateAction({ ...versions, description: 'New', [key]: value }, current, context)).toThrow();
    }
  });
  it.each(['performedById', 'updatedById', 'ticketId', 'createdAt', 'version', '__proto__'])('rejects protected field %s', key => {
    expect(() => parseUpdateAction({ ...versions, description: 'New', [key]: 5 }, current, context)).toThrow();
  });
  it.each([{ description: null }, { assigneeId: null }, { followUpRequired: 'false' }, { status: 'UNKNOWN' }, { actionAt: '2026-02-30T00:00:00Z' }, { actionAt: '2026-10-05T05:05:00.001Z' }, { followUpRequired: false, followUpNote: 'Keep' }])('rejects invalid supplied patch %j', patch => {
    expect(() => parseUpdateAction({ ...versions, ...patch }, current, context)).toThrow();
  });
  it('normalizes timestamps and nullable optional text', () => {
    expect(parseUpdateAction({ ...versions, actionAt: '2026-10-05T12:00:00+07:00', result: ' ', attachmentNotes: ' File ' }, current, context))
      .toMatchObject({ actionAt: '2026-10-05T05:00:00.000Z', result: null, attachmentNotes: 'File' });
  });
  it.each([{ toString: 1 }, Object.create(null), [], 1, null])('returns validation error for malformed status %j', status => {
    expect(() => parseUpdateAction({ ...versions, status }, current, context)).toThrow(ActionValidationError);
  });
  it('completes with an atomic field/status update', () => {
    expect(parseUpdateAction({ ...versions, status: 'COMPLETED', result: ' Fixed ', followUpRequired: false }, { ...current, status: 'IN_PROGRESS' }, context))
      .toMatchObject({ status: 'COMPLETED', result: 'Fixed', followUpRequired: false, followUpNote: null });
  });
  it.each([{ status: 'COMPLETED' }, { status: 'COMPLETED', result: 'Fixed' }, { status: 'COMPLETED', followUpRequired: false }])('rejects incomplete resulting completion %j', patch => {
    expect(() => parseUpdateAction({ ...versions, ...patch }, { ...current, status: 'IN_PROGRESS' }, context)).toThrow();
  });
  it('cancels while retaining historical follow-up information', () => {
    expect(parseUpdateAction({ ...versions, status: 'CANCELLED', cancellationReason: ' Duplicate ' }, current, context))
      .toMatchObject({ status: 'CANCELLED', cancellationReason: 'Duplicate', followUpRequired: true, followUpNote: 'Call requester' });
  });
  it.each(['', ' ', null, 'x'.repeat(501)])('rejects invalid cancellation reason %j', cancellationReason => {
    expect(() => parseUpdateAction({ ...versions, status: 'CANCELLED', cancellationReason }, current, context)).toThrow();
  });
  it('rejects a cancellation reason outside cancellation', () => {
    expect(() => parseUpdateAction({ ...versions, cancellationReason: 'Duplicate' }, current, context)).toThrow();
  });
  it.each(['PLANNED', 'COMPLETED'])('rejects same-state/skipped edge to %s', status => {
    expect(() => parseUpdateAction({ ...versions, status }, current, context)).toThrow();
  });
  it.each(['COMPLETED', 'CANCELLED'] as const)('rejects editing terminal %s action', status => {
    expect(() => parseUpdateAction({ ...versions, description: 'New' }, { ...current, status }, context)).toThrow(expect.objectContaining({ code: 'ACTION_READ_ONLY' }));
  });
});
