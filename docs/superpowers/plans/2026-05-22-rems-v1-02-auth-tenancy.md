# REMS v1 — Plan 2: Auth & Tenancy 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** REMS에 멀티테넌트 인증 기반을 구축한다 — 사무소 가입·로그인·세션·인증 미들웨어·로그인/가입 페이지. 사무소 A의 세션은 사무소 B의 데이터에 접근할 수 없도록 강제하는 토대를 마련한다.

**Architecture:** httpOnly 세션 쿠키 + DB 세션 테이블. 세션 미들웨어가 모든 요청에서 쿠키 → `req.agent { id, agencyId, role }`를 채우고, `requireAuth`가 인증을 강제한다. 비밀번호는 bcrypt로 해시. 프론트엔드는 `AuthContext`로 인증 상태를 관리하고 `RequireAuth` 래퍼로 보호 라우트를 가드한다.

**Tech Stack:** Express 5 + zod + bcrypt + cookie-parser + Prisma; React + TanStack Query + react-router-dom.

---

## 사전 준비 (실행 전 확인)

- `main` 브랜치 = `1487056` (Plan 1 완료 상태). 작업은 새 피처 브랜치 `feat/v1-auth`에서 진행한다.
- MariaDB Docker 컨테이너 실행 중 (`docker compose up -d`).
- `npm install` 완료 상태.

## 완료 기준

- `npm run test -w api` 통과 — 기존 2건 + 신규 auth 테스트 약 8건.
- `npm run dev` → web에서 `/signup`으로 사무소 가입, `/login`으로 로그인, 보호 라우트 접근 가능.
- 두 사무소가 가입하면 각자의 세션이 별도의 `agency_id`를 가진다 (테넌트 격리 토대 — 데이터 접근 격리 테스트는 Plan 3에서 추가).

## 새 브랜치 생성

```bash
cd "/Volumes/MacExtend 1/REMS"
git checkout -b feat/v1-auth
```

## 파일 구조 (이 계획으로 추가/변경)

```
api/src/
  bigint-json.ts                       — NEW (Task 1)
  index.ts                             — modified (import bigint-json)
  app.ts                               — modified (remove inline shim, wire auth)
  config.ts                            — modified (remove dead field, add SESSION config)
  errors.ts                            — modified (name + captureStackTrace, ZodError 처리는 errorHandler에서)
  middleware/errorHandler.ts           — modified (ZodError → 400)
  express.d.ts                         — NEW (req.agent 타입 확장)
  auth/
    password.ts                        — NEW (bcrypt 래퍼)
    session.ts                         — NEW (세션 CRUD)
    middleware.ts                      — NEW (sessionMiddleware, requireAuth)
    routes.ts                          — NEW (signup/login/logout/me)
api/test/
  helpers.ts                           — NEW (resetDb)
  auth.test.ts                         — NEW (인증 통합 테스트)
api/package.json                       — modified (express ^5, bcrypt, cookie-parser, @types)

packages/shared/src/
  index.ts                             — modified (re-export auth)
  auth.ts                              — NEW (signup/login zod 스키마 + 응답 타입)

web/src/
  auth/
    AuthContext.tsx                    — NEW
    RequireAuth.tsx                    — NEW
  pages/auth/
    Login.tsx                          — REPLACED (API 연결)
    Signup.tsx                         — NEW (Register.tsx에서 git mv 후 내용 교체)
  App.tsx                              — modified (auth 라우트 + RequireAuth 가드)
  main.tsx                             — modified (AuthProvider)
```

---

# Phase A — Plan 1 리뷰 후속 정리

리뷰에서 지적된 Important 4건을 본 작업 전에 정리한다. 각 커밋은 최소·독립적이다.

## Task 1: BigInt JSON 직렬화 shim을 별도 파일로 분리

**Files:**
- Create: `api/src/bigint-json.ts`
- Modify: `api/src/app.ts` (shim 제거)
- Modify: `api/src/index.ts` (side-effect import 추가)

- [ ] **Step 1: api/src/bigint-json.ts 생성**

Create `api/src/bigint-json.ts`:
```ts
// Prisma BIGINT 컬럼을 JSON으로 직렬화한다 (side-effect 모듈).
// 한국 부동산 금액(최대 수천억 원)과 자동증가 PK는 Number 안전 범위(2^53 ≈ 9×10^15) 내라 손실이 없다.
// PK가 2^53을 넘어갈 일이 생기면 ID를 문자열로 직렬화하는 변환 계층을 별도로 둘 것.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function () {
  return Number(this as bigint);
};
```

