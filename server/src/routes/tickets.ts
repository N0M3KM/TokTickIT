import { Router, Request, Response } from 'express';
import { Priority, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { generateTicketNumber } from '../lib/ticketNumber.js';
import {
  trimField,
  validateSummary,
  validateDescription,
  validateRequestedPriority,
  validateCategoryId,
  validateRequesterId,
  buildFieldsMap,
  type FieldError,
} from '../lib/ticketValidation.js';

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function internalError(res: Response): void {
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  });
}

/** Selects the ticket fields returned to the client (never exposes internals). */
const TICKET_SELECT = {
  id: true,
  ticketNumber: true,
  requesterId: true,
  categoryId: true,
  relatedSystemId: true,
  summary: true,
  description: true,
  requestedPriority: true,
  currentStatus: true,
  ticketDate: true,
  createdAt: true,
  updatedAt: true,
  requester: { select: { name: true } },
  category: { select: { name: true } },
  relatedSystem: { select: { name: true } },
} as const;

/** Flattens Prisma relations into the flat response shape from api-spec.md. */
function formatTicket(t: {
  id: number;
  ticketNumber: string;
  requesterId: number;
  categoryId: number;
  relatedSystemId: number | null;
  summary: string;
  description: string;
  requestedPriority: Priority;
  currentStatus: string;
  ticketDate: Date;
  createdAt: Date;
  updatedAt: Date;
  requester: { name: string };
  category: { name: string };
  relatedSystem: { name: string } | null;
}) {
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    requesterId: t.requesterId,
    requesterName: t.requester.name,
    categoryId: t.categoryId,
    categoryName: t.category.name,
    relatedSystemId: t.relatedSystemId,
    relatedSystemName: t.relatedSystem?.name ?? null,
    summary: t.summary,
    description: t.description,
    requestedPriority: t.requestedPriority,
    currentStatus: t.currentStatus,
    ticketDate: t.ticketDate,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// POST /api/tickets — Create a ticket (api-spec.md §3.1)
// ---------------------------------------------------------------------------
router.post('/', async (req: Request, res: Response) => {
  try {
    const { requesterId, categoryId, relatedSystemId, summary, description, requestedPriority } =
      req.body ?? {};

    // --- Collect all field validation errors at once (AC-23) ---
    const errors: FieldError[] = [];

    const summaryErr = validateSummary(summary);
    if (summaryErr) errors.push(summaryErr);

    const descErr = validateDescription(description);
    if (descErr) errors.push(descErr);

    const priorityErr = validateRequestedPriority(requestedPriority);
    if (priorityErr) errors.push(priorityErr);

    const categoryErr = validateCategoryId(categoryId);
    if (categoryErr) errors.push(categoryErr);

    const requesterErr = validateRequesterId(requesterId);
    if (requesterErr) errors.push(requesterErr);

    if (errors.length > 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed.',
          fields: buildFieldsMap(errors),
        },
      });
    }

    // --- DB existence checks ---
    const requester = await prisma.devRequester.findFirst({
      where: { id: Number(requesterId), isActive: true },
      select: { id: true, name: true },
    });
    if (!requester) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed.',
          fields: { requesterId: 'Invalid or inactive requester.' },
        },
      });
    }

    const category = await prisma.category.findFirst({
      where: { id: Number(categoryId), isActive: true },
      select: { id: true, name: true },
    });
    if (!category) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed.',
          fields: { categoryId: 'Category not found.' },
        },
      });
    }

    let relatedSystem: { id: number; name: string } | null = null;
    if (relatedSystemId !== undefined && relatedSystemId !== null) {
      relatedSystem = await prisma.relatedSystem.findFirst({
        where: { id: Number(relatedSystemId), isActive: true },
        select: { id: true, name: true },
      });
      if (!relatedSystem) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed.',
            fields: { relatedSystemId: 'Related system not found.' },
          },
        });
      }
    }

    // --- Generate unique ticket number (BR-01) ---
    const ticketNumber = await generateTicketNumber();

    // --- Create ticket (BR-02: status=NEW, BR-13: ticketDate from server) ---
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        requesterId: Number(requesterId),
        categoryId: Number(categoryId),
        relatedSystemId: relatedSystem?.id ?? null,
        summary: trimField(summary),
        description: trimField(description),
        requestedPriority: requestedPriority as Priority,
        currentStatus: 'NEW',
        ticketDate: new Date(),
      },
      select: {
        ...TICKET_SELECT,
        attachments: {
          select: {
            id: true,
            originalFilename: true,
            mimeType: true,
            sizeBytes: true,
            uploadedAt: true,
            removedAt: true,
            removalReason: true,
          },
          orderBy: { uploadedAt: 'asc' },
        },
      },
    });

    return res.status(201).json({
      ...formatTicket(ticket),
      attachments: ticket.attachments,
    });
  } catch {
    return internalError(res);
  }
});

