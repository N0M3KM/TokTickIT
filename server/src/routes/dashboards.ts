import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../middleware/requireAuth.js';
import { buildRequesterMetricPredicates, requesterPreviewQuery, type RequesterMetric } from '../features/requester-dashboard-preparation/filters.js';
import { createRequesterWindow, DashboardInputError } from '../features/requester-dashboard-preparation/window.js';

const router = Router();
const previewSelect = {
  id: true, ticketNumber: true, summary: true, currentStatus: true, itPriority: true,
  ticketOwner: { select: { id: true, name: true } }, updatedAt: true,
  resolvedAt: true, resolutionTimeEstimated: true,
} as const;
type TicketPreviewRow = Prisma.TicketGetPayload<{ select: typeof previewSelect }>;
const preview = (ticket: TicketPreviewRow) => ({ ...ticket, href: `/tickets/${ticket.id}` });

router.use('/requester', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/requester', requireRole('REQUESTER'), async (req, res) => {
  if (Object.keys(req.query).length) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'This dashboard does not accept query parameters.' } });
  try {
    const dashboard = await prisma.$transaction(async tx => {
      // Establish the repeatable database snapshot before capturing its one
      // presentation timestamp and issuing any metric/list queries.
      await tx.$queryRaw`SELECT 1`;
      const snapshot = createRequesterWindow(new Date());
      const predicates = buildRequesterMetricPredicates(req.user!.id, snapshot);
      const [open, waiting, recentlyResolved, recentlyUpdated, recentTickets, recentResolvedTickets] = await Promise.all([
        tx.ticket.count({ where: predicates.open }), tx.ticket.count({ where: predicates.waiting }),
        tx.ticket.count({ where: predicates.recentlyResolved }), tx.ticket.count({ where: predicates.recentlyUpdated }),
        tx.ticket.findMany({ ...requesterPreviewQuery(req.user!.id, snapshot, 'recentlyUpdated'), select: previewSelect }),
        tx.ticket.findMany({ ...requesterPreviewQuery(req.user!.id, snapshot, 'recentlyResolved'), select: previewSelect }),
      ]);
      const metric = (dashboardFilter: RequesterMetric, count: number) => {
        const query = new URLSearchParams({ dashboardFilter });
        if (dashboardFilter === 'recentlyResolved' || dashboardFilter === 'recentlyUpdated') {
          query.set('from', snapshot.window.from); query.set('to', snapshot.window.to);
        }
        return { count, href: `/tickets?${query}` };
      };
      return { ...snapshot, metrics: { open: metric('open', open), waiting: metric('waiting', waiting),
        recentlyResolved: metric('recentlyResolved', recentlyResolved), recentlyUpdated: metric('recentlyUpdated', recentlyUpdated) },
      recentTickets: recentTickets.map(preview), recentResolvedTickets: recentResolvedTickets.map(preview) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 5000, timeout: 10000 });
    return res.json(dashboard);
  } catch (error) {
    if (error instanceof DashboardInputError) return res.status(400).json({ error: { code: error.code, message: error.message } });
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Could not load the requester dashboard.' } });
  }
});

export default router;