- [ ] **Step 2: api/src/app.ts에서 inline shim 제거**

Replace the ENTIRE contents of `api/src/app.ts` with:
```ts
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
```

- [ ] **Step 3: api/src/index.ts에 bigint-json side-effect import 추가**

Replace the ENTIRE contents of `api/src/index.ts` with:
```ts
import './bigint-json';
import { createApp } from './app';
import { config } from './config';

const app = createApp();
app.listen(config.port, () => {
  console.log(`REMS API listening on http://localhost:${config.port}`);
});
```

- [ ] **Step 4: 테스트 실행 — 기존 통과 유지**

Run: `npm run test -w api`
Expected: health, db 테스트 통과 (shim이 테스트에서 더 이상 로드되지 않음 — 테스트는 BigInt 직렬화에 의존하지 않으므로 영향 없음).

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "refactor(api): isolate BigInt JSON shim to side-effect module

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: AppError에 name과 captureStackTrace 추가

**Files:**
- Modify: `api/src/errors.ts`

- [ ] **Step 1: AppError 생성자에 name·stack 보정 추가**

Replace the ENTIRE contents of `api/src/errors.ts` with:
```ts
/** API 전역 에러 기반 클래스 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, new.target);
    }
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, 'VALIDATION', message, details);
  }
}
export class UnauthorizedError extends AppError {
  constructor(message = '인증이 필요합니다') {
    super(401, 'UNAUTHORIZED', message);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = '권한이 없습니다') {
    super(403, 'FORBIDDEN', message);
  }
}
export class NotFoundError extends AppError {
  constructor(message = '찾을 수 없습니다') {
    super(404, 'NOT_FOUND', message);
  }
}
export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}
```

- [ ] **Step 2: 테스트 실행**

Run: `npm run test -w api`
Expected: 기존 테스트 모두 통과.

- [ ] **Step 3: 커밋**

```bash
git add api/src/errors.ts
git commit -m "refactor(api): set name and capture stack trace on AppError

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: config.ts에서 사용되지 않는 databaseUrl 제거

`databaseUrl`은 어디서도 읽지 않는다 — Prisma는 `schema.prisma`의 `env("DATABASE_URL")`로 직접 읽는다. 죽은 필드를 제거하고 환경 변수 누락 시 명시적으로 실패하게 한다.

**Files:**
- Modify: `api/src/config.ts`

- [ ] **Step 1: 죽은 필드 제거 + DATABASE_URL 부재 시 실패**

Replace the ENTIRE contents of `api/src/config.ts` with:
```ts
import 'dotenv/config';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL 환경 변수가 설정되지 않았습니다 (api/.env 확인)');
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  session: {
    cookieName: 'rems_session',
    ttlMs: 30 * 24 * 60 * 60 * 1000, // 30일
  },
};
```

- [ ] **Step 2: 테스트 실행**

Run: `npm run test -w api`
Expected: 기존 테스트 모두 통과.

- [ ] **Step 3: 커밋**

```bash
git add api/src/config.ts
git commit -m "refactor(api): drop dead databaseUrl field, fail fast on missing env

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Express 4 → 5 업그레이드 (async 에러 자동 포워딩)

Express 5는 `async` 핸들러에서 reject된 프로미스를 자동으로 에러 핸들러로 라우팅한다 — Plan 2의 모든 라우트는 async라 필수다.

**Files:**
- Modify: `api/package.json`

- [ ] **Step 1: express와 @types/express 5.x로 업그레이드**

Run:
```bash
cd "/Volumes/MacExtend 1/REMS"
npm install express@^5.0.1 @types/express@^5.0.0 -w api
```
Expected: api 의존성이 업데이트된다.

- [ ] **Step 2: 기존 테스트 실행 — Express 5에서도 통과해야 함**

Run: `npm run test -w api`
Expected: health, db 테스트 모두 통과. Express 5 호환성 문제 없음.

(만약 타입 에러나 런타임 에러가 발생하면 — `@types/express` 4와 5의 시그니처 차이일 수 있다. 에러 메시지를 보고 조정하라.)

- [ ] **Step 3: 커밋**

```bash
git add api/package.json package-lock.json
git commit -m "chore(api): upgrade Express to v5 for native async error forwarding

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

# Phase B — 인증 백엔드

## Task 5: errorHandler가 ZodError를 400으로 응답

이후 라우트가 `schema.parse(req.body)`를 호출할 때 ZodError가 던져진다. AppError가 아니므로 현재는 500이 된다. ZodError를 400 VALIDATION으로 매핑한다.

**Files:**
- Modify: `api/src/middleware/errorHandler.ts`

- [ ] **Step 1: errorHandler에 ZodError 분기 추가**

Replace the ENTIRE contents of `api/src/middleware/errorHandler.ts` with:
```ts
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
```

- [ ] **Step 2: 테스트 실행 — 기존 통과**

Run: `npm run test -w api`
Expected: 통과.

- [ ] **Step 3: 커밋**

```bash
git add api/src/middleware/errorHandler.ts
git commit -m "feat(api): map ZodError to 400 VALIDATION in error handler

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 공유 zod 스키마 (signup/login) + 응답 타입

**Files:**
- Create: `packages/shared/src/auth.ts`
- Modify: `packages/shared/src/index.ts` (re-export)

- [ ] **Step 1: packages/shared/src/auth.ts 생성**

Create `packages/shared/src/auth.ts`:
```ts
import { z } from 'zod';

/** 사무소 가입 요청 */
export const signupSchema = z.object({
  agency: z.object({
    name: z.string().min(1).max(255),
    businessNumber: z.string().max(20).optional(),
    phone: z.string().max(20).optional(),
    address: z.string().max(255).optional(),
  }),
  owner: z.object({
    email: z.string().email().max(255),
    password: z.string().min(8).max(100),
    name: z.string().min(1).max(100),
    phone: z.string().max(20).optional(),
  }),
});
export type SignupRequest = z.infer<typeof signupSchema>;

