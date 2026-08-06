import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../src/app.js';

describe('API-01 GET /api/health', () => {
  it('returns the required JSON response', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual({ status: 'ok', service: 'TokTickIT API' });
  });
});

