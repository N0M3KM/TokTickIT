import { beforeEach, describe, expect, it, vi } from 'vitest';
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('../../src/lib/prisma.js', () => ({ prisma: { category: { findMany } } }));
import request from 'supertest'; import app from '../../src/app.js';
describe('API-02 GET /api/categories', () => { beforeEach(() => findMany.mockResolvedValue([{ id: 1, name: 'Account and Access' }, { id: 2, name: 'Hardware' }, { id: 3, name: 'Software' }, { id: 4, name: 'Network' }])); it('returns the seeded categories in ID order', async () => { const response = await request(app).get('/api/categories'); expect(response.status).toBe(200); expect(response.body).toEqual([{ id: 1, name: 'Account and Access' }, { id: 2, name: 'Hardware' }, { id: 3, name: 'Software' }, { id: 4, name: 'Network' }]); }); });