/** 로그인 요청 */
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginSchema>;

export type AgentRole = 'owner' | 'member';

/** 인증 응답 (signup/login/me 공통) */
export interface AuthResponse {
  agent: {
    id: number;
    email: string;
    name: string;
    role: AgentRole;
    agencyId: number;
  };
  agency: {
    id: number;
    name: string;
  };
}
```

- [ ] **Step 2: packages/shared/src/index.ts에 re-export 추가**

Replace the ENTIRE contents of `packages/shared/src/index.ts` with:
```ts
import { z } from 'zod';

/** 목록 API 공통 페이지네이션 쿼리 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** 목록 API 공통 응답 형태 */
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export * from './auth';
```

- [ ] **Step 3: 커밋**

```bash
git add packages/shared/
git commit -m "feat(shared): add auth zod schemas and AuthResponse type

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 비밀번호 해시 헬퍼 (bcrypt)

**Files:**
- Modify: `api/package.json` (bcrypt 추가)
- Create: `api/src/auth/password.ts`

- [ ] **Step 1: bcrypt 설치**

Run:
```bash
cd "/Volumes/MacExtend 1/REMS"
npm install bcrypt -w api
npm install -D @types/bcrypt -w api
```
Expected: api 의존성에 추가됨.

- [ ] **Step 2: api/src/auth/password.ts 생성**

Create `api/src/auth/password.ts`:
```ts
import bcrypt from 'bcrypt';

const COST = 10;

/** 평문 비밀번호를 bcrypt로 해시한다 */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

/** 평문 비밀번호와 해시를 비교한다 */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 3: 커밋**

```bash
git add api/package.json package-lock.json api/src/auth/password.ts
git commit -m "feat(api): bcrypt password hash/verify helpers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: 세션 헬퍼 (create/get/destroy)

**Files:**
- Create: `api/src/auth/session.ts`

- [ ] **Step 1: api/src/auth/session.ts 생성**

Create `api/src/auth/session.ts`:
```ts
import { randomBytes } from 'crypto';
import { prisma } from '../db';
import { config } from '../config';

export type AgentRole = 'owner' | 'member';

export interface AuthenticatedAgent {
  id: bigint;
  agencyId: bigint;
  role: AgentRole;
}

/** 64자 hex 랜덤 토큰 */
function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/** 세션을 DB에 만들고 토큰을 반환한다 */
export async function createSession(agentId: bigint): Promise<string> {
  const id = generateToken();
  const expiresAt = new Date(Date.now() + config.session.ttlMs);
  await prisma.session.create({ data: { id, agentId, expiresAt } });
  return id;
}

/** 토큰으로 세션을 조회한다. 만료된 세션은 자동 삭제 후 null. */
export async function getSession(token: string): Promise<{ agent: AuthenticatedAgent } | null> {
  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { agent: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: token } }).catch(() => undefined);
    return null;
  }
  return {
    agent: {
      id: session.agent.id,
      agencyId: session.agent.agencyId,
      role: session.agent.role,
    },
  };
}

/** 토큰의 세션을 삭제한다 (이미 없으면 무시) */
export async function destroySession(token: string): Promise<void> {
  await prisma.session.delete({ where: { id: token } }).catch(() => undefined);
}
```

