import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import videoRoutes from './routes/videos';
import messageRoutes from './routes/messages';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// ---------------------------------------------------------------------------
// Core middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.use('/api/v1/videos', videoRoutes);
app.use('/api/v1/videos', messageRoutes);

// ---------------------------------------------------------------------------
// Error handler (must be last)
// ---------------------------------------------------------------------------
app.use(errorHandler);

export default app;
