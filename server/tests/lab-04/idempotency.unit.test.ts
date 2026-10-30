import { describe, expect, it } from 'vitest';
import { actionFingerprint, parseCreateAction, validateIdempotencyKey } from '../../src/lib/actionValidation.js';

const context = { actorId: 5, ticketCreatedAt: new Date('2026-10-01T00:00:00Z'), now: new Date('2026-10-05T05:00:00Z') };
const body = { expectedTicketVersion: 1, actionAt: '2026-10-05T05:00:00Z', description: 'Inspect adapter', followUpRequired: false };

describe('Lab 4 UNIT-07: create-action intent fingerprints', () => {
  it('excludes versions and normalizes equivalent business values', () => {
    const a = parseCreateAction(body, context);
    const b = parseCreateAction({ ...body, expectedTicketVersion: 8, actionAt: '2026-10-05T12:00:00+07:00', assigneeId: 5, description: '  Inspect adapter ', result: '', attachmentNotes: null }, context);
    expect(actionFingerprint(a)).toBe(actionFingerprint(b));
    expect(actionFingerprint(a)).toMatch(/^[a-f0-9]{64}$/);
  });
  it.each([{ description: 'Changed' }, { assigneeId: 6 }, { result: 'Result' }, { actionAt: '2026-10-05T04:59:00Z' }, { followUpRequired: true, followUpNote: 'Call' }, { attachmentNotes: 'File' }])('distinguishes changed payload %j', change => {
    expect(actionFingerprint(parseCreateAction({ ...body, ...change }, context))).not.toBe(actionFingerprint(parseCreateAction(body, context)));
  });
  it('normalizes a valid UUID', () => {
    expect(validateIdempotencyKey('123E4567-E89B-42D3-A456-426614174000')).toBe('123e4567-e89b-42d3-a456-426614174000');
  });
  it.each([undefined, '', '123', ['123e4567-e89b-42d3-a456-426614174000'], '123e4567-e89b-02d3-a456-426614174000'])('rejects invalid key %j', key => {
    expect(() => validateIdempotencyKey(key)).toThrow();
  });
});
