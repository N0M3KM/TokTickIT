import { describe, expect, it } from 'vitest';
import { TicketStatus, UserRole } from '@prisma/client';
import { allowedTicketTransitions, resolutionReasons, type ResolutionSummary } from '../../src/lib/ticketWorkflow.js';

const summary: ResolutionSummary = { hasOwner: true, eligibleOwner: true, completed: 1, active: 0, followUp: 0, reopened: false, freshCompleted: 0 };
const staffMatrix: Record<TicketStatus, string[]> = {
  NEW: ['OPEN', 'CANCELLED'], OPEN: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'], WAITING_FOR_REQUESTER: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'REOPENED'], CLOSED: ['REOPENED'], REOPENED: ['IN_PROGRESS', 'CANCELLED'], CANCELLED: [],
};
describe('complete ticket matrix', () => {
  for (const from of Object.values(TicketStatus)) {
    for (const role of Object.values(UserRole)) {
      it(`${role} edges from ${from}`, () => {
        const expected = role === 'REQUESTER' ? ['RESOLVED', 'CLOSED'].includes(from) ? ['REOPENED'] : [] : staffMatrix[from];
        expect(allowedTicketTransitions(from, role).sort()).toEqual([...expected].sort());
        expect(allowedTicketTransitions(from, role)).not.toContain(from);
      });
    }
  }
});
describe('resolution evidence', () => {
  it('accepts eligible completed work without open actions or follow-up', () => expect(resolutionReasons(summary)).toEqual([]));
  it.each([
    [{ hasOwner: false, eligibleOwner: false }, ['OWNER_REQUIRED']],
    [{ eligibleOwner: false }, ['OWNER_INACTIVE']],
    [{ completed: 0 }, ['NO_COMPLETED_ACTION']],
    [{ active: 2 }, ['OPEN_ACTIONS']],
    [{ followUp: 1 }, ['FOLLOW_UP_OUTSTANDING']],
    [{ reopened: true }, ['FRESH_WORK_REQUIRED']],
  ] as [Partial<ResolutionSummary>, string[]][])('explains gate %j', (override, expected) => {
    expect(resolutionReasons({ ...summary, ...override })).toEqual(expected);
  });
  it('requires newly created completed work after reopening', () => {
    expect(resolutionReasons({ ...summary, reopened: true, freshCompleted: 1 })).toEqual([]);
  });
  it('reports all unmet conditions without losing reasons', () => {
    expect(resolutionReasons({ ...summary, hasOwner: false, completed: 0, active: 1, followUp: 1, reopened: true })).toEqual([
      'OWNER_REQUIRED', 'NO_COMPLETED_ACTION', 'OPEN_ACTIONS', 'FOLLOW_UP_OUTSTANDING', 'FRESH_WORK_REQUIRED',
    ]);
  });
});
