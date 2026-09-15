import { Priority, Prisma, TicketStatus } from '@prisma/client';
import { Request, Response, Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();
const pageSizes = [10, 25, 50];

function enumValue<T extends Record<string, string>>(value: unknown, values: T): T[keyof T] | undefined {
  return typeof value === 'string' && Object.values(values).includes(value as T[keyof T]) ? value as T[keyof T] : undefined;
}

/** IT Staff/Admin queue with the Lab 3 search, filters, sort, and pagination contract. */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, categoryId, requestedPriority, itPriority, status, ownerId, sort, order, page, pageSize } = req.query;
    const where: Prisma.TicketWhereInput = {};
    const text = typeof search === 'string' ? search.trim() : '';
    if (text) where.OR = [{ ticketNumber: { contains: text, mode: 'insensitive' } }, { summary: { contains: text, mode: 'insensitive' } }];
    const category = Number(categoryId);
    if (Number.isInteger(category) && category > 0) where.categoryId = category;
    const requested = enumValue(requestedPriority, Priority);
    if (requested) where.requestedPriority = requested;
    const staff = enumValue(itPriority, Priority);
    if (staff) where.itPriority = staff;
    const state = enumValue(status, TicketStatus);
    if (state) where.currentStatus = state;
    if (ownerId === 'unassigned') where.ticketOwnerId = null;
    else { const owner = Number(ownerId); if (Number.isInteger(owner) && owner > 0) where.ticketOwnerId = owner; }

    const size = pageSizes.includes(Number(pageSize)) ? Number(pageSize) : 10;
    const currentPage = Math.max(1, Number.isInteger(Number(page)) ? Number(page) : 1);
    const field = sort === 'ticketNumber' || sort === 'updatedAt' ? sort : 'createdAt';
    const direction = order === 'asc' ? 'asc' : 'desc';
    const orderBy: Prisma.TicketOrderByWithRelationInput[] = [{ [field]: direction }, ...(field === 'createdAt' ? [{ id: direction }] : [])] as Prisma.TicketOrderByWithRelationInput[];

    const [total, tickets] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({ where, orderBy, skip: (currentPage - 1) * size, take: size, select: {
        id: true, ticketNumber: true, summary: true, requestedPriority: true, itPriority: true, currentStatus: true, createdAt: true, updatedAt: true,
        category: { select: { name: true } }, relatedSystem: { select: { name: true } },
        requester: { select: { id: true, name: true } }, ticketOwner: { select: { id: true, name: true } },
      } }),
    ]);
    res.json({ data: tickets.map((ticket) => ({ ...ticket, categoryName: ticket.category.name, relatedSystemName: ticket.relatedSystem?.name ?? null })), pagination: { page: currentPage, pageSize: size, total, totalPages: Math.ceil(total / size) || 1 } });
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
  }
});
export default router;
