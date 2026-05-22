import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors';

/** Express 중앙 에러 핸들러 — 알려진 에러를 표준 형태로 변환한다 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION',
        message: '입력값이 올바르지 않습니다',
        details: err.errors,
      },
    });
    return;
  }
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: { code: 'INTERNAL', message: '서버 오류가 발생했습니다' },
  });
}