// ---------------------------------------------------------------------------
// GET /api/tickets — List requester's tickets with search/filter/sort/page
// api-spec.md §3.2, §8, §9
// ---------------------------------------------------------------------------
router.get('/', async (req: Request, res: Response) => {
  try {
    const { requesterId, search, categoryId, priority, status, sort, order, page, pageSize } =
      req.query;

    // requesterId is required
    const requesterIdNum = Number(requesterId);
    if (!requesterId || !Number.isInteger(requesterIdNum) || requesterIdNum < 1) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'requesterId is required and must be a positive integer.',
          fields: { requesterId: 'requesterId is required.' },
        },
      });
    }

    // --- Pagination (BR-24: clamp to valid values) ---
    const validPageSizes = [10, 25, 50];
    const pageSizeNum = validPageSizes.includes(Number(pageSize)) ? Number(pageSize) : 10;
    const pageNum = Math.max(1, Number.isInteger(Number(page)) ? Number(page) : 1);

    // --- Sort ---
    const validSorts: Record<string, Prisma.TicketOrderByWithRelationInput[]> = {
      ticketNumber: [{ ticketNumber: 'desc' }, { createdAt: 'desc' }],
      createdAt: [{ createdAt: 'desc' }, { id: 'desc' }],
      updatedAt: [{ updatedAt: 'desc' }, { id: 'desc' }],
    };
    const sortField = typeof sort === 'string' && sort in validSorts ? sort : 'createdAt';
    const sortDir = order === 'asc' ? 'asc' : 'desc';

    // Build the order-by array with the chosen direction
    const orderBy: Prisma.TicketOrderByWithRelationInput[] = Object.keys(
      validSorts[sortField][0],
    ).length
      ? validSorts[sortField].map((o) => {
          const [key] = Object.keys(o) as (keyof Prisma.TicketOrderByWithRelationInput)[];
          return { [key]: sortDir } as Prisma.TicketOrderByWithRelationInput;
        })
      : [{ createdAt: sortDir }];

    // --- Filters ---
    const where: Prisma.TicketWhereInput = {
      requesterId: requesterIdNum,
    };

    // Search: case-insensitive ILIKE on ticketNumber OR summary (BR-22)
    if (typeof search === 'string' && search.trim().length > 0) {
      where.OR = [
        { ticketNumber: { contains: search.trim(), mode: 'insensitive' } },
        { summary: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      const catId = Number(categoryId);
      if (Number.isInteger(catId) && catId > 0) {
        where.categoryId = catId;
      }
    }

    if (typeof priority === 'string' && Object.values(Priority).includes(priority as Priority)) {
      where.requestedPriority = priority as Priority;
    }

    if (typeof status === 'string' && status.length > 0) {
      where.currentStatus = status as 'NEW';
    }

    // --- Count + query ---
    const [total, tickets] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        select: {
          id: true,
          ticketNumber: true,
          requesterId: true,
          categoryId: true,
          relatedSystemId: true,
          summary: true,
          requestedPriority: true,
          currentStatus: true,
          ticketDate: true,
          createdAt: true,
          updatedAt: true,
          category: { select: { name: true } },
          relatedSystem: { select: { name: true } },
        },
        orderBy,
        skip: (pageNum - 1) * pageSizeNum,
        take: pageSizeNum,
      }),
    ]);

    const totalPages = Math.ceil(total / pageSizeNum) || 1;

    return res.status(200).json({
      data: tickets.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        requesterId: t.requesterId,
        categoryId: t.categoryId,
        categoryName: t.category.name,
        relatedSystemId: t.relatedSystemId,
        relatedSystemName: t.relatedSystem?.name ?? null,
        summary: t.summary,
        requestedPriority: t.requestedPriority,
        currentStatus: t.currentStatus,
        ticketDate: t.ticketDate,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      pagination: { page: pageNum, pageSize: pageSizeNum, total, totalPages },
    });
  } catch {
    return internalError(res);
  }
});

// ---------------------------------------------------------------------------
// GET /api/tickets/:id — Get one owned ticket with attachments
// api-spec.md §3.3
// ---------------------------------------------------------------------------
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const ticketId = Number(req.params.id);
    const requesterIdNum = Number(req.query.requesterId);

    if (!Number.isInteger(requesterIdNum) || requesterIdNum < 1) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'requesterId is required.',
          fields: { requesterId: 'requesterId is required.' },
        },
      });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        ...TICKET_SELECT,
        attachments: {
          select: {
            id: true,
            originalFilename: true,
            mimeType: true,
            sizeBytes: true,
            uploadedAt: true,
            removedAt: true,
            removalReason: true,
            // storageFilename intentionally excluded (api-spec.md §3.3)
          },
          orderBy: { uploadedAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Ticket not found.' },
      });
    }

    // Ownership check — BR-07
    if (ticket.requesterId !== requesterIdNum) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You do not have permission to view this ticket.' },
      });
    }

    return res.status(200).json({
      ...formatTicket(ticket),
      attachments: ticket.attachments,
    });
  } catch {
    return internalError(res);
  }
});

export default router;
