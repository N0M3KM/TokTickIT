import express from 'express';
import { prisma } from './lib/prisma.js';
const app = express();
app.get('/api/health', (_req, res) => res.status(200).json({ status: 'ok', service: 'TokTickIT API' }));
app.get('/api/categories', async (_req, res) => { try { res.status(200).json(await prisma.category.findMany({ select: { id: true, name: true }, orderBy: { id: 'asc' } })); } catch { res.status(503).json({ error: 'Unable to retrieve categories from the database.' }); } });
export default app;

