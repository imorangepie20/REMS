import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler';
import { sessionMiddleware } from './auth/middleware';
import { authRouter } from './auth/routes';
import { listingsRouter } from './listings/routes';
import { customersRouter } from './customers/routes';
import { agentsRouter } from './agents/routes';

/** Express 앱을 생성한다 (테스트에서 직접 import 한다) */
export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/uploads', express.static('uploads'));
  app.use(cookieParser());
  app.use(sessionMiddleware);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/listings', listingsRouter);
  app.use('/api/customers', customersRouter);
  app.use('/api/agents', agentsRouter);

  app.use(errorHandler);
  return app;
}
