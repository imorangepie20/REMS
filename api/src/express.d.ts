import type { AuthenticatedAgent } from './auth/session';

declare module 'express-serve-static-core' {
  interface Request {
    /** 세션 미들웨어가 채운다. requireAuth 이후에는 반드시 존재. */
    agent?: AuthenticatedAgent;
  }
}
