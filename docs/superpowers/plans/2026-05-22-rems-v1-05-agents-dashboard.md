# REMS v1 — Plan 5: Agents & Dashboard 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** v1의 마지막 — 중개사(멤버) 관리 API + 비밀번호·사무소 정보 변경 + 대시보드(매물·고객·매칭 요약 + 차트), 그리고 5개 섹션의 Settings 페이지. v1 완성.

**Architecture:** 중개사·사무소·대시보드 라우터 각각 독립 (`api/src/agents/`, `agency/`, `dashboard/`), 모두 `requireAuth` 뒤. 권한 — `POST/PATCH agents`·`PATCH agency`는 owner만 (403); self는 본인 프로필 수정. 프론트는 메모리 준수 — Dashboard·Settings 모두 hud-* 테마 + 템플릿 ChartJs/Analytics/Settings 패턴 활용, 기존 테마 컨트롤은 보존.

**Tech Stack:** Express 5 + Prisma + zod + bcrypt; React + TanStack Query + chart.js (이미 의존성) + lucide.

---

## 사전 준비

- `main` = `8cd2b8a` (Plan 4 완료). 새 브랜치 `feat/v1-agents-dashboard`에서 진행.
- MariaDB Docker 가동 중, api 테스트 45건 통과.
- chart.js·react-chartjs-2·recharts는 이미 `web/package.json` 의존성에 있음 (템플릿 차트 데모용).

## 완료 기준

- `npm run test -w api` — 기존 45건 + 신규 ~16건 = ~61건 통과
- 사이드바 사이드바 변경 없음, 대시보드(`/`)는 REMS 통계+차트, Settings는 5개 섹션
- Owner가 Settings → 중개사 관리에서 멤버 추가, 비밀번호 변경, 사무소 정보 수정 가능

## 새 브랜치

```bash
cd "/Volumes/MacExtend 1/REMS"
git checkout main
git checkout -b feat/v1-agents-dashboard
```

## 파일 구조

```
packages/shared/src/
  admin.ts                — NEW: agent/agency/password/dashboard 스키마+타입
  index.ts                — modified
api/src/
  agents/routes.ts        — NEW
  agency/routes.ts        — NEW
  dashboard/routes.ts     — NEW
  auth/routes.ts          — modified: PATCH /password 추가
  app.ts                  — modified: 3개 라우터 마운트
api/test/
  agents.test.ts          — NEW
  agency.test.ts          — NEW
  dashboard.test.ts       — NEW
  auth.test.ts            — modified: 비번 변경 테스트 추가
web/src/
  api/admin.ts            — NEW
  pages/dashboard/Dashboard.tsx — REPLACED
  pages/Settings.tsx      — REPLACED (테마 컨트롤은 보존)
```

---

# Phase A — 백엔드

## Task 1: 공유 admin 스키마 (agent/agency/password/dashboard)

**Files:**
- Create: `packages/shared/src/admin.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create `packages/shared/src/admin.ts`**
```ts
import { z } from 'zod';

export const agentStatuses = ['active', 'inactive'] as const;

/** owner가 멤버 계정 생성 */
export const createAgentSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(100),
  phone: z.string().max(20).optional(),
  password: z.string().min(8).max(100),
});
export type CreateAgentRequest = z.infer<typeof createAgentSchema>;

/** 본인 프로필 수정(name/phone) + owner의 멤버 status 변경 */
export const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  status: z.enum(agentStatuses).optional(),
});
export type UpdateAgentRequest = z.infer<typeof updateAgentSchema>;

export interface AgentRow {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  role: 'owner' | 'member';
  status: (typeof agentStatuses)[number];
  createdAt: string;
}

/** 비밀번호 변경 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;

/** 사무소 정보 수정 (owner only) */
export const updateAgencySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  businessNumber: z.string().max(20).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(255).optional(),
});
export type UpdateAgencyRequest = z.infer<typeof updateAgencySchema>;

export interface AgencyRow {
  id: number;
  name: string;
  businessNumber: string | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
}

/** 대시보드 요약 응답 */
export interface DashboardSummary {
  listings: {
    active: number;
    completed: number;
    hidden: number;
  };
  customers: {
    mine: number;
    agency: number;
  };
  matches: {
    byStatus: {
      suggested: number;
      interested: number;
      visited: number;
      contracted: number;
      rejected: number;
    };
    recent: Array<{
      id: number;
      customerName: string;
      listingTitle: string;
      status: 'suggested' | 'interested' | 'visited' | 'contracted' | 'rejected';
      createdAt: string;
    }>;
  };
}
```

- [ ] **Step 2: Modify `packages/shared/src/index.ts`** — append after the last re-export:
```ts
export * from './admin';
```

- [ ] **Step 3: Commit AND PUSH**
```bash
git add packages/shared/
git commit -m "feat(shared): add admin schemas (agent/agency/password/dashboard)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin feat/v1-agents-dashboard
```

---

## Task 2: GET /api/agents + 라우터 마운트 (TDD)

**Files:**
- Create: `api/test/agents.test.ts`, `api/src/agents/routes.ts`
- Modify: `api/src/app.ts`

- [ ] **Step 1: Create `api/test/agents.test.ts`**
```ts
import '../src/bigint-json';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app';
import { resetDb, signupAgent, addMember } from './helpers';

