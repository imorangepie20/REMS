import type { Request, Response, NextFunction } from 'express';
import { getSession } from './session';
import { config } from '../config';
import { UnauthorizedError } from '../errors';

/** 세션 쿠키가 있으면 req.agent를 채우고, 없으면 그대로 통과한다 */
export async function sessionMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.[config.session.cookieName];
  if (token) {
    const session = await getSession(token);
    if (session) req.agent = session.agent;
  }
  next();
}

/** 인증 필수 — req.agent가 없으면 401 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.agent) throw new UnauthorizedError();
  next();
}
