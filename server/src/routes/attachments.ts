import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma.js';
import { upload } from '../lib/upload.js';
import {
  sanitiseStorageFilename,
  MAX_ACTIVE_ATTACHMENTS,
} from '../lib/attachmentValidation.js';
import { trimField } from '../lib/ticketValidation.js';

const router = Router({ mergeParams: true });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function internalError(res: Response): void {
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  });
}

/** Resolves the absolute uploads directory path. */
function uploadsDir(): string {
  return path.resolve('uploads');
}

/** Attachment response shape — never exposes storageFilename (api-spec §4). */
function formatAttachment(a: {
  id: number;
  ticketId: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
  removedAt: Date | null;
  removalReason: string | null;
}) {
  return {
    id: a.id,
    ticketId: a.ticketId,
    originalFilename: a.originalFilename,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    uploadedAt: a.uploadedAt,
    removedAt: a.removedAt,
    removalReason: a.removalReason,
  };
}

/** Resolves and validates ownership of the parent ticket. */
async function resolveTicket(
  res: Response,
  ticketId: number,
  requesterId: number,
): Promise<{ id: number; requesterId: number } | null> {
  if (!Number.isInteger(requesterId) || requesterId < 1) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'requesterId is required.',
        fields: { requesterId: 'requesterId is required.' },
      },
    });
    return null;
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, requesterId: true },
  });

  if (!ticket) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ticket not found.' } });
    return null;
  }

  if (ticket.requesterId !== requesterId) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'You do not have permission to access this ticket.' },
    });
    return null;
  }

  return ticket;
}

// ---------------------------------------------------------------------------
// POST /api/tickets/:id/attachments — Upload an attachment (api-spec §4.1)
// ---------------------------------------------------------------------------
router.post(
  '/',
  (req: Request, res: Response, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        // Multer size limit exceeded
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: { code: 'FILE_TOO_LARGE', message: 'Maximum file size is 5 MB.' },
          });
        }
        // Our custom filter rejection
        if (err.message === 'UNSUPPORTED_FILE_TYPE' || (err as NodeJS.ErrnoException).code === 'UNSUPPORTED_FILE_TYPE') {
          return res.status(415).json({
            error: {
              code: 'UNSUPPORTED_FILE_TYPE',
              message: 'Allowed types: JPG, PNG, WEBP, PDF.',
            },
          });
        }
        return internalError(res);
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      const ticketId = Number(req.params.id);
      const requesterId = Number(req.body.requesterId);

      const ticket = await resolveTicket(res, ticketId, requesterId);
      if (!ticket) return;

      // No file provided
      if (!req.file) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed.',
            fields: { file: 'A file is required.' },
          },
        });
      }

      // Active attachment count check (BR-17)
      const activeCount = await prisma.attachment.count({
        where: { ticketId, removedAt: null },
      });
      if (activeCount >= MAX_ACTIVE_ATTACHMENTS) {
        // Clean up the temp file before returning
        fs.unlink(req.file.path, () => {});
        return res.status(409).json({
          error: {
            code: 'ATTACHMENT_LIMIT_REACHED',
            message: 'Maximum of 5 active attachments per ticket.',
          },
        });
      }

      // Generate safe storage filename (BR-21)
      const storageFilename = sanitiseStorageFilename(req.file.originalname);
      const destPath = path.join(uploadsDir(), storageFilename);

      // Rename multer temp file to UUID-based permanent name
      fs.renameSync(req.file.path, destPath);

      const attachment = await prisma.attachment.create({
        data: {
          ticketId,
          originalFilename: req.file.originalname,
          storageFilename,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
        },
        select: {
          id: true,
          ticketId: true,
          originalFilename: true,
          mimeType: true,
          sizeBytes: true,
          uploadedAt: true,
          removedAt: true,
          removalReason: true,
        },
      });

      return res.status(201).json(formatAttachment(attachment));
    } catch {
      return internalError(res);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/tickets/:id/attachments/:attachmentId/download — Download (§4.2)
// ---------------------------------------------------------------------------
router.get('/:attachmentId/download', async (req: Request, res: Response) => {
  try {
    const ticketId = Number(req.params.id);
    const attachmentId = Number(req.params.attachmentId);
    const requesterId = Number(req.query.requesterId);

    const ticket = await resolveTicket(res, ticketId, requesterId);
    if (!ticket) return;

    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, ticketId },
      select: {
        id: true,
        storageFilename: true,
        originalFilename: true,
        mimeType: true,
        removedAt: true,
      },
    });

    if (!attachment) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Attachment not found.' } });
    }

    // Soft-removed — BR-19
    if (attachment.removedAt !== null) {
      return res.status(410).json({
        error: { code: 'ATTACHMENT_REMOVED', message: 'This attachment has been removed.' },
      });
    }

    const filePath = path.join(uploadsDir(), attachment.storageFilename);
    if (!fs.existsSync(filePath)) {
      return internalError(res);
    }

    // Serve the file with original filename in Content-Disposition
    res.setHeader('Content-Type', attachment.mimeType);
    res.download(filePath, attachment.originalFilename);
  } catch {
    return internalError(res);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/tickets/:id/attachments/:attachmentId — Soft-remove (§4.3)
// ---------------------------------------------------------------------------
router.delete('/:attachmentId', async (req: Request, res: Response) => {
  try {
    const ticketId = Number(req.params.id);
    const attachmentId = Number(req.params.attachmentId);
    const requesterId = Number(req.body.requesterId);

    const ticket = await resolveTicket(res, ticketId, requesterId);
    if (!ticket) return;

    // Validate removalReason (BR-18)
    const removalReason = trimField(req.body.removalReason);
    if (removalReason.length === 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed.',
          fields: { removalReason: 'Removal reason is required.' },
        },
      });
    }
    if (removalReason.length > 500) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed.',
          fields: { removalReason: 'Removal reason must not exceed 500 characters.' },
        },
      });
    }

    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, ticketId },
      select: { id: true, removedAt: true },
    });

    if (!attachment) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Attachment not found.' } });
    }

    // Already removed — BR-18 / api-spec ALREADY_REMOVED
    if (attachment.removedAt !== null) {
      return res.status(409).json({
        error: { code: 'ALREADY_REMOVED', message: 'This attachment has already been removed.' },
      });
    }

    const updated = await prisma.attachment.update({
      where: { id: attachmentId },
      data: { removedAt: new Date(), removalReason },
      select: {
        id: true,
        ticketId: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
        uploadedAt: true,
        removedAt: true,
        removalReason: true,
      },
    });

    return res.status(200).json(formatAttachment(updated));
  } catch {
    return internalError(res);
  }
});

export default router;