describe('GET /api/agents', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('인증 없으면 401', async () => {
    const app = createApp();
    const res = await request(app).get('/api/agents');
    expect(res.status).toBe(401);
  });

  it('사무소 소속 중개사 목록을 반환한다', async () => {
    const app = createApp();
    const owner = await signupAgent(app, { agencyName: 'A부동산', email: 'owner@example.com' });
    const me = await owner.get('/api/auth/me');
    await addMember(BigInt(me.body.agent.agencyId), 'm1@example.com', '멤버1');
    await addMember(BigInt(me.body.agent.agencyId), 'm2@example.com', '멤버2');

    const res = await owner.get('/api/agents');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    const names = (res.body as Array<{ name: string }>).map((a) => a.name).sort();
    expect(names).toEqual(['멤버1', '멤버2', '테스터']);
  });

  it('다른 사무소 중개사는 안 보인다', async () => {
    const app = createApp();
    const a = await signupAgent(app, { agencyName: 'A부동산', email: 'a@example.com' });
    await signupAgent(app, { agencyName: 'B부동산', email: 'b@example.com' });
    const res = await a.get('/api/agents');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect((res.body as Array<{ email: string }>)[0].email).toBe('a@example.com');
  });
});
```

- [ ] **Step 2: Run `npm run test -w api`** — expect 3 new FAIL (404), 45 prior pass.

- [ ] **Step 3: Create `api/src/agents/routes.ts`**
```ts
import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';

export const agentsRouter = Router();

agentsRouter.use(requireAuth);

/** Prisma Agent 행을 API 응답 형태로 변환 (passwordHash 제외) */
function toAgentResponse(row: Awaited<ReturnType<typeof prisma.agent.findFirstOrThrow>>) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

agentsRouter.get('/', async (req, res) => {
  const agencyId = req.agent!.agencyId;
  const agents = await prisma.agent.findMany({
    where: { agencyId },
    orderBy: { createdAt: 'asc' },
  });
  res.json(agents.map(toAgentResponse));
});
```

- [ ] **Step 4: Modify `api/src/app.ts`** — add import alongside the existing customersRouter import:
```ts
import { agentsRouter } from './agents/routes';
```
Mount it right after `app.use('/api/customers', customersRouter);`:
```ts
  app.use('/api/agents', agentsRouter);
```

- [ ] **Step 5: Run `npm run test -w api`** — expect PASS, 48 tests.

- [ ] **Step 6: Commit AND PUSH**
```bash
git add -A
git commit -m "feat(api): GET /api/agents lists agency members

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin feat/v1-agents-dashboard
```

---

## Task 3: POST /api/agents — owner만 멤버 생성 (TDD)

**Files:**
- Modify: `api/test/agents.test.ts`, `api/src/agents/routes.ts`

- [ ] **Step 1: Append to `api/test/agents.test.ts`**
```ts