- [ ] **Step 2: 커밋**

```bash
git add api/src/auth/session.ts
git commit -m "feat(api): session create/get/destroy with random tokens

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Express Request에 agent 속성 타입 확장

**Files:**
- Create: `api/src/express.d.ts`

- [ ] **Step 1: api/src/express.d.ts 생성**

Create `api/src/express.d.ts`:
```ts
import type { AuthenticatedAgent } from './auth/session';

declare module 'express-serve-static-core' {
  interface Request {
    /** 세션 미들웨어가 채운다. requireAuth 이후에는 반드시 존재. */
    agent?: AuthenticatedAgent;
  }
}
```

- [ ] **Step 2: tsconfig가 이 파일을 포함하는지 확인**

Run: `cat api/tsconfig.json`
Expected: `"include": ["src", "test"]` — `src/express.d.ts`는 자동 포함된다.

- [ ] **Step 3: 커밋**

```bash
git add api/src/express.d.ts
git commit -m "feat(api): augment Express Request with optional agent

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: 쿠키 파서 + 세션 미들웨어 + requireAuth

**Files:**
- Modify: `api/package.json` (cookie-parser)
- Create: `api/src/auth/middleware.ts`

- [ ] **Step 1: cookie-parser 설치**

Run:
```bash
cd "/Volumes/MacExtend 1/REMS"
npm install cookie-parser -w api
npm install -D @types/cookie-parser -w api
```

- [ ] **Step 2: api/src/auth/middleware.ts 생성**

Create `api/src/auth/middleware.ts`:
```ts
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
```

- [ ] **Step 3: 커밋**

```bash
git add api/package.json package-lock.json api/src/auth/middleware.ts
git commit -m "feat(api): session middleware and requireAuth guard

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: 테스트 헬퍼 (resetDb)

**Files:**
- Create: `api/test/helpers.ts`

- [ ] **Step 1: api/test/helpers.ts 생성**

Create `api/test/helpers.ts`:
```ts
import { prisma } from '../src/db';

/** 테스트 사이에 모든 테넌트 테이블을 비운다. FK 의존성 역순으로 삭제. */
export async function resetDb(): Promise<void> {
  await prisma.session.deleteMany();
  await prisma.customerListing.deleteMany();
  await prisma.listingPhoto.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.agency.deleteMany();
}
```

- [ ] **Step 2: 커밋**

```bash
git add api/test/helpers.ts
git commit -m "test(api): add resetDb helper for integration test isolation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: 인증 라우터 + 가입(signup) 라우트 (TDD)

**Files:**
- Create: `api/src/auth/routes.ts`
- Create: `api/test/auth.test.ts`
- Modify: `api/src/app.ts` (라우터 마운트 — 단계 5에서)

- [ ] **Step 1: 실패하는 테스트 작성**

Create `api/test/auth.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { resetDb } from './helpers';

describe('POST /api/auth/signup', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('201을 반환하고 사무소·owner를 생성하고 세션 쿠키를 설정한다', async () => {
    const res = await request(createApp())
      .post('/api/auth/signup')
      .send({
        agency: { name: '강남부동산' },
        owner: {
          email: 'kim@example.com',
          password: 'password123',
          name: '김중개',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.agent.email).toBe('kim@example.com');
    expect(res.body.agent.role).toBe('owner');
    expect(res.body.agency.name).toBe('강남부동산');
    expect(res.body.agent.agencyId).toBe(res.body.agency.id);
    expect(res.headers['set-cookie']?.[0]).toMatch(/^rems_session=[a-f0-9]{64}/);
  });

  it('이미 사용 중인 이메일이면 409를 반환한다', async () => {
    const payload = {
      agency: { name: 'A부동산' },
      owner: { email: 'dup@example.com', password: 'password123', name: '중개1' },
    };
    await request(createApp()).post('/api/auth/signup').send(payload).expect(201);

    const res = await request(createApp())
      .post('/api/auth/signup')
      .send({
        agency: { name: 'B부동산' },
        owner: { email: 'dup@example.com', password: 'password456', name: '중개2' },
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('필수 필드 누락 시 400을 반환한다', async () => {
    const res = await request(createApp())
      .post('/api/auth/signup')
      .send({ agency: { name: 'X' }, owner: { email: 'bad', password: '123', name: '' } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npm run test -w api`
Expected: FAIL — `/api/auth/signup`가 존재하지 않아 404 또는 비슷한 실패.

- [ ] **Step 3: api/src/auth/routes.ts 생성 (signup만)**

