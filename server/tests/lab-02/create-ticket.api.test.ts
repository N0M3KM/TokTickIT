import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist all mocks before imports
// ---------------------------------------------------------------------------
const {
  userFindUnique,
  ticketCreate,
  userFindFirst,
  categoryFindFirst,
  relatedSystemFindFirst,
  ticketCount,
  transactionFn,
} = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  ticketCreate: vi.fn(),
  userFindFirst: vi.fn(),
  categoryFindFirst: vi.fn(),
  relatedSystemFindFirst: vi.fn(),
  ticketCount: vi.fn(),
  transactionFn: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    ticket: { create: ticketCreate, count: ticketCount },
    user: { findFirst: userFindFirst, findUnique: userFindUnique },
    category: { findFirst: categoryFindFirst },
    relatedSystem: { findFirst: relatedSystemFindFirst },
    $transaction: transactionFn,
  },
}));

import request from 'supertest';
import app from '../../src/app.js';
import { signToken } from '../../src/lib/auth.js';

// Lab 3 replaced caller-selected requester IDs with verified cookie sessions.
// Keep requireAuth/requirePasswordChanged real; mock only their database reads.
const requesterCookie = (id = 1) => `tkt_token=${signToken(id, 'REQUESTER')}`;
beforeEach(() => {
  vi.stubEnv('JWT_SECRET', 'lab2-authenticated-regression-fixture-only');
  userFindUnique.mockImplementation(async ({ where }: { where: { id: number } }) => ({ id: where.id, isActive: true, mustChangePassword: false, role: 'REQUESTER' }));
});
afterEach(() => vi.unstubAllEnvs());

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const validBody = {
  categoryId: 2,
  relatedSystemId: 3,
  summary: 'Laptop battery drains quickly',
  description: 'Battery drains faster than usual after Windows update.',
  requestedPriority: 'MEDIUM',
};

const mockRequester = { id: 1, name: 'Somchai Jaidee' };
const mockCategory  = { id: 2, name: 'Hardware' };
const mockSystem    = { id: 3, name: 'Corporate Laptop' };

const mockTicket = {
  id: 42,
  ticketNumber: 'TKT-2026-000042',
  requesterId: 1,
  categoryId: 2,
  relatedSystemId: 3,
  summary: 'Laptop battery drains quickly',
  description: 'Battery drains faster than usual after Windows update.',
  requestedPriority: 'MEDIUM',
  currentStatus: 'NEW',
  ticketDate: new Date('2026-08-20T09:14:00.000Z'),
  createdAt: new Date('2026-08-20T09:14:00.000Z'),
  updatedAt: new Date('2026-08-20T09:14:00.000Z'),
  requester: { name: 'Somchai Jaidee' },
  category: { name: 'Hardware' },
  relatedSystem: { name: 'Corporate Laptop' },
  attachments: [],
};