describe('POST /api/agents', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('owner가 멤버를 생성하면 201', async () => {
    const app = createApp();
    const owner = await signupAgent(app, { agencyName: 'A부동산', email: 'owner@example.com' });
    const res = await owner.post('/api/agents').send({
      email: 'new@example.com',
      name: '신규멤버',
      password: 'password123',
    });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('new@example.com');
    expect(res.body.role).toBe('member');
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('member는 멤버를 생성할 수 없다 (403)', async () => {
    const app = createApp();
    const owner = await signupAgent(app, { agencyName: 'A부동산', email: 'owner@example.com' });
    const me = await owner.get('/api/auth/me');
    await addMember(BigInt(me.body.agent.agencyId), 'm@example.com', '멤버');
    const member = request.agent(app);
    await member.post('/api/auth/login').send({ email: 'm@example.com', password: 'password123' });

    const res = await member.post('/api/agents').send({
      email: 'x@example.com',
      name: 'x',
      password: 'password123',
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('이미 사용 중인 이메일이면 409', async () => {
    const app = createApp();
    const owner = await signupAgent(app, { agencyName: 'A부동산', email: 'owner@example.com' });
    await owner.post('/api/agents').send({
      email: 'dup@example.com',
      name: '첫번째',
      password: 'password123',
    });
    const dup = await owner.post('/api/agents').send({
      email: 'dup@example.com',
      name: '두번째',
      password: 'password123',
    });
    expect(dup.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run tests — expect 3 new FAIL.**

- [ ] **Step 3: Update `api/src/agents/routes.ts`**

Replace the top imports with:
```ts
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { createAgentSchema } from '@rems/shared';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';
import { ConflictError, ForbiddenError } from '../errors';
```

Append to `api/src/agents/routes.ts`:
```ts

agentsRouter.post('/', async (req, res) => {
  if (req.agent!.role !== 'owner') throw new ForbiddenError('owner만 멤버를 생성할 수 있습니다');
  const data = createAgentSchema.parse(req.body);

  const exists = await prisma.agent.findUnique({ where: { email: data.email } });
  if (exists) throw new ConflictError('이미 사용 중인 이메일입니다');

  const passwordHash = await bcrypt.hash(data.password, 10);
  const created = await prisma.agent.create({
    data: {
      agencyId: req.agent!.agencyId,
      email: data.email,
      passwordHash,
      name: data.name,
      phone: data.phone,
      role: 'member',
    },
  });
  res.status(201).json(toAgentResponse(created));
});
```

- [ ] **Step 4: Run tests — expect PASS, 51 tests.**

- [ ] **Step 5: Commit AND PUSH**
```bash
git add -A
git commit -m "feat(api): POST /api/agents (owner creates member)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin feat/v1-agents-dashboard
```

---

## Task 4: PATCH /api/agents/:id (TDD)

**Files:**
- Modify: `api/test/agents.test.ts`, `api/src/agents/routes.ts`

- [ ] **Step 1: Append to `api/test/agents.test.ts`**
```ts

describe('PATCH /api/agents/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('본인 프로필을 수정한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const me = await agent.get('/api/auth/me');
    const res = await agent.patch(`/api/agents/${me.body.agent.id}`).send({ name: '바뀐이름', phone: '010-1111-2222' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('바뀐이름');
    expect(res.body.phone).toBe('010-1111-2222');
  });

  it('owner가 멤버 status를 inactive로 바꿀 수 있다', async () => {
    const app = createApp();
    const owner = await signupAgent(app, { agencyName: 'A부동산', email: 'owner@example.com' });
    const me = await owner.get('/api/auth/me');
    await addMember(BigInt(me.body.agent.agencyId), 'm@example.com', '멤버');
    const agents = await owner.get('/api/agents');
    const member = (agents.body as Array<{ id: number; email: string }>).find((a) => a.email === 'm@example.com')!;

    const res = await owner.patch(`/api/agents/${member.id}`).send({ status: 'inactive' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('inactive');
  });

  it('member가 다른 사람의 status를 바꾸려 하면 403', async () => {
    const app = createApp();
    const owner = await signupAgent(app, { agencyName: 'A부동산', email: 'owner@example.com' });
    const me = await owner.get('/api/auth/me');
    await addMember(BigInt(me.body.agent.agencyId), 'm1@example.com', '멤버1');
    await addMember(BigInt(me.body.agent.agencyId), 'm2@example.com', '멤버2');
    const m1 = request.agent(app);
    await m1.post('/api/auth/login').send({ email: 'm1@example.com', password: 'password123' });
    const agents = await owner.get('/api/agents');
    const m2Id = (agents.body as Array<{ id: number; email: string }>).find((a) => a.email === 'm2@example.com')!.id;

    const res = await m1.patch(`/api/agents/${m2Id}`).send({ status: 'inactive' });
    expect(res.status).toBe(403);
  });

  it('다른 사무소 agent 수정은 404', async () => {
    const app = createApp();
    const ownerA = await signupAgent(app, { agencyName: 'A부동산', email: 'a@example.com' });
    const ownerB = await signupAgent(app, { agencyName: 'B부동산', email: 'b@example.com' });
    const meB = await ownerB.get('/api/auth/me');
    const res = await ownerA.patch(`/api/agents/${meB.body.agent.id}`).send({ name: 'x' });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests — expect 4 new FAIL.**

- [ ] **Step 3: Update `api/src/agents/routes.ts`**

Update imports:
```ts
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { createAgentSchema, updateAgentSchema } from '@rems/shared';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors';
```

Append:
```ts

agentsRouter.patch('/:id', async (req, res) => {
  const numericId = Number(req.params.id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new NotFoundError('중개사를 찾을 수 없습니다');
  }
  const target = await prisma.agent.findFirst({
    where: { id: BigInt(numericId), agencyId: req.agent!.agencyId },
  });
  if (!target) throw new NotFoundError('중개사를 찾을 수 없습니다');

  const data = updateAgentSchema.parse(req.body);
  const isSelf = target.id === req.agent!.id;
  const isOwner = req.agent!.role === 'owner';

  // status 변경은 owner만, 그리고 자기 자신은 자신의 status를 바꾸지 못함 (owner가 본인을 inactive 시키는 일 방지)
  if (data.status !== undefined) {
    if (!isOwner) throw new ForbiddenError('status는 owner만 변경할 수 있습니다');
    if (isSelf) throw new ForbiddenError('본인 status는 변경할 수 없습니다');
  }
  // name/phone 변경은 self 또는 owner
  if ((data.name !== undefined || data.phone !== undefined) && !isSelf && !isOwner) {
    throw new ForbiddenError('다른 중개사의 프로필은 수정할 수 없습니다');
  }

  const updated = await prisma.agent.update({
    where: { id: target.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });
  res.json(toAgentResponse(updated));
});
```

- [ ] **Step 4: Run tests — expect PASS, 55 tests.**

- [ ] **Step 5: Commit AND PUSH**
```bash
git add -A
git commit -m "feat(api): PATCH /api/agents/:id (self profile / owner manage)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin feat/v1-agents-dashboard
```

---

## Task 5: PATCH /api/auth/password — 비밀번호 변경 (TDD)

**Files:**
- Modify: `api/test/auth.test.ts`, `api/src/auth/routes.ts`

- [ ] **Step 1: Append to `api/test/auth.test.ts`**
```ts

describe('PATCH /api/auth/password', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('현재 비밀번호로 새 비밀번호로 변경한다', async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({
      agency: { name: 'A부동산' },
      owner: { email: 'pw@example.com', password: 'oldpass123', name: '테스터' },
    });
    const res = await agent
      .patch('/api/auth/password')
      .send({ currentPassword: 'oldpass123', newPassword: 'newpass456' });
    expect(res.status).toBe(204);

    // 새 비번으로 로그인
    const newAgent = request.agent(app);
    const login = await newAgent.post('/api/auth/login').send({ email: 'pw@example.com', password: 'newpass456' });
    expect(login.status).toBe(200);
  });

  it('현재 비번이 틀리면 401', async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({
      agency: { name: 'A부동산' },
      owner: { email: 'pw@example.com', password: 'oldpass123', name: '테스터' },
    });
    const res = await agent
      .patch('/api/auth/password')
      .send({ currentPassword: 'WRONG', newPassword: 'newpass456' });
    expect(res.status).toBe(401);
  });

  it('새 비번이 8자 미만이면 400', async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({
      agency: { name: 'A부동산' },
      owner: { email: 'pw@example.com', password: 'oldpass123', name: '테스터' },
    });
    const res = await agent
      .patch('/api/auth/password')
      .send({ currentPassword: 'oldpass123', newPassword: 'short' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests — expect 3 new FAIL (route missing).**

- [ ] **Step 3: Modify `api/src/auth/routes.ts`**

Update the `@rems/shared` import to add `changePasswordSchema`:
```ts
import { signupSchema, loginSchema, changePasswordSchema } from '@rems/shared';
```

Append to `api/src/auth/routes.ts`:
```ts

authRouter.patch('/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const agent = await prisma.agent.findUnique({ where: { id: req.agent!.id } });
  if (!agent) throw new UnauthorizedError();
  const ok = await verifyPassword(currentPassword, agent.passwordHash);
  if (!ok) throw new UnauthorizedError('현재 비밀번호가 올바르지 않습니다');
  const passwordHash = await hashPassword(newPassword);
  await prisma.agent.update({ where: { id: agent.id }, data: { passwordHash } });
  res.status(204).send();
});
```

- [ ] **Step 4: Run tests — expect PASS, 58 tests.**

- [ ] **Step 5: Commit AND PUSH**
```bash
git add -A
git commit -m "feat(api): PATCH /api/auth/password (change own password)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin feat/v1-agents-dashboard
```

---

## Task 6: PATCH /api/agency — owner만 사무소 정보 수정 (TDD)

**Files:**
- Create: `api/test/agency.test.ts`, `api/src/agency/routes.ts`
- Modify: `api/src/app.ts`

- [ ] **Step 1: Create `api/test/agency.test.ts`**
```ts
import '../src/bigint-json';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app';
import { resetDb, signupAgent, addMember } from './helpers';

describe('PATCH /api/agency', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('owner가 사무소 정보를 수정한다', async () => {
    const app = createApp();
    const owner = await signupAgent(app, { agencyName: 'A부동산', email: 'owner@example.com' });
    const res = await owner.patch('/api/agency').send({
      name: '강남부동산',
      phone: '02-1234-5678',
      address: '서울 강남구',
    });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('강남부동산');
    expect(res.body.phone).toBe('02-1234-5678');
  });

  it('member는 수정 못 함 (403)', async () => {
    const app = createApp();
    const owner = await signupAgent(app, { agencyName: 'A부동산', email: 'owner@example.com' });
    const me = await owner.get('/api/auth/me');
    await addMember(BigInt(me.body.agent.agencyId), 'm@example.com', '멤버');
    const member = request.agent(app);
    await member.post('/api/auth/login').send({ email: 'm@example.com', password: 'password123' });
    const res = await member.patch('/api/agency').send({ name: 'x' });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests — expect 2 new FAIL.**

- [ ] **Step 3: Create `api/src/agency/routes.ts`**
```ts
import { Router } from 'express';
import { updateAgencySchema } from '@rems/shared';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';
import { ForbiddenError } from '../errors';

export const agencyRouter = Router();

agencyRouter.use(requireAuth);

function toAgencyResponse(row: Awaited<ReturnType<typeof prisma.agency.findUniqueOrThrow>>) {
  return {
    id: row.id,
    name: row.name,
    businessNumber: row.businessNumber,
    phone: row.phone,
    address: row.address,
    createdAt: row.createdAt.toISOString(),
  };
}

agencyRouter.patch('/', async (req, res) => {
  if (req.agent!.role !== 'owner') throw new ForbiddenError('owner만 사무소 정보를 수정할 수 있습니다');
  const data = updateAgencySchema.parse(req.body);
  const updated = await prisma.agency.update({
    where: { id: req.agent!.agencyId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.businessNumber !== undefined ? { businessNumber: data.businessNumber } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
    },
  });
  res.json(toAgencyResponse(updated));
});
```

- [ ] **Step 4: Modify `api/src/app.ts`** — add import + mount:
```ts
import { agencyRouter } from './agency/routes';
```
Mount after `app.use('/api/agents', agentsRouter);`:
```ts
  app.use('/api/agency', agencyRouter);
```

- [ ] **Step 5: Run tests — expect PASS, 60 tests.**

- [ ] **Step 6: Commit AND PUSH**
```bash
git add -A
git commit -m "feat(api): PATCH /api/agency (owner updates office info)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin feat/v1-agents-dashboard
```

---

## Task 7: GET /api/dashboard/summary (TDD)

**Files:**
- Create: `api/test/dashboard.test.ts`, `api/src/dashboard/routes.ts`
- Modify: `api/src/app.ts`

- [ ] **Step 1: Create `api/test/dashboard.test.ts`**
```ts
import '../src/bigint-json';
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app';
import { resetDb, signupAgent } from './helpers';

describe('GET /api/dashboard/summary', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('빈 사무소는 0 카운트를 반환한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const res = await agent.get('/api/dashboard/summary');
    expect(res.status).toBe(200);
    expect(res.body.listings).toEqual({ active: 0, completed: 0, hidden: 0 });
    expect(res.body.customers).toEqual({ mine: 0, agency: 0 });
    expect(res.body.matches.byStatus.suggested).toBe(0);
    expect(res.body.matches.recent).toEqual([]);
  });

  it('매물·고객·매칭 카운트가 정확히 집계된다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    // 매물 2개 (active 1, completed 1)
    const l1 = await agent.post('/api/listings').send({
      title: '매물1', dealType: 'sale', propertyType: 'apartment',
      salePrice: 1000000000, areaM2: 60, address: '서울',
    });
    const l2 = await agent.post('/api/listings').send({
      title: '매물2', dealType: 'sale', propertyType: 'apartment',
      salePrice: 2000000000, areaM2: 80, address: '서울',
    });
    await agent.patch(`/api/listings/${l2.body.id}`).send({ status: 'completed' });

    // 고객 2명
    const c1 = await agent.post('/api/customers').send({ name: '고객A', customerType: 'buyer' });
    await agent.post('/api/customers').send({ name: '고객B', customerType: 'buyer' });

    // 매칭 1건 (suggested)
    await agent.post(`/api/customers/${c1.body.id}/listings`).send({ listingId: l1.body.id });

    const res = await agent.get('/api/dashboard/summary');
    expect(res.status).toBe(200);
    expect(res.body.listings).toEqual({ active: 1, completed: 1, hidden: 0 });
    expect(res.body.customers.mine).toBe(2);
    expect(res.body.customers.agency).toBe(2);
    expect(res.body.matches.byStatus.suggested).toBe(1);
    expect(res.body.matches.recent).toHaveLength(1);
    expect(res.body.matches.recent[0].customerName).toBe('고객A');
    expect(res.body.matches.recent[0].listingTitle).toBe('매물1');
  });
});
```

- [ ] **Step 2: Run tests — expect 2 new FAIL.**

- [ ] **Step 3: Create `api/src/dashboard/routes.ts`**
```ts
import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get('/summary', async (req, res) => {
  const agent = req.agent!;
  const agencyId = agent.agencyId;

  // 매물 status별 카운트
  const listingGroups = await prisma.listing.groupBy({
    by: ['status'],
    where: { agencyId },
    _count: { _all: true },
  });
  const listings = { active: 0, completed: 0, hidden: 0 };
  for (const g of listingGroups) {
    listings[g.status] = g._count._all;
  }

  // 고객 카운트 (mine + agency 전체)
  const [mineCount, agencyCount] = await Promise.all([
    prisma.customer.count({ where: { agencyId, ownerAgentId: agent.id } }),
    prisma.customer.count({ where: { agencyId } }),
  ]);

  // 매칭 — 본인 고객 범위에서 집계 (member는 본인 것, owner는 사무소 전체)
  const customerWhere = agent.role === 'member'
    ? { agencyId, ownerAgentId: agent.id }
    : { agencyId };
  const myCustomerIds = (
    await prisma.customer.findMany({ where: customerWhere, select: { id: true } })
  ).map((c) => c.id);

  const matchGroups = myCustomerIds.length === 0
    ? []
    : await prisma.customerListing.groupBy({
        by: ['status'],
        where: { customerId: { in: myCustomerIds } },
        _count: { _all: true },
      });
  const byStatus = { suggested: 0, interested: 0, visited: 0, contracted: 0, rejected: 0 };
  for (const g of matchGroups) {
    byStatus[g.status] = g._count._all;
  }

  const recentRows = myCustomerIds.length === 0
    ? []
    : await prisma.customerListing.findMany({
        where: { customerId: { in: myCustomerIds } },
        include: {
          customer: { select: { name: true } },
          listing: { select: { title: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

  res.json({
    listings,
    customers: { mine: mineCount, agency: agencyCount },
    matches: {
      byStatus,
      recent: recentRows.map((m) => ({
        id: m.id,
        customerName: m.customer.name,
        listingTitle: m.listing.title,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
      })),
    },
  });
});
```

- [ ] **Step 4: Modify `api/src/app.ts`** — add import + mount:
```ts
import { dashboardRouter } from './dashboard/routes';
```
Mount after `app.use('/api/agency', agencyRouter);`:
```ts
  app.use('/api/dashboard', dashboardRouter);
```

- [ ] **Step 5: Run tests — expect PASS, 62 tests.**

- [ ] **Step 6: Commit AND PUSH**
```bash
git add -A
git commit -m "feat(api): GET /api/dashboard/summary aggregates listings/customers/matches

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin feat/v1-agents-dashboard
```

---

# Phase B — 프론트엔드

## Task 8: Admin API 클라이언트

**Files:**
- Create: `web/src/api/admin.ts`

- [ ] **Step 1: Create `web/src/api/admin.ts`**
```ts
import type {
  AgentRow,
  AgencyRow,
  CreateAgentRequest,
  UpdateAgentRequest,
  UpdateAgencyRequest,
  ChangePasswordRequest,
  DashboardSummary,
} from '@rems/shared'
import { apiFetch } from './client'

export function listAgents(): Promise<AgentRow[]> {
  return apiFetch<AgentRow[]>('/agents')
}

export function createAgent(data: CreateAgentRequest): Promise<AgentRow> {
  return apiFetch<AgentRow>('/agents', { method: 'POST', body: JSON.stringify(data) })
}

export function updateAgent(id: number, data: UpdateAgentRequest): Promise<AgentRow> {
  return apiFetch<AgentRow>(`/agents/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export function changePassword(data: ChangePasswordRequest): Promise<void> {
  return apiFetch<void>('/auth/password', { method: 'PATCH', body: JSON.stringify(data) })
}

export function updateAgency(data: UpdateAgencyRequest): Promise<AgencyRow> {
  return apiFetch<AgencyRow>('/agency', { method: 'PATCH', body: JSON.stringify(data) })
}

export function getDashboardSummary(): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>('/dashboard/summary')
}
```

- [ ] **Step 2: Commit AND PUSH**
```bash
git add web/src/api/admin.ts
git commit -m "feat(web): admin API client (agents/agency/password/dashboard)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin feat/v1-agents-dashboard
```

---

## Task 9: Dashboard 페이지 교체 (REMS 통계 + 차트)

기존 `web/src/pages/dashboard/Dashboard.tsx`(템플릿 데모)를 REMS 대시보드로 교체. StatCard(이미 존재) + chart.js로 매칭 상태 도넛 차트.

**Files:**
- Modify (replace contents): `web/src/pages/dashboard/Dashboard.tsx`

- [ ] **Step 1: Replace the ENTIRE contents of `web/src/pages/dashboard/Dashboard.tsx`** with:
```tsx
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Building, Users, CheckCircle2, Sparkles } from 'lucide-react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import StatCard from '../../components/common/StatCard'
import { getDashboardSummary } from '../../api/admin'
import { useAuth } from '../../auth/AuthContext'

ChartJS.register(ArcElement, Tooltip, Legend)

const statusLabels: Record<string, string> = {
  suggested: '추천', interested: '관심', visited: '임장', contracted: '계약', rejected: '보류',
}

export default function Dashboard() {
  const { agent } = useAuth()
  const isOwner = agent?.role === 'owner'
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary,
  })

  if (isLoading || !data) {
    return <div className="p-6 text-hud-text-muted">불러오는 중...</div>
  }

  const matchTotal = Object.values(data.matches.byStatus).reduce((a, b) => a + b, 0)

  const chartData = {
    labels: Object.keys(data.matches.byStatus).map((k) => statusLabels[k]),
    datasets: [
      {
        data: Object.values(data.matches.byStatus),
        backgroundColor: [
          'rgba(148, 163, 184, 0.6)', // suggested - slate
          'rgba(59, 130, 246, 0.6)',  // interested - blue
          'rgba(245, 158, 11, 0.6)',  // visited - amber
          'rgba(34, 197, 94, 0.6)',   // contracted - green
          'rgba(100, 116, 139, 0.4)', // rejected - muted
        ],
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
      },
    ],
  }

  return (
    <div className="p-6 text-hud-text-primary space-y-6">
      <h1 className="text-2xl font-bold">대시보드</h1>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="거래중 매물"
          value={String(data.listings.active)}
          icon={<Building size={20} />}
          accent="primary"
        />
        <StatCard
          title="거래완료"
          value={String(data.listings.completed)}
          icon={<CheckCircle2 size={20} />}
          accent="success"
        />
        <StatCard
          title="내 고객"
          value={String(data.customers.mine)}
          icon={<Users size={20} />}
          accent="info"
        />
        <StatCard
          title={isOwner ? '사무소 전체 고객' : '진행 중 매칭'}
          value={isOwner
            ? String(data.customers.agency)
            : String(data.matches.byStatus.interested + data.matches.byStatus.visited)}
          icon={<Sparkles size={20} />}
          accent="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="hud-card rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">매칭 상태 분포</h2>
          {matchTotal === 0 ? (
            <p className="text-hud-text-muted text-sm">매칭이 아직 없습니다.</p>
          ) : (
            <div className="max-w-xs mx-auto">
              <Doughnut data={chartData} options={{ plugins: { legend: { position: 'bottom', labels: { color: 'rgba(255,255,255,0.7)' } } } }} />
            </div>
          )}
        </div>

        <div className="hud-card rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">최근 매칭</h2>
          {data.matches.recent.length === 0 ? (
            <p className="text-hud-text-muted text-sm">최근 매칭이 없습니다.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.matches.recent.map((m) => (
                <li key={m.id} className="flex items-center justify-between border-b border-hud-border-secondary pb-2 last:border-0">
                  <div>
                    <Link to={`/customers`} className="text-hud-accent-primary hover:underline">{m.customerName}</Link>
                    <span className="text-hud-text-muted"> → </span>
                    <span>{m.listingTitle}</span>
                  </div>
                  <span className="text-xs text-hud-text-muted">{statusLabels[m.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
```

(Note: `StatCard`'s exact prop API may differ from `title/value/icon/accent` — read `web/src/components/common/StatCard.tsx` to confirm the actual props and adapt. If a prop is named differently, adjust to match the existing component's API.)

- [ ] **Step 2: Run `npm run build -w web`** — confirm build passes. If `StatCard` prop names differ, adjust the page to match the actual component API.

- [ ] **Step 3: Commit AND PUSH**
```bash
git add web/src/pages/dashboard/Dashboard.tsx
git commit -m "feat(web): REMS dashboard with stats + match status chart

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin feat/v1-agents-dashboard
```

---

## Task 10: Settings 페이지 교체 (5 섹션)

기존 `web/src/pages/Settings.tsx`(템플릿 데모 + 기존 테마 컨트롤)를 REMS Settings로 교체하되 **테마 섹션은 보존**한다. 5개 섹션: 사무소 정보 / 내 계정 / 비밀번호 변경 / 중개사 관리(owner만) / 테마(기존 보존).

**Files:**
- Modify: `web/src/pages/Settings.tsx`

- [ ] **Step 1: Read current `web/src/pages/Settings.tsx`**

The current file contains the template's settings UI plus the user's theme control work. Identify the theme section (likely uses `ThemeContext`, palette/font controls) — that block must be preserved verbatim. The rest of the file (other template demo sections) will be replaced.

- [ ] **Step 2: Replace `web/src/pages/Settings.tsx`** to contain 5 sections in order:

1. **사무소 정보** — fields name/businessNumber/phone/address, owner only edit, member read-only
2. **내 계정** — current agent's name/phone, all can edit own
3. **비밀번호 변경** — currentPassword/newPassword/confirmNewPassword
4. **중개사 관리** (owner only — hide entire section for member) — table of agents + "멤버 추가" form (email/name/password) + status toggle per member
5. **외관 (테마)** — restore the existing theme controls from the previous file verbatim

Use HUD styling throughout (hud-card section wrappers, hud-bg-*/hud-text-*, hud-accent-* color tokens, lucide icons, Button variant/glow). Each editable section has its own save button with a `useMutation` calling the corresponding admin API (`updateAgency`, `updateAgent`, `changePassword`, `createAgent`, `updateAgent`). Use `useAuth()` to get current agent + role.

Reference for sectioned-form styling: the auth pages (`Login.tsx`, `Signup.tsx`) and customer form (`CustomerForm.tsx`) — same `inputCls`, label styling, error display.

Reference for the agents table: customer list page (`CustomerList.tsx`) — same HUD table pattern with `divide-y divide-hud-border-secondary` rows.

Required imports — bring in what you need:
```tsx
import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building, User, Lock, UserPlus, Users } from 'lucide-react'
import Button from '../components/common/Button'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import {
  listAgents, createAgent, updateAgent,
  updateAgency, changePassword,
} from '../api/admin'
```

For each section: 
- Wrap in a `<section className="hud-card rounded-lg p-6">` with an `<h2>` title and an icon.
- Use the same `inputCls = "w-full px-4 py-3 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"` for inputs.
- Save buttons use `<Button variant="primary" glow type="submit" disabled={mutation.isPending}>`.
- Show success/error feedback inline (a short message after save).

For section 4 (중개사 관리), only render when `agent.role === 'owner'`. Inside: 
- `useQuery({ queryKey: ['agents'], queryFn: listAgents })` to fetch members
- HUD table with columns 이름/이메일/역할/상태/액션 — status toggle button calls `updateAgent(id, { status: ... })`
- An "멤버 추가" form (email/name/password) below the table

Concrete agent-management form pattern (use this exactly):
```tsx
<form onSubmit={onAddMember} className="flex flex-wrap gap-2 mt-4">
  <input className={inputCls + ' flex-1 min-w-[180px]'} type="email" required placeholder="이메일" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
  <input className={inputCls + ' flex-1 min-w-[120px]'} required placeholder="이름" value={newName} onChange={(e) => setNewName(e.target.value)} />
  <input className={inputCls + ' flex-1 min-w-[140px]'} type="password" required minLength={8} placeholder="임시 비밀번호 (8자 이상)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
  <Button variant="primary" type="submit" disabled={addMember.isPending} leftIcon={<UserPlus size={16} />}>멤버 추가</Button>
</form>
```

For the theme section (5번째), copy verbatim from the existing `Settings.tsx` — do NOT rewrite the theme controls.

Final file should compile cleanly with `npm run build -w web`.

- [ ] **Step 3: Run `npm run build -w web`** — confirm clean build.

- [ ] **Step 4: Commit AND PUSH**
```bash
git add web/src/pages/Settings.tsx
git commit -m "feat(web): REMS settings page (agency / account / password / agents / theme)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin feat/v1-agents-dashboard
```

---

## Task 11: 통합 동작 확인

**Files:** (수정 없음 — 수동 검증)

- [ ] **Step 1: 전체 테스트**

Run: `npm run test -w api`
Expected: ~62건 모두 통과.

- [ ] **Step 2: 전체 빌드**

Run: `npm run build -w web`
Expected: 클린 빌드.

- [ ] **Step 3: dev 흐름 수동 확인**

Run (다른 터미널): `npm run dev`. 브라우저에서:
1. 로그인 → 대시보드(`/`)에 매물·고객·매칭 통계 + 도넛 차트 + 최근 매칭 표시
2. Settings → 사무소 정보 수정 → 새로고침 후 반영 확인
3. Settings → 내 계정 이름·전화 수정
4. Settings → 비밀번호 변경 → 로그아웃 → 새 비번으로 로그인 성공
5. (owner) Settings → 중개사 관리 → 멤버 추가 → 표에 표시 → status `inactive` 토글 → 멤버 로그인 시도하면 (현재는 status 차단이 인증 흐름엔 없을 수 있음 — Plan 5 범위 아님, 향후 개선)
6. (선택) member 로그인 시 Settings 중개사 관리 섹션이 안 보이는지 확인

---

## v1 완료

Plan 5까지 머지되면 REMS v1 완성. 이후 v2 후보 항목: Python 수집 워커(네이버 매물 + 공공데이터), 좌표 공간 인덱스 + 반경 검색, 실거래가 시세 비교, 구독 결제, audit log, 실시간 알림, agent status가 active=false면 로그인 차단, member 가입 초대 이메일 흐름.
