import fs from 'fs';
import path from 'path';
import express from 'express';
import categoriesRouter from './routes/categories.js';
import relatedSystemsRouter from './routes/relatedSystems.js';
import requestersRouter from './routes/requesters.js';
import ticketsRouter from './routes/tickets.js';
import attachmentsRouter from './routes/attachments.js';

// Ensure uploads directory exists at startup
const uploadsDir = path.resolve('uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();

app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'TokTickIT API' });
});

// Reference data
app.use('/api/categories', categoriesRouter);
app.use('/api/related-systems', relatedSystemsRouter);
app.use('/api/requesters', requestersRouter);

// Tickets
app.use('/api/tickets', ticketsRouter);

// Attachments — nested under tickets, mergeParams is set in the router
app.use('/api/tickets/:id/attachments', attachmentsRouter);

export default app;
