import { describe, expect, it } from 'vitest';
import { parseCreateAction, ActionValidationError } from '../../src/lib/actionValidation.js';

const context = { actorId: 5, ticketCreatedAt: new Date('2026-10-01T00:00:00Z'), now: new Date('2026-10-05T05:00:00Z') };
const valid = () => ({ expectedTicketVersion: 1, actionAt: '2026-10-05T12:00:00+07:00', description: '  Inspect adapter  ', followUpRequired: false });

describe('Lab 4 UNIT-01: create-action DTO validation', () => {
  it('normalizes timestamp/text and defaults assignee', () => {
    expect(parseCreateAction(valid(), context)).toEqual({ expectedTicketVersion: 1, actionAt: '2026-10-05T05:00:00.000Z', description: 'Inspect adapter', result: null, assigneeId: 5, followUpRequired: false, followUpNote: null, attachmentNotes: null });
  });
  it.each([null, [], 'body', 5])('rejects non-object body %j', body => {
    expect(() => parseCreateAction(body, context)).toThrow(ActionValidationError);
  });
  it.each(['performedById', 'updatedById', 'ticketId', 'createdAt', 'status', '__proto__'])('rejects protected/unknown key %s', key => {
    expect(() => parseCreateAction({ ...valid(), [key]: 1 }, context)).toThrow();
  });
  it.each([0, -1, 1.5, '1', Number.MAX_SAFE_INTEGER + 1, null])('rejects invalid version %j', version => {
    expect(() => parseCreateAction({ ...valid(), expectedTicketVersion: version }, context)).toThrow();
  });
  it.each([0, -1, 1.5, '6', null, Number.MAX_SAFE_INTEGER + 1])('rejects malformed assignee %j', assigneeId => {
    expect(() => parseCreateAction({ ...valid(), assigneeId }, context)).toThrow();
  });
  it.each([true, 'false', 0, null, undefined])('requires boolean or valid true/note pair %j', followUpRequired => {
    expect(() => parseCreateAction({ ...valid(), followUpRequired }, context)).toThrow();
  });
  it('accepts another assignee and trims follow-up', () => {
    expect(parseCreateAction({ ...valid(), assigneeId: 6, followUpRequired: true, followUpNote: ' Call requester ' }, context)).toMatchObject({ assigneeId: 6, followUpNote: 'Call requester' });
  });
  it.each(['', '   ', null])('rejects blank description %j', description => {
    expect(() => parseCreateAction({ ...valid(), description }, context)).toThrow();
  });
  it.each(['description', 'result', 'followUpNote', 'attachmentNotes'])('checks text boundary for %s', field => {
    const limit = field === 'attachmentNotes' ? 1000 : 2000;
    const body = { ...valid(), followUpRequired: field === 'followUpNote', [field]: 'x'.repeat(limit) };
    expect(() => parseCreateAction(body, context)).not.toThrow();
    expect(() => parseCreateAction({ ...body, [field]: 'x'.repeat(limit + 1) }, context)).toThrow();
  });
  it('rejects a note when follow-up is false', () => {
    expect(() => parseCreateAction({ ...valid(), followUpNote: 'pending' }, context)).toThrow();
  });
  it.each(['2026-10-05T05:00:00', 'bad', '2026-02-30T05:00:00Z', '2026-10-05T24:00:00Z', '2026-10-05T05:60:00Z', '2026-09-30T23:59:59.999Z', '2026-10-05T05:05:00.001Z'])('rejects invalid/out-of-window instant %s', actionAt => {
    expect(() => parseCreateAction({ ...valid(), actionAt }, context)).toThrow();
  });
  it.each(['2026-10-01T00:00:00Z', '2026-10-05T05:05:00Z'])('accepts inclusive date boundary %s', actionAt => {
    expect(() => parseCreateAction({ ...valid(), actionAt }, context)).not.toThrow();
  });
  it('returns safe field-level errors', () => {
    try {
      parseCreateAction({ ...valid(), description: '', passwordHash: 'DO_NOT_ECHO' }, context);
      throw new Error('Expected validation rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(ActionValidationError);
      expect((error as ActionValidationError).fields.description).toBeDefined();
      expect(JSON.stringify(error)).not.toContain('DO_NOT_ECHO');
    }
  });
});
