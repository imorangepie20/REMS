import express, { type Express } from 'express';
import { errorHandler } from './middleware/errorHandler';

// Prisma BIGINT 컬럼을 JSON으로 직렬화한다.
// 한국 부동산 금액(최대 수천억 원)은 Number 안전 범위(2^53)를 넘지 않아 손실이 없다.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function () {
  return Number(this as bigint);
};

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
