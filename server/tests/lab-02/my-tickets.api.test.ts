import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { ticketFindMany, ticketCount } = vi.hoisted(() => ({
  ticketFindMany: vi.fn(),
  ticketCount: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    ticket: { findMany: ticketFindMany, count: ticketCount },
  },
}));

import request from 'supertest';
import app from '../../src/app.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function makeTicket(overrides: object = {}) {
  return {
    id: 1,
    ticketNumber: 'TKT-2026-000001',
    requesterId: 1,
    categoryId: 2,
    relatedSystemId: 3,
    summary: 'Laptop battery drains quickly',
    requestedPriority: 'MEDIUM',
    currentStatus: 'NEW',
    ticketDate: new Date('2026-08-20T09:14:00.000Z'),
    createdAt: new Date('2026-08-20T09:14:00.000Z'),
    updatedAt: new Date('2026-08-20T09:14:00.000Z'),
    category: { name: 'Hardware' },
    relatedSystem: { name: 'Corporate Laptop' },
    ...overrides,
  };
}

function setupList(tickets: object[], total?: number) {
  ticketFindMany.mockResolvedValue(tickets);
  ticketCount.mockResolvedValue(total ?? tickets.length);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GET /api/tickets', () => {
  beforeEach(() => vi.clearAllMocks());

  // API-10: returns only the requester's tickets
  describe('API-10 — returns tickets for the specified requester', () => {
    beforeEach(() => setupList([makeTicket()]));

    it('returns 200 with data array and pagination', async () => {
      const res = await request(app).get('/api/tickets?requesterId=1');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });

    it('calls findMany with the correct requesterId filter', async () => {
      await request(app).get('/api/tickets?requesterId=1');
      const callArgs = ticketFindMany.mock.calls[0][0];
      expect(callArgs.where.requesterId).toBe(1);
    });

    it('returns 400 when requesterId is missing', async () => {
      const res = await request(app).get('/api/tickets');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // API-12: search filters by ticketNumber or summary
  describe('API-12 — search parameter', () => {
    beforeEach(() => setupList([makeTicket()]));

    it('passes search as contains filter on ticketNumber and summary', async () => {
      await request(app).get('/api/tickets?requesterId=1&search=laptop');
      const callArgs = ticketFindMany.mock.calls[0][0];
      expect(callArgs.where.OR).toBeDefined();
      const orConditions = callArgs.where.OR as Array<Record<string, unknown>>;
      const fields = orConditions.map((c) => Object.keys(c)[0]);
      expect(fields).toContain('ticketNumber');
      expect(fields).toContain('summary');
    });
  });

  // API-13: category filter
  describe('API-13 — categoryId filter', () => {
    beforeEach(() => setupList([makeTicket()]));

    it('passes categoryId filter to Prisma', async () => {
      await request(app).get('/api/tickets?requesterId=1&categoryId=2');
      const callArgs = ticketFindMany.mock.calls[0][0];
      expect(callArgs.where.categoryId).toBe(2);
    });
  });

  // API-14: priority filter
  describe('API-14 — priority filter', () => {
    beforeEach(() => setupList([makeTicket()]));

    it('passes requestedPriority filter to Prisma', async () => {
      await request(app).get('/api/tickets?requesterId=1&priority=HIGH');
      const callArgs = ticketFindMany.mock.calls[0][0];
      expect(callArgs.where.requestedPriority).toBe('HIGH');
    });
  });

  // API-15: pagination metadata
  describe('API-15 — pagination metadata', () => {
    beforeEach(() => setupList(Array.from({ length: 10 }, (_, i) => makeTicket({ id: i + 11 })), 42));

    it('returns correct pagination metadata for page 2', async () => {
      const res = await request(app).get('/api/tickets?requesterId=1&page=2&pageSize=10');
      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(2);
      expect(res.body.pagination.pageSize).toBe(10);
      expect(res.body.pagination.total).toBe(42);
      expect(res.body.pagination.totalPages).toBe(5);
    });

    it('passes correct skip/take to Prisma for page 2', async () => {
      await request(app).get('/api/tickets?requesterId=1&page=2&pageSize=10');
      const callArgs = ticketFindMany.mock.calls[0][0];
      expect(callArgs.skip).toBe(10);
      expect(callArgs.take).toBe(10);
    });
  });

  // API-16: invalid page is clamped to 1 (BR-24)
  describe('API-16 — invalid page clamped to 1', () => {
    beforeEach(() => setupList([makeTicket()]));

    it('clamps page=-1 to page=1', async () => {
      const res = await request(app).get('/api/tickets?requesterId=1&page=-1');
      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(1);
    });
  });

  // API-17: no match returns empty data not 404 (AC-14, BR-23)
  describe('API-17 — no results returns empty data array', () => {
    beforeEach(() => setupList([], 0));

    it('returns 200 with empty data array and total 0', async () => {
      const res = await request(app).get('/api/tickets?requesterId=1&search=zzznomatch');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination.total).toBe(0);
    });
  });

  // API-18: sort parameter
  describe('API-18 — sort by createdAt asc', () => {
    beforeEach(() => setupList([makeTicket()]));

    it('passes the correct orderBy to Prisma', async () => {
      await request(app).get('/api/tickets?requesterId=1&sort=createdAt&order=asc');
      const callArgs = ticketFindMany.mock.calls[0][0];
      expect(callArgs.orderBy).toBeDefined();
      const first = callArgs.orderBy[0] as Record<string, string>;
      expect(first['createdAt']).toBe('asc');
    });
  });

  // Server error
  describe('server error handling', () => {
    beforeEach(() => {
      ticketFindMany.mockRejectedValue(new Error('DB error'));
      ticketCount.mockRejectedValue(new Error('DB error'));
    });

    it('returns 500 with safe error envelope', async () => {
      const res = await request(app).get('/api/tickets?requesterId=1');
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
      expect(JSON.stringify(res.body)).not.toContain('DB error');
    });
  });
});
