import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../middleware/requireAuth.js';
import { buildRequesterMetricPredicates, requesterPreviewQuery, type RequesterMetric } from '../features/requester-dashboard-preparation/filters.js';
import { createRequesterWindow, DashboardInputError } from '../features/requester-dashboard-preparation/window.js';
import { buildStaffPredicates, completeBuckets, STAFF_PRIORITY_ORDER, STAFF_STATUS_ORDER, STAFF_PREVIEW_LIMIT, staffActionPreview } from '../features/staff-dashboard/queries.js';

const router = Router();
const previewSelect = {
  id: true, ticketNumber: true, summary: true, currentStatus: true, itPriority: true,
  ticketOwner: { select: { id: true, name: true } }, updatedAt: true,
  resolvedAt: true, resolutionTimeEstimated: true,
} as const;
type TicketPreviewRow = Prisma.TicketGetPayload<{ select: typeof previewSelect }>;
const preview = (ticket: TicketPreviewRow) => ({ ...ticket, href: `/tickets/${ticket.id}` });

router.use(['/requester', '/staff'], (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
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

router.get('/staff', requireRole('IT_STAFF', 'ADMINISTRATOR'), async (req, res) => {
  if (Object.keys(req.query).length) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'This dashboard does not accept query parameters.' } });
  try {
    const dashboard = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1`;
      const snapshot = createRequesterWindow(new Date());
      const predicates = buildStaffPredicates(req.user!.id, snapshot);
      const [unassigned, ownedByMe, recentlyUpdated, statuses, priorities, actionCount, ticketCount, actions, recentTickets] = await Promise.all([
        tx.ticket.count({ where: predicates.unassigned }), tx.ticket.count({ where: predicates.ownedByMe }),
        tx.ticket.count({ where: predicates.recentlyUpdated }),
        tx.ticket.groupBy({ by: ['currentStatus'], _count: { _all: true } }),
        tx.ticket.groupBy({ by: ['itPriority'], where: predicates.open, _count: { _all: true } }),
        tx.actionTaken.count({ where: predicates.myActions }), tx.ticket.count({ where: predicates.myActionTickets }),
        tx.actionTaken.findMany({ where: predicates.myActions, take: STAFF_PREVIEW_LIMIT,
          orderBy: [{ actionAt: 'asc' }, { id: 'asc' }], select: { id: true, ticketId: true,
            ticket: { select: { ticketNumber: true } }, description: true, status: true, actionAt: true, followUpRequired: true } }),
        tx.ticket.findMany({ where: predicates.recentlyUpdated, take: STAFF_PREVIEW_LIMIT,
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], select: previewSelect }),
      ]);
      const recentQuery = new URLSearchParams({ dashboardFilter: 'recentlyUpdated', from: snapshot.window.from, to: snapshot.window.to });
      return { ...snapshot, metrics: {
        unassigned: { count: unassigned, href: '/queue?dashboardFilter=unassigned' },
        ownedByMe: { count: ownedByMe, href: '/queue?dashboardFilter=ownedByMe' },
        byStatus: completeBuckets(STAFF_STATUS_ORDER, statuses.map(row => ({ key: row.currentStatus, count: row._count._all })))
          .map(row => ({ status: row.key, count: row.count, href: `/queue?status=${row.key}` })),
        byPriority: completeBuckets(STAFF_PRIORITY_ORDER, priorities.map(row => ({ key: row.itPriority, count: row._count._all })))
          .map(row => ({ itPriority: row.key, count: row.count, href: `/queue?dashboardFilter=open&itPriority=${row.key}` })),
        recentlyUpdated: { count: recentlyUpdated, href: `/queue?${recentQuery}` },
      }, myActions: { actionCount, ticketCount, href: '/queue?dashboardFilter=myActions', items: actions.map(staffActionPreview) },
      recentTickets: recentTickets.map(preview) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 5000, timeout: 10000 });
    return res.json(dashboard);
  } catch (error) {
    if (error instanceof DashboardInputError) return res.status(400).json({ error: { code: error.code, message: error.message } });
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Could not load the staff dashboard.' } });
  }
});

export default router;
