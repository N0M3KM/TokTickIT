import { beforeEach, afterEach, beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Hoist mocks — must be before any imports that touch prisma
// ---------------------------------------------------------------------------
const {
  ticketFindUnique,
  attachmentCount,
  attachmentCreate,
  attachmentFindFirst,
  attachmentUpdate,
} = vi.hoisted(() => ({
  ticketFindUnique:    vi.fn(),
  attachmentCount:     vi.fn(),
  attachmentCreate:    vi.fn(),
  attachmentFindFirst: vi.fn(),
  attachmentUpdate:    vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    ticket:     { findUnique: ticketFindUnique },
    attachment: {
      count:     attachmentCount,
      create:    attachmentCreate,
      findFirst: attachmentFindFirst,
      update:    attachmentUpdate,
    },
  },
}));

import request from 'supertest';
import app from '../../src/app.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const ownerTicket = { id: 1, requesterId: 1 };

const activeAttachment = {
  id: 10,
  ticketId: 1,
  originalFilename: 'report.pdf',
  storageFilename: 'uuid-value.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  uploadedAt: new Date(),
  removedAt: null,
  removalReason: null,
};

const removedAttachment = {
  ...activeAttachment,
  id: 11,
  removedAt: new Date(),
  removalReason: 'No longer needed',
};

