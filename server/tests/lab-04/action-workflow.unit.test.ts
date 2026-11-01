import { describe, expect, it } from 'vitest';
import { validateActionTransition, type ActionStatus } from '../../src/lib/actionValidation.js';

const states: ActionStatus[] = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const allowed = new Set(['PLANNED:IN_PROGRESS', 'PLANNED:CANCELLED', 'IN_PROGRESS:COMPLETED', 'IN_PROGRESS:CANCELLED']);
const fields = { result: 'Adapter replaced', followUpRequired: false, followUpNote: null, cancellationReason: 'Duplicate work', assigneeIsActive: true };

describe('Lab 4 UNIT-02: action lifecycle', () => {
  for (const from of states) for (const to of states) {
    it(`${from} -> ${to} follows the exhaustive matrix`, () => {
      const check = () => validateActionTransition(from, to, fields);
      if (allowed.has(`${from}:${to}`)) expect(check).not.toThrow();
      else expect(check).toThrow();
    });
  }
  it.each(['', '  ', null])('requires completion result %j', result => {
    expect(() => validateActionTransition('IN_PROGRESS', 'COMPLETED', { ...fields, result })).toThrow();
  });
  it('rejects completing outstanding follow-up', () => {
    expect(() => validateActionTransition('IN_PROGRESS', 'COMPLETED', { ...fields, followUpRequired: true, followUpNote: 'Call' })).toThrow();
  });
  it.each(['', '  ', null, 'x'.repeat(501)])('requires bounded cancellation reason %j', cancellationReason => {
    expect(() => validateActionTransition('PLANNED', 'CANCELLED', { ...fields, cancellationReason })).toThrow();
  });
  it.each([['PLANNED', 'IN_PROGRESS'], ['IN_PROGRESS', 'COMPLETED']] as const)('requires eligible assignee for %s -> %s', (from, to) => {
    expect(() => validateActionTransition(from, to, { ...fields, assigneeIsActive: false })).toThrow();
  });
  it('allows cancelling inactive-assigned work', () => {
    expect(() => validateActionTransition('PLANNED', 'CANCELLED', { ...fields, assigneeIsActive: false })).not.toThrow();
  });
});
