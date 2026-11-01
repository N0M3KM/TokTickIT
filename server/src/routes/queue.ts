import { Priority, Prisma, TicketStatus } from '@prisma/client';
import { Request, Response, Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { buildStaffDrilldown } from '../features/staff-dashboard/queries.js';
import { DashboardInputError } from '../features/requester-dashboard-preparation/window.js';

const router = Router();
const pageSizes = [10, 25, 50];

router.get('/owners', async (_req, res) => {
  try {
    res.json(await prisma.user.findMany({
      where: { isActive: true, role: { in: ['IT_STAFF', 'ADMINISTRATOR'] } },
      select: { id: true, name: true }, orderBy: { name: 'asc' },
    }));
  } catch { res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Could not load ticket owners.' } }); }
});

function enumValue<T extends Record<string, string>>(value: unknown, values: T): T[keyof T] | undefined {
  return typeof value === 'string' && Object.values(values).includes(value as T[keyof T]) ? value as T[keyof T] : undefined;
}

/** IT Staff/Admin queue with the Lab 3 search, filters, sort, and pagination contract. */
router.get('/', async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  try {
    const { search, categoryId, requestedPriority, itPriority, status, ownerId, sort, order, page, pageSize } = req.query;
    const dashboardQuery = Object.fromEntries(['dashboardFilter', 'from', 'to']
      .filter(key => Object.prototype.hasOwnProperty.call(req.query, key)).map(key => [key, req.query[key]]));
    const dashboardWhere = buildStaffDrilldown(req.user!.id, dashboardQuery);
    const filter = req.query.dashboardFilter;
    if (filter !== undefined) {
      const allowed = new Set(['search', 'categoryId', 'requestedPriority', 'itPriority', 'status', 'ownerId', 'sort', 'order', 'page', 'pageSize', 'dashboardFilter', 'from', 'to']);
      if (Object.entries(req.query).some(([key, value]) => !allowed.has(key) || typeof value !== 'string')) throw new DashboardInputError();
      const positive = (value: unknown) => typeof value === 'string' && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
      if (page !== undefined && !positive(page)) throw new DashboardInputError();
      if (pageSize !== undefined && (!positive(pageSize) || !pageSizes.includes(Number(pageSize)))) throw new DashboardInputError();
      if (!Number.isSafeInteger((Number(page ?? 1) - 1) * Number(pageSize ?? 10))) throw new DashboardInputError();
      if (categoryId !== undefined && !positive(categoryId)) throw new DashboardInputError();
      if (ownerId !== undefined && ownerId !== 'unassigned' && !positive(ownerId)) throw new DashboardInputError();
      if (requestedPriority !== undefined && !enumValue(requestedPriority, Priority)) throw new DashboardInputError();
      if (itPriority !== undefined && !enumValue(itPriority, Priority)) throw new DashboardInputError();
      if (status !== undefined && !enumValue(status, TicketStatus)) throw new DashboardInputError();
      if (sort !== undefined && !['ticketNumber', 'createdAt', 'updatedAt'].includes(sort as string)) throw new DashboardInputError();
      if (order !== undefined && !['asc', 'desc'].includes(order as string)) throw new DashboardInputError();
    }
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
    const orderBy: Prisma.TicketOrderByWithRelationInput[] = filter === 'recentlyUpdated'
      ? [{ updatedAt: 'desc' }, { id: 'desc' }]
      : [{ [field]: direction }, { id: direction }] as Prisma.TicketOrderByWithRelationInput[];
    const scopedWhere: Prisma.TicketWhereInput = filter === undefined ? where : { AND: [where, dashboardWhere] };

    const read = (client: Prisma.TransactionClient | typeof prisma) => Promise.all([
      client.ticket.count({ where: scopedWhere }),
      client.ticket.findMany({ where: scopedWhere, orderBy, skip: (currentPage - 1) * size, take: size, select: {
        id: true, ticketNumber: true, summary: true, requestedPriority: true, itPriority: true, currentStatus: true, createdAt: true, updatedAt: true,
        category: { select: { name: true } }, relatedSystem: { select: { name: true } },
        requester: { select: { id: true, name: true } }, ticketOwner: { select: { id: true, name: true } },
      } }),
    ]);
    const [total, tickets] = filter === undefined ? await read(prisma)
      : await prisma.$transaction(read, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 5000, timeout: 10000 });
    res.json({ data: tickets.map((ticket) => ({ ...ticket, categoryName: ticket.category.name, relatedSystemName: ticket.relatedSystem?.name ?? null })), pagination: { page: currentPage, pageSize: size, total, totalPages: Math.ceil(total / size) || 1 } });
  } catch (error) {
    if (error instanceof DashboardInputError) return res.status(400).json({ error: { code: error.code, message: error.message } });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
  }
});
export default router;