// ---------------------------------------------------------------------------
// POST /api/tickets/:id/attachments
// ---------------------------------------------------------------------------
describe('POST /api/tickets/:id/attachments', () => {
  // Spy on fs.renameSync and fs.unlink so upload tests don't touch disk
  let renameSync: ReturnType<typeof vi.spyOn>;
  let unlinkSpy:  ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    ticketFindUnique.mockResolvedValue(ownerTicket);
    attachmentCount.mockResolvedValue(0);
    attachmentCreate.mockResolvedValue(activeAttachment);
    renameSync = vi.spyOn(fs, 'renameSync').mockImplementation(() => undefined);
    unlinkSpy  = vi.spyOn(fs, 'unlink').mockImplementation((_p, cb) => { (cb as () => void)(); return undefined as unknown as void; });
  });

  afterEach(() => {
    renameSync.mockRestore();
    unlinkSpy.mockRestore();
  });

  // API-19: valid upload returns 201
  it('API-19 — valid PDF upload returns 201 with attachment metadata', async () => {
    const res = await request(app)
      .post('/api/tickets/1/attachments')
      .field('requesterId', '1')
      .attach('file', Buffer.from('pdf content'), {
        filename: 'report.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: 10,
      originalFilename: 'report.pdf',
      mimeType: 'application/pdf',
    });
    // storageFilename must never appear in response (api-spec §4)
    expect(JSON.stringify(res.body)).not.toContain('storageFilename');
  });

  // API-20: disallowed MIME type → 415
  it('API-20 — disallowed MIME type returns 415', async () => {
    const res = await request(app)
      .post('/api/tickets/1/attachments')
      .field('requesterId', '1')
      .attach('file', Buffer.from('bad'), {
        filename: 'virus.exe',
        contentType: 'application/octet-stream',
      });

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  // API-21: file > 5 MB → 400
  it('API-21 — file over 5 MB returns 400 FILE_TOO_LARGE', async () => {
    const oversized = Buffer.alloc(6 * 1024 * 1024, 'x');
    const res = await request(app)
      .post('/api/tickets/1/attachments')
      .field('requesterId', '1')
      .attach('file', oversized, {
        filename: 'huge.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });

  // API-22: 6th active attachment → 409
  it('API-22 — 6th active attachment returns 409 ATTACHMENT_LIMIT_REACHED', async () => {
    attachmentCount.mockResolvedValue(5);

    const res = await request(app)
      .post('/api/tickets/1/attachments')
      .field('requesterId', '1')
      .attach('file', Buffer.from('pdf'), {
        filename: 'extra.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ATTACHMENT_LIMIT_REACHED');
  });

  // API-23: cross-requester upload → 403
  it('API-23 — cross-requester upload returns 403 FORBIDDEN', async () => {
    ticketFindUnique.mockResolvedValue({ id: 1, requesterId: 99 });

    const res = await request(app)
      .post('/api/tickets/1/attachments')
      .field('requesterId', '1')
      .attach('file', Buffer.from('pdf'), {
        filename: 'file.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// GET /api/tickets/:id/attachments/:attachmentId/download
// ---------------------------------------------------------------------------
describe('GET /api/tickets/:id/attachments/:attachmentId/download', () => {
  // Create a real temporary file so res.download() can serve it
  const tmpDir  = path.join(process.cwd(), 'uploads');
  const tmpFile = path.join(tmpDir, 'uuid-value.pdf');

  beforeAll(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(tmpFile, '%PDF-test-content');
  });

  afterAll(() => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    ticketFindUnique.mockResolvedValue(ownerTicket);
    attachmentFindFirst.mockResolvedValue(activeAttachment);
  });

  // API-24: download active attachment → 200
  it('API-24 — active attachment download returns 200 with correct Content-Type', async () => {
    const res = await request(app).get(
      '/api/tickets/1/attachments/10/download?requesterId=1',
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
  });

  // API-25: soft-removed attachment → 410
  it('API-25 — soft-removed attachment returns 410 ATTACHMENT_REMOVED', async () => {
    attachmentFindFirst.mockResolvedValue(removedAttachment);

    const res = await request(app).get(
      '/api/tickets/1/attachments/11/download?requesterId=1',
    );

    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('ATTACHMENT_REMOVED');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/tickets/:id/attachments/:attachmentId (soft-remove)
// ---------------------------------------------------------------------------
describe('DELETE /api/tickets/:id/attachments/:attachmentId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ticketFindUnique.mockResolvedValue(ownerTicket);
    attachmentFindFirst.mockResolvedValue(activeAttachment);
    attachmentUpdate.mockResolvedValue({
      ...activeAttachment,
      removedAt: new Date(),
      removalReason: 'Uploaded wrong file version.',
    });
  });

  // API-26: valid soft-remove → 200
  it('API-26 — valid soft-remove returns 200 with removedAt set', async () => {
    const res = await request(app)
      .delete('/api/tickets/1/attachments/10')
      .send({ requesterId: 1, removalReason: 'Uploaded wrong file version.' });

    expect(res.status).toBe(200);
    expect(res.body.removedAt).not.toBeNull();
    expect(res.body.removalReason).toBe('Uploaded wrong file version.');
  });

  it('API-26 — storageFilename is not in soft-remove response', async () => {
    const res = await request(app)
      .delete('/api/tickets/1/attachments/10')
      .send({ requesterId: 1, removalReason: 'Test reason' });

    expect(JSON.stringify(res.body)).not.toContain('storageFilename');
  });

  // API-27: missing removalReason → 400
  it('API-27 — missing removalReason returns 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .delete('/api/tickets/1/attachments/10')
      .send({ requesterId: 1, removalReason: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.removalReason).toBeTruthy();
  });

  // API-28: cross-requester removal → 403
  it('API-28 — cross-requester removal returns 403 FORBIDDEN', async () => {
    ticketFindUnique.mockResolvedValue({ id: 1, requesterId: 99 });

    const res = await request(app)
      .delete('/api/tickets/1/attachments/10')
      .send({ requesterId: 1, removalReason: 'Reason' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // Already removed → 409
  it('already-removed attachment returns 409 ALREADY_REMOVED', async () => {
    attachmentFindFirst.mockResolvedValue(removedAttachment);

    const res = await request(app)
      .delete('/api/tickets/1/attachments/11')
      .send({ requesterId: 1, removalReason: 'Trying to remove again' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_REMOVED');
  });
});
