import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Transition matrix validator (pure logic — no DB needed)
// We define the allowed transitions inline here so the test is self-contained.
// The route will import this same logic from lib/ticketStatus.ts
// ---------------------------------------------------------------------------

type Status =
  | 'NEW' | 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_REQUESTER'
  | 'RESOLVED' | 'CLOSED' | 'REOPENED' | 'CANCELLED';

const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  NEW:                    ['OPEN', 'CANCELLED'],
  OPEN:                   ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'CANCELLED'],
  IN_PROGRESS:            ['WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
  WAITING_FOR_REQUESTER:  ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED:               ['CLOSED', 'REOPENED'],
  CLOSED:                 ['REOPENED'],
  REOPENED:               ['IN_PROGRESS', 'CANCELLED'],
  CANCELLED:              [],
};

function isAllowedTransition(from: Status, to: Status): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

// ── UNIT-05: valid transition NEW → OPEN ──────────────────────────────────
describe('UNIT-05 — valid transition NEW → OPEN', () => {
  it('returns true', () => {
    expect(isAllowedTransition('NEW', 'OPEN')).toBe(true);
  });

  it('NEW → CANCELLED is also allowed', () => {
    expect(isAllowedTransition('NEW', 'CANCELLED')).toBe(true);
  });

  it('IN_PROGRESS → RESOLVED is allowed', () => {
    expect(isAllowedTransition('IN_PROGRESS', 'RESOLVED')).toBe(true);
  });

  it('RESOLVED → CLOSED is allowed', () => {
    expect(isAllowedTransition('RESOLVED', 'CLOSED')).toBe(true);
  });

  it('RESOLVED → REOPENED is allowed', () => {
    expect(isAllowedTransition('RESOLVED', 'REOPENED')).toBe(true);
  });

  it('CLOSED → REOPENED is allowed', () => {
    expect(isAllowedTransition('CLOSED', 'REOPENED')).toBe(true);
  });
});

// ── UNIT-06: invalid transition CLOSED → NEW ─────────────────────────────
describe('UNIT-06 — invalid transition CLOSED → NEW', () => {
  it('returns false', () => {
    expect(isAllowedTransition('CLOSED', 'NEW')).toBe(false);
  });

  it('NEW → RESOLVED is not allowed (skip steps)', () => {
    expect(isAllowedTransition('NEW', 'RESOLVED')).toBe(false);
  });

  it('CANCELLED → OPEN is not allowed', () => {
    expect(isAllowedTransition('CANCELLED', 'OPEN')).toBe(false);
  });

  it('RESOLVED → IN_PROGRESS is not allowed', () => {
    expect(isAllowedTransition('RESOLVED', 'IN_PROGRESS')).toBe(false);
  });

  it('NEW → IN_PROGRESS is not allowed (must go through OPEN first)', () => {
    expect(isAllowedTransition('NEW', 'IN_PROGRESS')).toBe(false);
  });
});
