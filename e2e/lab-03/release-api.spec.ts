import { expect, test } from '@playwright/test';

const API_URL = process.env.LAB3_API_URL ?? 'http://localhost:3001';

test.describe('Lab 3 release smoke checks', () => {
  test('health endpoint is available', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/health`);
    expect(response.ok()).toBeTruthy();
    await expect(response.json()).resolves.toEqual({ status: 'ok', service: 'TokTickIT API' });
  });

  test('protected ticket API rejects an unauthenticated request', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/tickets`);
    expect(response.status()).toBe(401);
  });

  test('seeded administrator receives an httpOnly session cookie', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/auth/login`, { data: { email: 'admin@example.com', password: 'Admin@123!' } });
    expect(response.status()).toBe(200);
    expect(response.headers()['set-cookie']).toContain('tkt_token=');
    expect(response.headers()['set-cookie']).toMatch(/HttpOnly/i);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ role: 'ADMINISTRATOR' }));
  });
});
