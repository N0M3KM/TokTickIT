import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';

import authRouter from './routes/auth.js';
import categoriesRouter from './routes/categories.js';
import requestersRouter from './routes/requesters.js';
import queueRouter from './routes/queue.js';
import relatedSystemsRouter from './routes/relatedSystems.js';
import ticketsRouter from './routes/tickets.js';
import attachmentsRouter from './routes/attachments.js';

import { requireAuth, requireRole } from './middleware/requireAuth.js';
import { requirePasswordChanged } from './middleware/requirePasswordChanged.js';

// Ensure uploads directory exists at startup
const uploadsDir = path.resolve('uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();

// ── Global middleware ────────────────────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());

// ── Health check (unauthenticated — used by Docker healthcheck) ─────────────
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'TokTickIT API' });
});

// ── Auth routes (login / logout / me / change-password — no auth guard here) ─
app.use('/api/auth', authRouter);

// ── Reference data (public — used by Create Ticket dropdowns) ───────────────
app.use('/api/categories', categoriesRouter);
app.use('/api/requesters', requestersRouter);
app.use('/api/related-systems', relatedSystemsRouter);

// ── Protected routes — require valid JWT + password already changed ──────────
const protect = [requireAuth, requirePasswordChanged];
const requesterProtect = [...protect, requireRole('REQUESTER')];

app.use('/api/tickets',                      ...requesterProtect, ticketsRouter);
app.use('/api/tickets/:id/attachments',      ...requesterProtect, attachmentsRouter);
app.use('/api/queue',                         ...protect, requireRole('IT_STAFF', 'ADMINISTRATOR'), queueRouter);

export default app;
