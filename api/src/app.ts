import express, { type Express } from 'express';
import { errorHandler } from './middleware/errorHandler';

/** Express 앱을 생성한다 (테스트에서 직접 import 한다) */
export function createApp(): Express {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(errorHandler);
  return app;
}
