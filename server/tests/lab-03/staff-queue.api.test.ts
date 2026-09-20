import { beforeEach, describe, expect, it, vi } from 'vitest';

const { userFindUnique, ticketCount, ticketFindMany } = vi.hoisted(() => ({ userFindUnique: vi.fn(), ticketCount: vi.fn(), ticketFindMany: vi.fn() }));
vi.mock('../../src/lib/prisma.js', () => ({ prisma: { user: { findUnique: userFindUnique }, ticket: { count: ticketCount, findMany: ticketFindMany } } }));

import request from 'supertest';
import { signToken } from '../../src/lib/auth.js';
import app from '../../src/app.js';

const staffCookie = () => `tkt_token=${signToken(6, 'IT_STAFF')}`;
const ticket = { id: 42, ticketNumber: 'TKT-2026-000042', summary: 'Laptop battery drains quickly', requestedPriority: 'MEDIUM', itPriority: 'HIGH', currentStatus: 'IN_PROGRESS', createdAt: new Date('2026-09-01'), updatedAt: new Date('2026-09-02'), category: { name: 'Hardware' }, relatedSystem: { name: 'Corporate Laptop' }, requester: { id: 1, name: 'Somchai Jaidee' }, ticketOwner: { id: 6, name: 'Michael Brown' } };

beforeEach(() => { process.env.JWT_SECRET = 'staff-queue-test-secret'; vi.clearAllMocks(); userFindUnique.mockResolvedValue({ isActive: true, mustChangePassword: false, role: 'IT_STAFF' }); ticketCount.mockResolvedValue(1); ticketFindMany.mockResolvedValue([ticket]); });

describe('GET /api/queue', () => {
  it('returns queue data and pagination for IT Staff', async () => {
    const response = await request(app).get('/api/queue?search=battery&page=1&pageSize=10').set('Cookie', staffCookie());
    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({ page: 1, pageSize: 10, total: 1, totalPages: 1 });
    expect(response.body.data[0]).toMatchObject({ ticketNumber: ticket.ticketNumber, categoryName: 'Hardware', ticketOwner: { name: 'Michael Brown' } });
    expect(ticketFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) }));
  });

  it('applies category, priority, status, and unassigned-owner filters', async () => {
    const response = await request(app).get('/api/queue?categoryId=2&requestedPriority=HIGH&itPriority=CRITICAL&status=OPEN&ownerId=unassigned').set('Cookie', staffCookie());
    expect(response.status).toBe(200);
    expect(ticketCount).toHaveBeenCalledWith({ where: { categoryId: 2, requestedPriority: 'HIGH', itPriority: 'CRITICAL', currentStatus: 'OPEN', ticketOwnerId: null } });
  });

  it('clamps invalid page size to 10', async () => {
    const response = await request(app).get('/api/queue?pageSize=99').set('Cookie', staffCookie());
    expect(response.status).toBe(200);
    expect(response.body.pagination.pageSize).toBe(10);
  });

  it('rejects a Requester with 403', async () => {
    userFindUnique.mockResolvedValue({ isActive: true, mustChangePassword: false, role: 'REQUESTER' });
    const response = await request(app).get('/api/queue').set('Cookie', `tkt_token=${signToken(1, 'REQUESTER')}`);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});
