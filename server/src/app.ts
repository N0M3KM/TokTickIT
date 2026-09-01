import express from 'express';
import categoriesRouter from './routes/categories.js';
import relatedSystemsRouter from './routes/relatedSystems.js';
import requestersRouter from './routes/requesters.js';

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

export default app;