Create `api/src/auth/routes.ts`:
```ts
import { Router } from 'express';
import { signupSchema } from '@rems/shared';
import { prisma } from '../db';
import { hashPassword } from './password';
import { createSession } from './session';
import { config } from '../config';
import { ConflictError } from '../errors';

export const authRouter = Router();

authRouter.post('/signup', async (req, res) => {
  const data = signupSchema.parse(req.body);

  const exists = await prisma.agent.findUnique({ where: { email: data.owner.email } });
  if (exists) throw new ConflictError('이미 사용 중인 이메일입니다');

  const passwordHash = await hashPassword(data.owner.password);

  const result = await prisma.$transaction(async (tx) => {
    const agency = await tx.agency.create({ data: data.agency });
    const agent = await tx.agent.create({
      data: {
        agencyId: agency.id,
        email: data.owner.email,
        passwordHash,
        name: data.owner.name,
        phone: data.owner.phone,
        role: 'owner',
      },
    });
    return { agency, agent };
  });

  const token = await createSession(result.agent.id);
  res.cookie(config.session.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // 개발용 — 프로덕션에선 HTTPS + true
    maxAge: config.session.ttlMs,
    path: '/',
  });

  res.status(201).json({
    agent: {
      id: result.agent.id,
      email: result.agent.email,
      name: result.agent.name,
      role: result.agent.role,
      agencyId: result.agent.agencyId,
    },
    agency: {
      id: result.agency.id,
      name: result.agency.name,
    },
  });
});
```

- [ ] **Step 4: api/src/app.ts에 인증 미들웨어·라우터 마운트**

