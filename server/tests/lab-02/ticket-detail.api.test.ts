import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { ticketFindUnique, userFindUnique, actionCount, queryRaw } = vi.hoisted(() => ({
  userFindUnique: vi.fn(), actionCount: vi.fn(), queryRaw: vi.fn(),
  ticketFindUnique: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    ticket: { findUnique: ticketFindUnique },
    user: { findUnique: userFindUnique }, actionTaken: { count: actionCount }, $queryRaw: queryRaw,
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
// Fixtures
// ---------------------------------------------------------------------------
const activeAttachment = {
  id: 7,
  originalFilename: 'report.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 2411724,
  uploadedAt: new Date('2026-08-20T09:20:00.000Z'),
  removedAt: null,
  removalReason: null,
};

const removedAttachment = {
  id: 8,
  originalFilename: 'screenshot.png',
  mimeType: 'image/png',
  sizeBytes: 460800,
  uploadedAt: new Date('2026-08-20T09:21:00.000Z'),
  removedAt: new Date('2026-08-20T10:00:00.000Z'),
  removalReason: 'Uploaded wrong file',
};

const mockTicket = {
  id: 42,
  ticketNumber: 'TKT-2026-000042',
  requesterId: 1,
  categoryId: 2,
  relatedSystemId: 3,
  summary: 'Laptop battery drains quickly',
  description: 'Battery drains faster than usual.',
  requestedPriority: 'MEDIUM',
  currentStatus: 'NEW',
  ticketDate: new Date('2026-08-20T09:14:00.000Z'),
  createdAt: new Date('2026-08-20T09:14:00.000Z'),
  updatedAt: new Date('2026-08-20T09:14:00.000Z'),
  requester: { name: 'Somchai Jaidee' },
  category: { name: 'Hardware' },
  relatedSystem: { name: 'Corporate Laptop' },
  attachments: [activeAttachment, removedAttachment],
  itPriority: 'MEDIUM', ticketOwnerId: null, ticketOwner: null, requesterResolvedAt: null,
  version: 1, resolvedAt: null, reopenedAt: null, resolutionTimeEstimated: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GET /api/tickets/:id', () => {
  beforeEach(() => { vi.clearAllMocks(); actionCount.mockResolvedValue(0); queryRaw.mockResolvedValue([]); });

  // API-31: owned ticket returns 200 with full data
  describe('API-31 — returns owned ticket with attachments', () => {
    beforeEach(() => ticketFindUnique.mockResolvedValue(mockTicket));

    it('returns 200 with ticket fields', async () => {
      const res = await request(app).get('/api/tickets/42').set('Cookie', requesterCookie());
      expect(res.status).toBe(200);
      expect(res.body.ticketNumber).toBe('TKT-2026-000042');
      expect(res.body.summary).toBe('Laptop battery drains quickly');
    });

    it('includes attachments array', async () => {
      const res = await request(app).get('/api/tickets/42').set('Cookie', requesterCookie());
      expect(Array.isArray(res.body.attachments)).toBe(true);
      expect(res.body.attachments).toHaveLength(2);
    });

    it('never exposes storageFilename', async () => {
      const res = await request(app).get('/api/tickets/42').set('Cookie', requesterCookie());
      expect(JSON.stringify(res.body)).not.toContain('storageFilename');
    });
  });

  // API-32: soft-removed attachment is included in the list
  describe('API-32 — soft-removed attachment appears in attachment list', () => {
    beforeEach(() => ticketFindUnique.mockResolvedValue(mockTicket));

    it('includes the removed attachment with removedAt and removalReason set', async () => {
      const res = await request(app).get('/api/tickets/42').set('Cookie', requesterCookie());
      const removed = res.body.attachments.find(
        (a: { id: number }) => a.id === removedAttachment.id,
      );
      expect(removed).toBeDefined();
      expect(removed.removedAt).not.toBeNull();
      expect(removed.removalReason).toBe('Uploaded wrong file');
    });

    it('active attachment has removedAt: null', async () => {
      const res = await request(app).get('/api/tickets/42').set('Cookie', requesterCookie());
      const active = res.body.attachments.find(
        (a: { id: number }) => a.id === activeAttachment.id,
      );
      expect(active.removedAt).toBeNull();
    });
  });

  // API-11: cross-requester access returns 403 (AC-03)
  describe('API-11 — cross-requester access is forbidden', () => {
    beforeEach(() => ticketFindUnique.mockResolvedValue(mockTicket));

    it('returns 403 when the authenticated requester does not own the ticket, even with a forged query', async () => {
      const res = await request(app).get('/api/tickets/42?requesterId=1').set('Cookie', requesterCookie(99));
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.summary).toBeUndefined();
    });
  });

  // Ticket not found → 404
  describe('ticket not found', () => {
    beforeEach(() => ticketFindUnique.mockResolvedValue(null));

    it('returns 404 when ticket does not exist', async () => {
      const res = await request(app).get('/api/tickets/9999').set('Cookie', requesterCookie());
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // The missing-identity safeguard now belongs to session middleware, not a caller-supplied ID.
  describe('missing authenticated identity', () => {
    it('returns 401 when the session is not provided', async () => {
      const res = await request(app).get('/api/tickets/42');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      expect(ticketFindUnique).not.toHaveBeenCalled();
    });
  });

  // Server error
  describe('server error', () => {
    it('returns 500 with safe error envelope', async () => {
      ticketFindUnique.mockRejectedValue(new Error('DB error'));
      const res = await request(app).get('/api/tickets/42').set('Cookie', requesterCookie());
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
      expect(JSON.stringify(res.body)).not.toContain('DB error');
    });
  });
});