function setupHappyPath() {
  userFindFirst.mockResolvedValue(mockRequester);
  categoryFindFirst.mockResolvedValue(mockCategory);
  relatedSystemFindFirst.mockResolvedValue(mockSystem);
  // $transaction calls the callback with the prisma tx object
  transactionFn.mockImplementation(async (fn: (tx: unknown) => Promise<string>) => {
    return fn({ ticket: { count: ticketCount } });
  });
  ticketCount.mockResolvedValue(41); // so next number is 42
  ticketCreate.mockResolvedValue(mockTicket);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('POST /api/tickets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // API-01: valid ticket creation returns 201 + ticketNumber
  describe('API-01 — valid ticket creation', () => {
    beforeEach(setupHappyPath);

    it('returns 201 on success', async () => {
      const res = await request(app).post('/api/tickets').set('Cookie', requesterCookie()).send(validBody);
      expect(res.status).toBe(201);
      expect(ticketCreate.mock.calls[0][0].data.requesterId).toBe(1);
    });

    it('ignores a forged requesterId and creates only for the authenticated requester', async () => {
      const res = await request(app).post('/api/tickets').set('Cookie', requesterCookie()).send({ ...validBody, requesterId: 99 });
      expect(res.status).toBe(201);
      expect(ticketCreate.mock.calls[0][0].data.requesterId).toBe(1);
      expect(userFindFirst.mock.calls[0][0].where.id).toBe(1);
    });

    it('returns ticketNumber matching TKT-YYYY-NNNNNN', async () => {
      const res = await request(app).post('/api/tickets').set('Cookie', requesterCookie()).send(validBody);
      expect(res.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    });

    it('returns id, requesterId, categoryId, and summary in response', async () => {
      const res = await request(app).post('/api/tickets').set('Cookie', requesterCookie()).send(validBody);
      expect(res.body).toMatchObject({
        id: 42,
        requesterId: 1,
        categoryId: 2,
        summary: 'Laptop battery drains quickly',
      });
    });

    // API-02: currentStatus is NEW
    it('API-02 — response contains currentStatus: NEW', async () => {
      const res = await request(app).post('/api/tickets').set('Cookie', requesterCookie()).send(validBody);
      expect(res.body.currentStatus).toBe('NEW');
    });

    // API-03: ticketDate is set by server
    it('API-03 — response contains ticketDate as a timestamp', async () => {
      const res = await request(app).post('/api/tickets').set('Cookie', requesterCookie()).send(validBody);
      expect(res.body.ticketDate).toBeTruthy();
      expect(new Date(res.body.ticketDate).toString()).not.toBe('Invalid Date');
    });

    it('includes empty attachments array', async () => {
      const res = await request(app).post('/api/tickets').set('Cookie', requesterCookie()).send(validBody);
      expect(res.body.attachments).toEqual([]);
    });
  });

  // API-04: empty summary → 400 with field error
  describe('API-04 — empty summary', () => {
    beforeEach(setupHappyPath);

    it('returns 400 with summary field error', async () => {
      const res = await request(app)
        .post('/api/tickets').set('Cookie', requesterCookie())
        .send({ ...validBody, summary: '' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.fields.summary).toBeTruthy();
    });

    it('does not call ticket.create when summary is empty', async () => {
      await request(app).post('/api/tickets').set('Cookie', requesterCookie()).send({ ...validBody, summary: '' });
      expect(ticketCreate).not.toHaveBeenCalled();
    });
  });

  // API-05: summary > 200 chars
  describe('API-05 — summary > 200 chars', () => {
    beforeEach(setupHappyPath);

    it('returns 400 with summary field error', async () => {
      const res = await request(app)
        .post('/api/tickets').set('Cookie', requesterCookie())
        .send({ ...validBody, summary: 'a'.repeat(201) });
      expect(res.status).toBe(400);
      expect(res.body.error.fields.summary).toMatch(/200/);
    });
  });

  // API-06: empty description
  describe('API-06 — empty description', () => {
    beforeEach(setupHappyPath);

    it('returns 400 with description field error', async () => {
      const res = await request(app)
        .post('/api/tickets').set('Cookie', requesterCookie())
        .send({ ...validBody, description: '' });
      expect(res.status).toBe(400);
      expect(res.body.error.fields.description).toBeTruthy();
    });
  });

  // API-07: invalid requestedPriority
  describe('API-07 — invalid requestedPriority', () => {
    beforeEach(setupHappyPath);

    it('returns 400 with requestedPriority field error', async () => {
      const res = await request(app)
        .post('/api/tickets').set('Cookie', requesterCookie())
        .send({ ...validBody, requestedPriority: 'URGENT' });
      expect(res.status).toBe(400);
      expect(res.body.error.fields.requestedPriority).toBeTruthy();
    });
  });

  // API-08: non-existent categoryId
  describe('API-08 — non-existent categoryId', () => {
    beforeEach(() => {
      userFindFirst.mockResolvedValue(mockRequester);
      categoryFindFirst.mockResolvedValue(null); // category not found
      relatedSystemFindFirst.mockResolvedValue(mockSystem);
      transactionFn.mockImplementation(async (fn: (tx: unknown) => Promise<string>) =>
        fn({ ticket: { count: ticketCount } }),
      );
      ticketCount.mockResolvedValue(0);
    });

    it('returns 400 with categoryId field error', async () => {
      const res = await request(app)
        .post('/api/tickets').set('Cookie', requesterCookie())
        .send({ ...validBody, categoryId: 9999 });
      expect(res.status).toBe(400);
      expect(res.body.error.fields.categoryId).toMatch(/not found/i);
    });
  });

  // API-09: all fields invalid returns all errors at once (AC-23)
  describe('API-09 / AC-23 — multiple invalid fields', () => {
    it('returns all field errors in a single response', async () => {
      const res = await request(app).post('/api/tickets').set('Cookie', requesterCookie()).send({
        requesterId: 0,
        categoryId: 0,
        summary: '',
        description: '',
        requestedPriority: 'INVALID',
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(Object.keys(res.body.error.fields).length).toBeGreaterThanOrEqual(4);
    });

    it('does not expose a stack trace', async () => {
      const res = await request(app).post('/api/tickets').set('Cookie', requesterCookie()).send({});
      expect(JSON.stringify(res.body)).not.toContain('stack');
    });
  });

  // Server error safe response
  describe('server error handling', () => {
    beforeEach(() => {
      userFindFirst.mockRejectedValue(new Error('DB down'));
    });

    it('returns 500 with safe INTERNAL_ERROR envelope', async () => {
      const res = await request(app).post('/api/tickets').set('Cookie', requesterCookie()).send(validBody);
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
      expect(JSON.stringify(res.body)).not.toContain('DB down');
    });
  });

  it('requires a real session before creation and does not write for anonymous callers', async () => {
    const res = await request(app).post('/api/tickets').send(validBody);
    expect(res.status).toBe(401); expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(ticketCreate).not.toHaveBeenCalled();
  });
});