Replace the ENTIRE contents of `api/src/app.ts` with:
```ts
import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler';
import { sessionMiddleware } from './auth/middleware';
import { authRouter } from './auth/routes';

/** Express 앱을 생성한다 (테스트에서 직접 import 한다) */
export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(sessionMiddleware);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);

  app.use(errorHandler);
  return app;
}
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

Run: `npm run test -w api`
Expected: PASS — 기존 2건 + signup 3건 = 5건 통과.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat(api): POST /api/auth/signup creates agency + owner with session

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: 로그인(login) 라우트 (TDD)

**Files:**
- Modify: `api/test/auth.test.ts` (login describe 추가)
- Modify: `api/src/auth/routes.ts` (login 핸들러 추가)

- [ ] **Step 1: 실패하는 테스트 추가**

Append to `api/test/auth.test.ts` (파일 끝에 추가):
```ts
describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await resetDb();
    // signup으로 사용자 하나 준비
    await request(createApp())
      .post('/api/auth/signup')
      .send({
        agency: { name: 'A부동산' },
        owner: { email: 'login@example.com', password: 'password123', name: '로그인테스트' },
      });
  });

  it('올바른 이메일·비밀번호로 200 + 세션 쿠키를 반환한다', async () => {
    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.agent.email).toBe('login@example.com');
    expect(res.headers['set-cookie']?.[0]).toMatch(/^rems_session=[a-f0-9]{64}/);
  });

  it('잘못된 비밀번호면 401을 반환한다', async () => {
    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('존재하지 않는 이메일이면 401을 반환한다', async () => {
    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npm run test -w api`
Expected: login 테스트들 FAIL (404 — 라우트 없음).

- [ ] **Step 3: api/src/auth/routes.ts에 login 핸들러 추가**

Append to `api/src/auth/routes.ts`:
```ts

import { loginSchema } from '@rems/shared';
import { verifyPassword } from './password';
import { UnauthorizedError } from '../errors';

authRouter.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const agent = await prisma.agent.findUnique({ where: { email } });
  if (!agent) throw new UnauthorizedError('이메일 또는 비밀번호가 올바르지 않습니다');

  const ok = await verifyPassword(password, agent.passwordHash);
  if (!ok) throw new UnauthorizedError('이메일 또는 비밀번호가 올바르지 않습니다');

  const agency = await prisma.agency.findUnique({ where: { id: agent.agencyId } });
  if (!agency) throw new UnauthorizedError();

  const token = await createSession(agent.id);
  res.cookie(config.session.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: config.session.ttlMs,
    path: '/',
  });

  res.json({
    agent: {
      id: agent.id,
      email: agent.email,
      name: agent.name,
      role: agent.role,
      agencyId: agent.agencyId,
    },
    agency: { id: agency.id, name: agency.name },
  });
});
```

(상단의 import 라인은 이미 추가된 것 위에 합쳐도 좋다 — 중복 import는 ESM에서 그대로 두면 컴파일 오류가 나니, 기존 routes.ts 상단의 import 블록에 `loginSchema`, `verifyPassword`, `UnauthorizedError`를 합쳐 넣어라.)

최종 routes.ts 상단 import는 다음과 같아야 한다:
```ts
import { Router } from 'express';
import { signupSchema, loginSchema } from '@rems/shared';
import { prisma } from '../db';
import { hashPassword, verifyPassword } from './password';
import { createSession } from './session';
import { config } from '../config';
import { ConflictError, UnauthorizedError } from '../errors';
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npm run test -w api`
Expected: PASS — login 3건 추가 통과.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat(api): POST /api/auth/login with bcrypt verify + session

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: 현재 사용자 조회(me) 라우트 (TDD)

**Files:**
- Modify: `api/test/auth.test.ts`
- Modify: `api/src/auth/routes.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

Append to `api/test/auth.test.ts`:
```ts
describe('GET /api/auth/me', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('쿠키 없으면 401', async () => {
    const res = await request(createApp()).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('유효한 세션 쿠키로 200 + 현재 agent/agency를 반환한다', async () => {
    const agent = request.agent(createApp()); // 쿠키 유지
    await agent
      .post('/api/auth/signup')
      .send({
        agency: { name: '셀러스부동산' },
        owner: { email: 'me@example.com', password: 'password123', name: '현재유저' },
      });
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.agent.email).toBe('me@example.com');
    expect(res.body.agency.name).toBe('셀러스부동산');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npm run test -w api`
Expected: me 테스트 FAIL (404).

- [ ] **Step 3: routes.ts에 me 핸들러 추가**

Append to `api/src/auth/routes.ts`:
```ts

import { requireAuth } from './middleware';

authRouter.get('/me', requireAuth, async (req, res) => {
  const agentId = req.agent!.id;
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw new UnauthorizedError();
  const agency = await prisma.agency.findUnique({ where: { id: agent.agencyId } });
  if (!agency) throw new UnauthorizedError();
  res.json({
    agent: {
      id: agent.id,
      email: agent.email,
      name: agent.name,
      role: agent.role,
      agencyId: agent.agencyId,
    },
    agency: { id: agency.id, name: agency.name },
  });
});
```

기존 routes.ts 상단 import에 `requireAuth`를 합쳐 정리한다:
```ts
import { Router } from 'express';
import { signupSchema, loginSchema } from '@rems/shared';
import { prisma } from '../db';
import { hashPassword, verifyPassword } from './password';
import { createSession } from './session';
import { requireAuth } from './middleware';
import { config } from '../config';
import { ConflictError, UnauthorizedError } from '../errors';
```

- [ ] **Step 4: 테스트 실행**

Run: `npm run test -w api`
Expected: PASS — me 2건 추가 통과.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat(api): GET /api/auth/me returns current agent and agency

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: 로그아웃(logout) 라우트 (TDD)

**Files:**
- Modify: `api/test/auth.test.ts`
- Modify: `api/src/auth/routes.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

Append to `api/test/auth.test.ts`:
```ts
describe('POST /api/auth/logout', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('세션을 무효화한다 — 이후 /me는 401', async () => {
    const agent = request.agent(createApp());
    await agent
      .post('/api/auth/signup')
      .send({
        agency: { name: '아웃부동산' },
        owner: { email: 'out@example.com', password: 'password123', name: '로그아웃' },
      });
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(204);
    // 쿠키가 만료되었더라도 supertest agent는 헤더를 그대로 보내지만, 서버 DB에서 세션이 삭제돼 401이 된다
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npm run test -w api`
Expected: logout 테스트 FAIL.

- [ ] **Step 3: routes.ts에 logout 핸들러 추가**

Append to `api/src/auth/routes.ts`:
```ts

import { destroySession } from './session';

authRouter.post('/logout', async (req, res) => {
  const token = req.cookies?.[config.session.cookieName];
  if (token) await destroySession(token);
  res.clearCookie(config.session.cookieName, { path: '/' });
  res.status(204).send();
});
```

상단 import에 `destroySession`을 합쳐 정리한다:
```ts
import { createSession, destroySession } from './session';
```

- [ ] **Step 4: 테스트 실행**

Run: `npm run test -w api`
Expected: PASS — 전체 9건 통과 (health 1 + db 1 + signup 3 + login 3 + me 2 + logout 1 = wait, let me recount: signup 3, login 3, me 2, logout 1, health 1, db 1 = 11건).

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat(api): POST /api/auth/logout destroys session and clears cookie

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

# Phase C — 인증 프론트엔드

## Task 16: AuthContext (web/src/auth/AuthContext.tsx)

**Files:**
- Create: `web/src/auth/AuthContext.tsx`

- [ ] **Step 1: AuthContext 생성**

Create `web/src/auth/AuthContext.tsx`:
```tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { AuthResponse, SignupRequest } from '@rems/shared'
import { apiFetch, ApiError } from '../api/client'

interface AuthState {
  agent: AuthResponse['agent'] | null
  agency: AuthResponse['agency'] | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  signup: (data: SignupRequest) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    agent: null,
    agency: null,
    loading: true,
  })

  useEffect(() => {
    apiFetch<AuthResponse>('/auth/me')
      .then((data) => setState({ agent: data.agent, agency: data.agency, loading: false }))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          setState({ agent: null, agency: null, loading: false })
        } else {
          setState({ agent: null, agency: null, loading: false })
        }
      })
  }, [])

  const login = async (email: string, password: string) => {
    const data = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setState({ agent: data.agent, agency: data.agency, loading: false })
  }

  const signup = async (payload: SignupRequest) => {
    const data = await apiFetch<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    setState({ agent: data.agent, agency: data.agency, loading: false })
  }

  const logout = async () => {
    await apiFetch<void>('/auth/logout', { method: 'POST' })
    setState({ agent: null, agency: null, loading: false })
  }

  return (
    <AuthContext.Provider value={{ ...state, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서 호출해야 합니다')
  return ctx
}
```

- [ ] **Step 2: 커밋**

```bash
git add web/src/auth/AuthContext.tsx
git commit -m "feat(web): AuthContext with login/signup/logout/me

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: RequireAuth 라우트 가드

**Files:**
- Create: `web/src/auth/RequireAuth.tsx`

- [ ] **Step 1: RequireAuth 생성**

Create `web/src/auth/RequireAuth.tsx`:
```tsx
import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { agent, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="p-8">로딩...</div>
  }
  if (!agent) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return <>{children}</>
}
```

- [ ] **Step 2: 커밋**

```bash
git add web/src/auth/RequireAuth.tsx
git commit -m "feat(web): RequireAuth route guard redirects to /login

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: 로그인 페이지를 API에 연결

기존 `web/src/pages/auth/Login.tsx`를 REMS용으로 교체한다.

**Files:**
- Modify (replace contents): `web/src/pages/auth/Login.tsx`

- [ ] **Step 1: Login.tsx 전체 교체**

Replace the ENTIRE contents of `web/src/pages/auth/Login.tsx` with:
```tsx
import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { ApiError } from '../../api/client'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '로그인에 실패했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">REMS 로그인</h1>
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {submitting ? '로그인 중...' : '로그인'}
        </button>
        <p className="text-sm text-center">
          사무소 가입 → <Link to="/signup" className="text-blue-600">여기</Link>
        </p>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add web/src/pages/auth/Login.tsx
git commit -m "feat(web): wire Login page to AuthContext

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 19: 가입 페이지 (Register.tsx → Signup.tsx)

기존 `Register.tsx`를 `Signup.tsx`로 git mv한 뒤 내용 교체.

**Files:**
- Rename: `web/src/pages/auth/Register.tsx` → `web/src/pages/auth/Signup.tsx`
- Replace contents

- [ ] **Step 1: 파일 이름 변경**

Run:
```bash
cd "/Volumes/MacExtend 1/REMS"
git mv web/src/pages/auth/Register.tsx web/src/pages/auth/Signup.tsx
```

- [ ] **Step 2: Signup.tsx 전체 교체**

Replace the ENTIRE contents of `web/src/pages/auth/Signup.tsx` with:
```tsx
import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { ApiError } from '../../api/client'

export default function Signup() {
  const navigate = useNavigate()
  const { signup } = useAuth()
  const [agencyName, setAgencyName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signup({
        agency: { name: agencyName },
        owner: { email, password, name: ownerName },
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '가입에 실패했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">REMS 사무소 가입</h1>
        <input
          required
          placeholder="중개사무소명"
          value={agencyName}
          onChange={(e) => setAgencyName(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        />
        <input
          required
          placeholder="대표 중개사 이름"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        />
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="이메일 (로그인 ID)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        />
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="비밀번호 (8자 이상)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {submitting ? '가입 중...' : '사무소 가입'}
        </button>
        <p className="text-sm text-center">
          이미 계정이 있나요? <Link to="/login" className="text-blue-600">로그인</Link>
        </p>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: 커밋**

```bash
git add web/src/pages/auth/Signup.tsx web/src/pages/auth/Register.tsx
git commit -m "feat(web): rename Register to Signup with agency + owner form

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 20: App.tsx와 main.tsx에 인증 통합

`web/src/App.tsx`의 라우트 정의에 `/login`·`/signup`은 공개로 두고, 나머지는 `RequireAuth`로 감싼다. `main.tsx`에 `AuthProvider`를 추가한다.

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/main.tsx`

- [ ] **Step 1: 현재 App.tsx 구조 확인**

Run: `cat web/src/App.tsx | head -40`
Expected: react-router-dom의 `Routes`/`Route`로 구성되어 있다. 기존 라우트는 `MainLayout` 안에서 정의됨.

- [ ] **Step 2: web/src/App.tsx 수정**

`App.tsx`에서 다음을 적용한다:
1. 상단에 import 추가:
   ```tsx
   import Login from './pages/auth/Login'
   import Signup from './pages/auth/Signup'
   import { RequireAuth } from './auth/RequireAuth'
   ```
2. 기존 `Register` import 라인이 있다면 제거한다.
3. 라우트 구조를 다음 패턴으로 바꾼다:
   ```tsx
   <Routes>
     <Route path="/login" element={<Login />} />
     <Route path="/signup" element={<Signup />} />
     <Route
       path="/*"
       element={
         <RequireAuth>
           <MainLayout>
             {/* 기존 보호 라우트들 — Dashboard 등 */}
           </MainLayout>
         </RequireAuth>
       }
     />
   </Routes>
   ```
   기존의 `MainLayout` 안에 있던 라우트 정의는 그대로 유지하고, 단지 전체를 `RequireAuth`로 한 번 감싼다. `/register` 경로가 있었다면 제거한다 (이제 `/signup`).

(현재 파일 구조에 따라 정확한 편집이 다르므로, 위 패턴을 따라 라우트 트리만 수정하고 그 외 import·컴포넌트는 그대로 둔다.)

- [ ] **Step 3: web/src/main.tsx에 AuthProvider 추가**

Replace the ENTIRE contents of `web/src/main.tsx` with:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './themes/initTheme'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './auth/AuthContext'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <BrowserRouter>
                    <AuthProvider>
                        <App />
                    </AuthProvider>
                </BrowserRouter>
            </ThemeProvider>
        </QueryClientProvider>
    </StrictMode>,
)
```

(만약 `App.tsx` 내부에 이미 `<BrowserRouter>`가 있다면 main.tsx에서 빼고 App 안의 것을 유지하라. 그 경우 `AuthProvider`는 `BrowserRouter` 안쪽, `App` 컴포넌트의 라우트 정의 바깥에 들어가도록 위치를 조정.)

- [ ] **Step 4: 빌드 검증**

Run: `npm run build -w web`
Expected: 타입 에러 없이 빌드 성공.

- [ ] **Step 5: 커밋**

```bash
git add web/src/App.tsx web/src/main.tsx
git commit -m "feat(web): wire AuthProvider and RequireAuth route guard

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 21: 통합 동작 확인

**Files:** (수정 없음 — 수동 검증)

- [ ] **Step 1: 전체 테스트 실행**

Run:
```bash
cd "/Volumes/MacExtend 1/REMS"
npm run test
```
Expected: 11건(또는 그 이상) 모두 통과.

- [ ] **Step 2: dev 서버 실행 + 가입 흐름 수동 확인**

Run (다른 터미널): `npm run dev`

브라우저에서 확인:
1. `http://localhost:5173`로 접속 → 로그인 페이지(`/login`)로 리다이렉트되는지
2. "사무소 가입 → 여기" 링크 클릭 → `/signup`으로 이동
3. 양식 작성 후 가입 → `/`로 리다이렉트되고 대시보드가 보이는지
4. 브라우저 개발자도구의 Application → Cookies에 `rems_session` httpOnly 쿠키가 있는지
5. 페이지 새로고침 — 여전히 로그인 상태인지

- [ ] **Step 3: 두 사무소 가입으로 테넌트 분리 확인 (수동)**

다른 브라우저(또는 시크릿 창)에서 두 번째 사무소를 가입하면 다른 `agencyId`를 받는지 `GET /api/auth/me` 응답으로 확인. (데이터 접근 격리 자동 테스트는 Plan 3에서 매물·고객 라우트가 추가되면 작성한다.)

---

## 다음 계획

Plan 2 완료 후 Plan 3 (Listings) 작성: 매물 CRUD + 사진 + 매물 페이지 + 카카오맵. 매물 라우트에 `requireAuth`와 `agency_id` 필터링을 적용하고, **테넌트 격리 자동 테스트**(사무소 A 세션으로 B의 매물 접근 시 404)를 추가한다.
