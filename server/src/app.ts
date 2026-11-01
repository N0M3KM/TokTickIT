import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';

import authRouter from './routes/auth.js';
import categoriesRouter from './routes/categories.js';
import queueRouter from './routes/queue.js';
import relatedSystemsRouter from './routes/relatedSystems.js';
import ticketOperationsRouter from './routes/ticketOperations.js';
import ticketWorkflowRouter from './routes/ticketWorkflow.js';
import actionsRouter from './routes/actions.js';
import dashboardsRouter from './routes/dashboards.js';
import usersRouter from './routes/users.js';
import ticketsRouter from './routes/tickets.js';
import attachmentsRouter from './routes/attachments.js';

import { requireAuth, requireRole } from './middleware/requireAuth.js';
import { requirePasswordChanged } from './middleware/requirePasswordChanged.js';

// Ensure uploads directory exists at startup
const uploadsDir = path.resolve('uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();

// ── Global middleware ────────────────────────────────────────────────────────
app.use('/api/tickets/:id/actions', express.json({ limit: '32kb' }));
app.use(express.json());
app.use(cookieParser());

// ── Health check (unauthenticated — used by Docker healthcheck) ─────────────
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'TokTickIT API' });
});

// ── Auth routes (login / logout / me / change-password — no auth guard here) ─
app.use('/api/auth', authRouter);

// ── Reference data (public — used by Create Ticket dropdowns) ───────────────
app.use('/api/categories', requireAuth, requirePasswordChanged, categoriesRouter);
app.use('/api/related-systems', requireAuth, requirePasswordChanged, relatedSystemsRouter);

// ── Protected routes — require valid JWT + password already changed ──────────
const protect = [requireAuth, requirePasswordChanged];
app.use('/api/dashboards', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, ...protect, dashboardsRouter);
app.use('/api/tickets', ...protect);
app.use('/api/tickets', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('Origin');
  try {
    if (req.get('Sec-Fetch-Site') === 'cross-site' || (origin && (!['http:', 'https:'].includes(new URL(origin).protocol) || new URL(origin).host !== req.get('Host')))) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cross-site mutations are not allowed.' } });
    }
  } catch { return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Invalid request origin.' } }); }
  next();
});
app.use('/api/tickets', actionsRouter, ticketWorkflowRouter, ticketsRouter);
app.use('/api/tickets/:id/attachments', attachmentsRouter);
app.use('/api/queue',                         ...protect, requireRole('IT_STAFF', 'ADMINISTRATOR'), queueRouter);
app.use('/api/tickets', ticketOperationsRouter);
app.use('/api/users',                         ...protect, requireRole('ADMINISTRATOR'), usersRouter);

app.use((error: { type?: string; status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
  res.status(status).json({ error: { code: status === 413 ? 'PAYLOAD_TOO_LARGE' : status === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR', message: 'The request could not be processed.' } });
});

export default app;
