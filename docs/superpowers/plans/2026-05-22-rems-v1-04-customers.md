# REMS v1 — Plan 4: Customers & Matching 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사무소 중개사가 본인 고객(매수/매도/임차/임대 희망자)을 관리하고 매물에 매칭하는 CRM 기능을 구축한다. 고객은 담당 중개사 개인 소속(member는 본인 고객만, owner는 사무소 전체). 매칭은 사무소 내 매물에 한해 자유롭게 생성·수정·삭제.

**Architecture:** 매물(Plan 3)과 동일 패턴 — `requireAuth` + `agency_id` 필터. 고객은 추가로 role-aware 필터: member는 `owner_agent_id = self`. 매칭 라우트는 customer 소유권을 먼저 검증한 뒤 listing이 같은 agency인지 확인. 프론트엔드는 템플릿 HUD 스타일(hud-card, lucide 아이콘, Button variant/glow)을 그대로 사용하며 TableElements·FormElements·Products 패턴을 참고한다.

**Tech Stack:** Express 5 + Prisma + zod (백엔드); React + TanStack Query + lucide-react + HUD 테마 (프론트).

---

## 사전 준비 (실행 전 확인)

- `main` = `063a728` (Plan 3 + 리뷰 후속). 새 브랜치 `feat/v1-customers`에서 진행
- MariaDB Docker 컨테이너 실행 중, 7개 테이블 마이그레이션 완료(customer/customer_listing 포함)
- 현재 api 테스트 27건 통과, web 빌드 정상
- **메모리 준수**: 프론트엔드 페이지는 템플릿의 HUD 스타일을 그대로 따른다 — bare Tailwind 금지

## 완료 기준

- `npm run test -w api` 통과 — 기존 27건 + 고객 CRUD·매칭·테넌트/역할 격리 신규 ~19건
- `npm run dev` → 로그인 후 사이드바 "고객"으로 진입, 고객 등록·목록·상세·수정·삭제, 고객 상세에서 매물 매칭 추가·상태 변경
- 사무소 A의 member 세션으로 사무소 B의 고객 접근 시 404
- 사무소 A의 member1 세션으로 member2의 고객 접근 시 404 (사무소 내부 역할 격리)
- owner 역할은 사무소 전체 고객 조회 가능

## 새 브랜치 생성

```bash
cd "/Volumes/MacExtend 1/REMS"
git checkout main
git checkout -b feat/v1-customers
```

## 파일 구조

```
packages/shared/src/
  customers.ts                  — NEW: customer + matching zod 스키마 + 타입
  index.ts                      — modified: re-export
api/src/
  customers/routes.ts           — NEW: customer CRUD + matching 라우트
  app.ts                        — modified: customers 라우터 마운트
api/test/
  customers.test.ts             — NEW: CRUD + matching 테스트
  tenant-isolation.test.ts      — modified: 고객 격리 + role 격리 추가
web/src/
  api/customers.ts              — NEW: 고객 API 클라이언트
  pages/customers/
    CustomerList.tsx            — NEW: HUD 표 + 필터
    CustomerDetail.tsx          — NEW: 상세 + 매칭 매트릭스
    CustomerForm.tsx            — NEW: HUD 폼
  App.tsx                       — modified: 고객 라우트
  components/layout/Sidebar.tsx — modified: 고객 메뉴
```

---

# Phase A — 고객 백엔드

## Task 1: 공유 고객 + 매칭 zod 스키마

**Files:**
- Create: `packages/shared/src/customers.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: packages/shared/src/customers.ts 생성**

```ts
import { z } from 'zod';

export const customerTypes = ['buyer', 'seller', 'tenant', 'landlord'] as const;
export const matchStatuses = ['suggested', 'interested', 'visited', 'contracted', 'rejected'] as const;

const customerFields = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().max(20).optional(),
  customerType: z.enum(customerTypes),
  budgetMin: z.number().int().nonnegative().optional(),
  budgetMax: z.number().int().nonnegative().optional(),
  desiredArea: z.string().max(255).optional(),
  memo: z.string().max(5000).optional(),
});

export const createCustomerSchema = customerFields;
export type CreateCustomerRequest = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = customerFields.partial();
export type UpdateCustomerRequest = z.infer<typeof updateCustomerSchema>;

export const customerFilterSchema = z.object({
  customerType: z.enum(customerTypes).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type CustomerFilter = z.infer<typeof customerFilterSchema>;

export interface Customer {
  id: number;
  agencyId: number;
  ownerAgentId: number;
  name: string;
  phone: string | null;
  customerType: (typeof customerTypes)[number];
  budgetMin: number | null;
  budgetMax: number | null;
  desiredArea: string | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
}

export const createMatchSchema = z.object({
  listingId: z.number().int().positive(),
  status: z.enum(matchStatuses).optional(),
  memo: z.string().max(2000).optional(),
});
export type CreateMatchRequest = z.infer<typeof createMatchSchema>;

export const updateMatchSchema = z.object({
  status: z.enum(matchStatuses).optional(),
  memo: z.string().max(2000).optional(),
});
export type UpdateMatchRequest = z.infer<typeof updateMatchSchema>;

export interface CustomerListingMatch {
  id: number;
  customerId: number;
  listingId: number;
  status: (typeof matchStatuses)[number];
  memo: string | null;
  createdAt: string;
  updatedAt: string;
  /** 응답 편의용 매물 요약 (목록 GET에서 포함) */
  listing?: {
    id: number;
    title: string;
    address: string;
    dealType: 'sale' | 'jeonse' | 'wolse';
    status: 'active' | 'completed' | 'hidden';
  };
}
```

- [ ] **Step 2: packages/shared/src/index.ts re-export 추가**

In `packages/shared/src/index.ts`, the last lines are `export * from './auth';` and `export * from './listings';`. Add a new line right after:
```ts
export * from './customers';
```

- [ ] **Step 3: 커밋**

```bash
git add packages/shared/
git commit -m "feat(shared): add customer + matching zod schemas

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 고객 등록 라우트 (POST) + 라우터 마운트 (TDD)

**Files:**
- Create: `api/test/customers.test.ts`
- Create: `api/src/customers/routes.ts`
- Modify: `api/src/app.ts`

- [ ] **Step 1: api/test/customers.test.ts 생성**

```ts
import '../src/bigint-json';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app';
import { resetDb, signupAgent } from './helpers';

const sampleCustomer = {
  name: '김매수',
  phone: '010-1234-5678',
  customerType: 'buyer',
  budgetMin: 500000000,
  budgetMax: 1500000000,
  desiredArea: '강남구',
  memo: '아파트 선호',
};

describe('POST /api/customers', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('인증 없으면 401', async () => {
    const app = createApp();
    const res = await request(app).post('/api/customers').send(sampleCustomer);
    expect(res.status).toBe(401);
  });

  it('고객을 등록하고 201 + 생성된 고객을 반환한다 — owner_agent_id는 현재 agent', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const me = await agent.get('/api/auth/me');
    const res = await agent.post('/api/customers').send(sampleCustomer);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('김매수');
    expect(res.body.customerType).toBe('buyer');
    expect(res.body.budgetMax).toBe(1500000000);
    expect(res.body.ownerAgentId).toBe(me.body.agent.id);
    expect(res.body.agencyId).toBe(me.body.agent.agencyId);
  });

  it('필수 필드 누락 시 400', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const res = await agent.post('/api/customers').send({ phone: '010-0000-0000' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npm run test -w api`
Expected: customers 테스트 3건 FAIL (404, 라우터 없음). 기존 27건 통과.

- [ ] **Step 3: api/src/customers/routes.ts 생성**

```ts
import { Router } from 'express';
import { createCustomerSchema } from '@rems/shared';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';

export const customersRouter = Router();

customersRouter.use(requireAuth);

/** Prisma Customer 행을 API 응답 형태로 변환한다 */
function toCustomerResponse(row: Awaited<ReturnType<typeof prisma.customer.findFirstOrThrow>>) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

customersRouter.post('/', async (req, res) => {
  const data = createCustomerSchema.parse(req.body);
  const agent = req.agent!;
  const created = await prisma.customer.create({
    data: {
      agencyId: agent.agencyId,
      ownerAgentId: agent.id,
      name: data.name,
      phone: data.phone,
      customerType: data.customerType,
      budgetMin: data.budgetMin == null ? null : BigInt(data.budgetMin),
      budgetMax: data.budgetMax == null ? null : BigInt(data.budgetMax),
      desiredArea: data.desiredArea,
      memo: data.memo,
    },
  });
  res.status(201).json(toCustomerResponse(created));
});
```

- [ ] **Step 4: api/src/app.ts에 customers 라우터 마운트**

Add an import alongside the existing `listingsRouter` import:
```ts
import { customersRouter } from './customers/routes';
```
Mount it right after the `app.use('/api/listings', listingsRouter);` line:
```ts
  app.use('/api/customers', customersRouter);
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

Run: `npm run test -w api`
Expected: PASS — 30건.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat(api): POST /api/customers creates owner-scoped customer

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 고객 목록·상세 라우트 (GET) + 역할별 필터 (TDD)

**Files:**
- Modify: `api/test/customers.test.ts`
- Modify: `api/src/customers/routes.ts`

- [ ] **Step 1a: helpers.ts에 `addMember` 헬퍼 추가**

`POST /api/agents`는 Plan 5에서 추가될 예정이므로, Plan 4 테스트는 멤버를 직접 DB로 생성한다.

Replace the ENTIRE contents of `api/test/helpers.ts` with:
```ts
import request from 'supertest';
import type { Express } from 'express';
import bcrypt from 'bcrypt';
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

/** 사무소를 가입시키고 세션 쿠키를 보유한 supertest agent를 반환한다 */
export async function signupAgent(
  app: Express,
  opts: { agencyName?: string; email?: string } = {},
) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/signup').send({
    agency: { name: opts.agencyName ?? '테스트부동산' },
    owner: {
      email: opts.email ?? 'tester@example.com',
      password: 'password123',
      name: '테스터',
    },
  });
  if (res.status !== 201) {
    throw new Error(`signupAgent 실패: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}

/** Plan 5의 POST /api/agents 라우트 전까지 멤버 계정은 직접 DB로 생성 (테스트 전용) */
export async function addMember(
  agencyId: bigint,
  email: string,
  name: string,
  password = 'password123',
): Promise<void> {
  await prisma.agent.create({
    data: {
      agencyId,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      name,
      role: 'member',
    },
  });
}
```

- [ ] **Step 1b: 실패하는 테스트 추가**

Update the import at the top of `api/test/customers.test.ts` to include `addMember`:
```ts
import { resetDb, signupAgent, addMember } from './helpers';
```

Append to `api/test/customers.test.ts`:
```ts

describe('GET /api/customers', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('member는 본인 고객만 본다', async () => {
    const app = createApp();
    // owner 가입 → 고객 1명
    const owner = await signupAgent(app, { agencyName: 'A부동산', email: 'owner@example.com' });
    await owner.post('/api/customers').send(sampleCustomer);
    // owner가 member 추가 (직접 DB — /api/agents는 Plan 5)
    const me = await owner.get('/api/auth/me');
    await addMember(BigInt(me.body.agent.agencyId), 'm@example.com', '멤버');
    // member 로그인
    const member = request.agent(app);
    await member.post('/api/auth/login').send({ email: 'm@example.com', password: 'password123' });
    // member 자신의 고객 1명
    await member.post('/api/customers').send({ ...sampleCustomer, name: '멤버의 고객' });

    const memberList = await member.get('/api/customers');
    expect(memberList.body.total).toBe(1);
    expect(memberList.body.data[0].name).toBe('멤버의 고객');

    const ownerList = await owner.get('/api/customers');
    expect(ownerList.body.total).toBe(2); // owner는 사무소 전체
  });

  it('customerType 필터가 동작한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    await agent.post('/api/customers').send(sampleCustomer); // buyer
    await agent.post('/api/customers').send({ name: '박매도', customerType: 'seller' });

    const res = await agent.get('/api/customers?customerType=seller');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].name).toBe('박매도');
  });
});

describe('GET /api/customers/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('고객 상세를 반환한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const created = await agent.post('/api/customers').send(sampleCustomer);
    const res = await agent.get(`/api/customers/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.name).toBe('김매수');
  });

  it('없는 고객이면 404', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const res = await agent.get('/api/customers/999999');
    expect(res.status).toBe(404);
  });
});
```

(Note: `POST /api/agents`는 Plan 5에서 추가될 예정이므로, Plan 4 테스트는 `addMember` 헬퍼로 멤버를 직접 DB로 생성한다.)

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npm run test -w api`
Expected: GET 테스트 FAIL (404).

- [ ] **Step 3: routes.ts에 헬퍼 + 목록·상세 추가**

Update the import block at the top of `api/src/customers/routes.ts` to:
```ts
import { Router } from 'express';
import { createCustomerSchema, customerFilterSchema } from '@rems/shared';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';
import { NotFoundError } from '../errors';
import type { AuthenticatedAgent } from '../auth/session';
```

Append to `api/src/customers/routes.ts`:
```ts

/** member는 owner_agent_id=self도 추가 필터 */
function ownerFilter(agent: AuthenticatedAgent) {
  return agent.role === 'member' ? { ownerAgentId: agent.id } : {};
}

/** 우리 사무소(또는 본인 소속)의 고객을 id로 찾는다. 없거나 권한 없으면 404. */
async function findOwnCustomerOrThrow(id: string, agent: AuthenticatedAgent) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new NotFoundError('고객을 찾을 수 없습니다');
  }
  const customer = await prisma.customer.findFirst({
    where: {
      id: BigInt(numericId),
      agencyId: agent.agencyId,
      ...ownerFilter(agent),
    },
  });
  if (!customer) throw new NotFoundError('고객을 찾을 수 없습니다');
  return customer;
}

customersRouter.get('/', async (req, res) => {
  const filter = customerFilterSchema.parse(req.query);
  const agent = req.agent!;

  const where = {
    agencyId: agent.agencyId,
    ...ownerFilter(agent),
    ...(filter.customerType ? { customerType: filter.customerType } : {}),
    ...(filter.q
      ? {
          OR: [
            { name: { contains: filter.q } },
            { phone: { contains: filter.q } },
            { desiredArea: { contains: filter.q } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filter.page - 1) * filter.limit,
      take: filter.limit,
    }),
    prisma.customer.count({ where }),
  ]);

  res.json({
    data: rows.map(toCustomerResponse),
    total,
    page: filter.page,
    limit: filter.limit,
  });
});

customersRouter.get('/:id', async (req, res) => {
  const customer = await findOwnCustomerOrThrow(req.params.id, req.agent!);
  res.json(toCustomerResponse(customer));
});
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npm run test -w api`
Expected: PASS — 34건.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat(api): GET /api/customers list/detail with role-aware filter

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 고객 수정·삭제 (PATCH, DELETE) (TDD)

**Files:**
- Modify: `api/test/customers.test.ts`
- Modify: `api/src/customers/routes.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

Append to `api/test/customers.test.ts`:
```ts

describe('PATCH /api/customers/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('고객을 수정한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const created = await agent.post('/api/customers').send(sampleCustomer);
    const res = await agent
      .patch(`/api/customers/${created.body.id}`)
      .send({ memo: '연락 완료', budgetMax: 2000000000 });
    expect(res.status).toBe(200);
    expect(res.body.memo).toBe('연락 완료');
    expect(res.body.budgetMax).toBe(2000000000);
  });
});

describe('DELETE /api/customers/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('고객을 삭제하고 204', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const created = await agent.post('/api/customers').send(sampleCustomer);
    const del = await agent.delete(`/api/customers/${created.body.id}`);
    expect(del.status).toBe(204);
    const after = await agent.get(`/api/customers/${created.body.id}`);
    expect(after.status).toBe(404);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npm run test -w api`
Expected: PATCH/DELETE 테스트 FAIL.

- [ ] **Step 3: routes.ts에 PATCH/DELETE 추가**

Update imports to add `updateCustomerSchema`:
```ts
import { createCustomerSchema, updateCustomerSchema, customerFilterSchema } from '@rems/shared';
```

Append to `api/src/customers/routes.ts`:
```ts

customersRouter.patch('/:id', async (req, res) => {
  await findOwnCustomerOrThrow(req.params.id, req.agent!);
  const data = updateCustomerSchema.parse(req.body);
  const updated = await prisma.customer.update({
    where: { id: BigInt(Number(req.params.id)) },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.customerType !== undefined ? { customerType: data.customerType } : {}),
      ...(data.budgetMin !== undefined
        ? { budgetMin: data.budgetMin == null ? null : BigInt(data.budgetMin) }
        : {}),
      ...(data.budgetMax !== undefined
        ? { budgetMax: data.budgetMax == null ? null : BigInt(data.budgetMax) }
        : {}),
      ...(data.desiredArea !== undefined ? { desiredArea: data.desiredArea } : {}),
      ...(data.memo !== undefined ? { memo: data.memo } : {}),
    },
  });
  res.json(toCustomerResponse(updated));
});

customersRouter.delete('/:id', async (req, res) => {
  await findOwnCustomerOrThrow(req.params.id, req.agent!);
  await prisma.customer.delete({ where: { id: BigInt(Number(req.params.id)) } });
  res.status(204).send();
});
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npm run test -w api`
Expected: PASS — 36건.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat(api): PATCH and DELETE /api/customers/:id

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 매칭 라우트 — 목록 + 추가 (GET, POST) (TDD)

**Files:**
- Modify: `api/test/customers.test.ts`
- Modify: `api/src/customers/routes.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

Append to `api/test/customers.test.ts`:
```ts

const sampleListing = {
  title: '강남 아파트',
  dealType: 'sale',
  propertyType: 'apartment',
  salePrice: 1200000000,
  areaM2: 84,
  address: '서울 강남구',
};

describe('GET/POST /api/customers/:id/listings', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('매칭 추가하면 201 + 매물 요약 포함', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const customer = await agent.post('/api/customers').send(sampleCustomer);
    const listing = await agent.post('/api/listings').send(sampleListing);

    const res = await agent
      .post(`/api/customers/${customer.body.id}/listings`)
      .send({ listingId: listing.body.id, memo: '관심 표시' });
    expect(res.status).toBe(201);
    expect(res.body.listingId).toBe(listing.body.id);
    expect(res.body.status).toBe('suggested');
    expect(res.body.memo).toBe('관심 표시');
  });

  it('같은 매물을 중복 매칭하면 409', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const customer = await agent.post('/api/customers').send(sampleCustomer);
    const listing = await agent.post('/api/listings').send(sampleListing);
    await agent
      .post(`/api/customers/${customer.body.id}/listings`)
      .send({ listingId: listing.body.id });
    const dup = await agent
      .post(`/api/customers/${customer.body.id}/listings`)
      .send({ listingId: listing.body.id });
    expect(dup.status).toBe(409);
  });

  it('타 사무소 매물로 매칭하면 404', async () => {
    const app = createApp();
    const agentA = await signupAgent(app, { agencyName: 'A', email: 'a@example.com' });
    const customer = await agentA.post('/api/customers').send(sampleCustomer);
    const agentB = await signupAgent(app, { agencyName: 'B', email: 'b@example.com' });
    const bListing = await agentB.post('/api/listings').send(sampleListing);

    const res = await agentA
      .post(`/api/customers/${customer.body.id}/listings`)
      .send({ listingId: bListing.body.id });
    expect(res.status).toBe(404);
  });

  it('매칭 목록은 매물 요약을 포함한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const customer = await agent.post('/api/customers').send(sampleCustomer);
    const listing = await agent.post('/api/listings').send(sampleListing);
    await agent
      .post(`/api/customers/${customer.body.id}/listings`)
      .send({ listingId: listing.body.id });

    const res = await agent.get(`/api/customers/${customer.body.id}/listings`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].listing.title).toBe('강남 아파트');
    expect(res.body[0].listing.dealType).toBe('sale');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npm run test -w api`
Expected: 매칭 테스트 FAIL.

- [ ] **Step 3: routes.ts에 매칭 추가/목록 + helpers 추가**

Update imports:
```ts
import { createCustomerSchema, updateCustomerSchema, customerFilterSchema, createMatchSchema } from '@rems/shared';
import { ConflictError, NotFoundError } from '../errors';
```

Append to `api/src/customers/routes.ts`:
```ts

interface ListingSummaryRow {
  id: bigint;
  title: string;
  address: string;
  dealType: 'sale' | 'jeonse' | 'wolse';
  status: 'active' | 'completed' | 'hidden';
}

function toMatchResponse(
  row: Awaited<ReturnType<typeof prisma.customerListing.findFirstOrThrow>>,
  listing?: ListingSummaryRow,
) {
  return {
    id: row.id,
    customerId: row.customerId,
    listingId: row.listingId,
    status: row.status,
    memo: row.memo,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(listing
      ? {
          listing: {
            id: listing.id,
            title: listing.title,
            address: listing.address,
            dealType: listing.dealType,
            status: listing.status,
          },
        }
      : {}),
  };
}

customersRouter.get('/:id/listings', async (req, res) => {
  const customer = await findOwnCustomerOrThrow(req.params.id, req.agent!);
  const matches = await prisma.customerListing.findMany({
    where: { customerId: customer.id },
    include: {
      listing: {
        select: { id: true, title: true, address: true, dealType: true, status: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(matches.map((m) => toMatchResponse(m, m.listing)));
});

customersRouter.post('/:id/listings', async (req, res) => {
  const customer = await findOwnCustomerOrThrow(req.params.id, req.agent!);
  const { listingId, status, memo } = createMatchSchema.parse(req.body);

  // 같은 사무소 매물인지 확인
  const listing = await prisma.listing.findFirst({
    where: { id: BigInt(listingId), agencyId: req.agent!.agencyId },
    select: { id: true, title: true, address: true, dealType: true, status: true },
  });
  if (!listing) throw new NotFoundError('매물을 찾을 수 없습니다');

  try {
    const match = await prisma.customerListing.create({
      data: {
        customerId: customer.id,
        listingId: listing.id,
        status: status ?? 'suggested',
        memo,
      },
    });
    res.status(201).json(toMatchResponse(match, listing));
  } catch (err: unknown) {
    if (
      err != null &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    ) {
      throw new ConflictError('이미 매칭된 매물입니다');
    }
    throw err;
  }
});
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npm run test -w api`
Expected: PASS — 40건.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat(api): GET and POST /api/customers/:id/listings (matching)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 매칭 수정·삭제 (PATCH, DELETE) (TDD)

**Files:**
- Modify: `api/test/customers.test.ts`
- Modify: `api/src/customers/routes.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

Append to `api/test/customers.test.ts`:
```ts

describe('PATCH/DELETE /api/customers/:id/listings/:matchId', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('매칭 상태·메모를 수정한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const customer = await agent.post('/api/customers').send(sampleCustomer);
    const listing = await agent.post('/api/listings').send(sampleListing);
    const match = await agent
      .post(`/api/customers/${customer.body.id}/listings`)
      .send({ listingId: listing.body.id });

    const res = await agent
      .patch(`/api/customers/${customer.body.id}/listings/${match.body.id}`)
      .send({ status: 'visited', memo: '임장 완료' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('visited');
    expect(res.body.memo).toBe('임장 완료');
  });

  it('매칭을 삭제하고 204', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const customer = await agent.post('/api/customers').send(sampleCustomer);
    const listing = await agent.post('/api/listings').send(sampleListing);
    const match = await agent
      .post(`/api/customers/${customer.body.id}/listings`)
      .send({ listingId: listing.body.id });

    const del = await agent.delete(
      `/api/customers/${customer.body.id}/listings/${match.body.id}`,
    );
    expect(del.status).toBe(204);
    const list = await agent.get(`/api/customers/${customer.body.id}/listings`);
    expect(list.body).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npm run test -w api`
Expected: 매칭 PATCH/DELETE 테스트 FAIL.

- [ ] **Step 3: routes.ts에 매칭 PATCH/DELETE 추가**

Update imports to add `updateMatchSchema`:
```ts
import { createCustomerSchema, updateCustomerSchema, customerFilterSchema, createMatchSchema, updateMatchSchema } from '@rems/shared';
```

Append to `api/src/customers/routes.ts`:
```ts

async function findOwnMatchOrThrow(
  customerIdParam: string,
  matchIdParam: string,
  agent: AuthenticatedAgent,
) {
  const customer = await findOwnCustomerOrThrow(customerIdParam, agent);
  const matchId = Number(matchIdParam);
  if (!Number.isInteger(matchId) || matchId <= 0) {
    throw new NotFoundError('매칭을 찾을 수 없습니다');
  }
  const match = await prisma.customerListing.findFirst({
    where: { id: BigInt(matchId), customerId: customer.id },
  });
  if (!match) throw new NotFoundError('매칭을 찾을 수 없습니다');
  return match;
}

customersRouter.patch('/:id/listings/:matchId', async (req, res) => {
  const match = await findOwnMatchOrThrow(req.params.id, req.params.matchId, req.agent!);
  const data = updateMatchSchema.parse(req.body);
  const updated = await prisma.customerListing.update({
    where: { id: match.id },
    data: {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.memo !== undefined ? { memo: data.memo } : {}),
    },
  });
  res.json(toMatchResponse(updated));
});

customersRouter.delete('/:id/listings/:matchId', async (req, res) => {
  const match = await findOwnMatchOrThrow(req.params.id, req.params.matchId, req.agent!);
  await prisma.customerListing.delete({ where: { id: match.id } });
  res.status(204).send();
});
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npm run test -w api`
Expected: PASS — 42건.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat(api): PATCH and DELETE customer-listing match

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 테넌트 + 역할 격리 자동 테스트 (TDD — 회귀 방지)

**Files:**
- Modify: `api/test/tenant-isolation.test.ts`

- [ ] **Step 1: 테스트 추가**

Update the import at the top of `api/test/tenant-isolation.test.ts` to include `addMember`:
```ts
import { resetDb, signupAgent, addMember } from './helpers';
```

Append to `api/test/tenant-isolation.test.ts`:
```ts

const customerA = {
  name: 'A사무소 고객',
  customerType: 'buyer',
};

describe('테넌트 격리 — 고객', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('B의 고객 목록에는 A의 고객이 없다', async () => {
    const app = createApp();
    const agentA = await signupAgent(app, { agencyName: 'A부동산', email: 'a@example.com' });
    await agentA.post('/api/customers').send(customerA);

    const agentB = await signupAgent(app, { agencyName: 'B부동산', email: 'b@example.com' });
    const res = await agentB.get('/api/customers');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  it('B가 A의 고객 상세/수정/삭제 요청은 모두 404', async () => {
    const app = createApp();
    const agentA = await signupAgent(app, { agencyName: 'A부동산', email: 'a@example.com' });
    const created = await agentA.post('/api/customers').send(customerA);

    const agentB = await signupAgent(app, { agencyName: 'B부동산', email: 'b@example.com' });
    expect((await agentB.get(`/api/customers/${created.body.id}`)).status).toBe(404);
    expect((await agentB.patch(`/api/customers/${created.body.id}`).send({ name: 'x' })).status).toBe(404);
    expect((await agentB.delete(`/api/customers/${created.body.id}`)).status).toBe(404);
  });
});

describe('역할 격리 — 같은 사무소 내 member끼리는 서로의 고객을 못 본다', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('member1의 고객을 member2가 조회/수정/삭제하려 하면 404; owner는 둘 다 본다', async () => {
    const app = createApp();
    const owner = await signupAgent(app, { agencyName: 'A부동산', email: 'owner@example.com' });
    const me = await owner.get('/api/auth/me');
    // member1, member2 추가 (직접 DB)
    await addMember(BigInt(me.body.agent.agencyId), 'm1@example.com', '멤버1');
    await addMember(BigInt(me.body.agent.agencyId), 'm2@example.com', '멤버2');

    const m1 = request.agent(app);
    await m1.post('/api/auth/login').send({ email: 'm1@example.com', password: 'password123' });
    const m2 = request.agent(app);
    await m2.post('/api/auth/login').send({ email: 'm2@example.com', password: 'password123' });

    const c1 = await m1.post('/api/customers').send({ name: '멤버1의 고객', customerType: 'buyer' });

    expect((await m2.get(`/api/customers/${c1.body.id}`)).status).toBe(404);
    expect((await m2.patch(`/api/customers/${c1.body.id}`).send({ name: 'x' })).status).toBe(404);
    expect((await m2.delete(`/api/customers/${c1.body.id}`)).status).toBe(404);

    // member2의 목록엔 멤버1의 고객이 없다
    const list2 = await m2.get('/api/customers');
    expect(list2.body.total).toBe(0);

    // owner는 둘 다 본다
    const ownerList = await owner.get('/api/customers');
    expect(ownerList.body.total).toBe(1);
    expect((await owner.get(`/api/customers/${c1.body.id}`)).status).toBe(200);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 통과 확인 (구현은 이미 됨, 회귀 방지용)**

Run: `npm run test -w api`
Expected: PASS — 45건. 격리 테스트가 모두 통과해야 한다. **실패하면 라우트의 필터에 버그가 있는 것이므로 멈추고 조사하라.**

- [ ] **Step 3: 커밋**

```bash
git add api/test/tenant-isolation.test.ts
git commit -m "test(api): tenant + role isolation for customers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

# Phase B — 고객 프론트엔드

## Task 8: 고객 API 클라이언트

**Files:**
- Create: `web/src/api/customers.ts`

- [ ] **Step 1: 생성**

```ts
import type {
  Customer,
  CustomerListingMatch,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CreateMatchRequest,
  UpdateMatchRequest,
  Paginated,
} from '@rems/shared'
import { apiFetch } from './client'

export interface CustomerQuery {
  customerType?: string
  q?: string
  page?: number
}

export function listCustomers(query: CustomerQuery = {}): Promise<Paginated<Customer>> {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.set(k, String(v))
  })
  const qs = params.toString()
  return apiFetch<Paginated<Customer>>(`/customers${qs ? `?${qs}` : ''}`)
}

export function getCustomer(id: number): Promise<Customer> {
  return apiFetch<Customer>(`/customers/${id}`)
}

export function createCustomer(data: CreateCustomerRequest): Promise<Customer> {
  return apiFetch<Customer>('/customers', { method: 'POST', body: JSON.stringify(data) })
}

export function updateCustomer(id: number, data: UpdateCustomerRequest): Promise<Customer> {
  return apiFetch<Customer>(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export function deleteCustomer(id: number): Promise<void> {
  return apiFetch<void>(`/customers/${id}`, { method: 'DELETE' })
}

export function listMatches(customerId: number): Promise<CustomerListingMatch[]> {
  return apiFetch<CustomerListingMatch[]>(`/customers/${customerId}/listings`)
}

export function createMatch(customerId: number, data: CreateMatchRequest): Promise<CustomerListingMatch> {
  return apiFetch<CustomerListingMatch>(`/customers/${customerId}/listings`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateMatch(customerId: number, matchId: number, data: UpdateMatchRequest): Promise<CustomerListingMatch> {
  return apiFetch<CustomerListingMatch>(`/customers/${customerId}/listings/${matchId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteMatch(customerId: number, matchId: number): Promise<void> {
  return apiFetch<void>(`/customers/${customerId}/listings/${matchId}`, { method: 'DELETE' })
}
```

- [ ] **Step 2: 커밋**

```bash
git add web/src/api/customers.ts
git commit -m "feat(web): customers API client

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: 고객 목록 페이지 (HUD 표 + 필터)

템플릿의 `web/src/pages/tables/TableElements.tsx` 표 스타일을 참고. `hud-card`, `text-hud-*`, `border-hud-*` 클래스 사용.

**Files:**
- Create: `web/src/pages/customers/CustomerList.tsx`

- [ ] **Step 1: 생성**

```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Users, Plus, Search } from 'lucide-react'
import Button from '../../components/common/Button'
import { listCustomers, type CustomerQuery } from '../../api/customers'

const typeLabels: Record<string, string> = {
  buyer: '매수',
  seller: '매도',
  tenant: '임차',
  landlord: '임대',
}
const typeBadgeColors: Record<string, string> = {
  buyer: 'bg-hud-accent-info/20 text-hud-accent-info',
  seller: 'bg-hud-accent-primary/20 text-hud-accent-primary',
  tenant: 'bg-hud-accent-secondary/20 text-hud-accent-secondary',
  landlord: 'bg-hud-accent-warning/20 text-hud-accent-warning',
}

function fmt(n: number | null): string {
  if (n == null) return '-'
  return n.toLocaleString() + '원'
}

export default function CustomerList() {
  const [filter, setFilter] = useState<CustomerQuery>({})
  const { data, isLoading } = useQuery({
    queryKey: ['customers', filter],
    queryFn: () => listCustomers(filter),
  })
  const customers = data?.data ?? []

  return (
    <div className="p-6 text-hud-text-primary">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users size={24} className="text-hud-accent-primary" />
          <h1 className="text-2xl font-bold">고객</h1>
          <span className="text-hud-text-muted text-sm">{data?.total ?? 0}명</span>
        </div>
        <Link to="/customers/new">
          <Button variant="primary" glow leftIcon={<Plus size={16} />}>
            고객 등록
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className="px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
          value={filter.customerType ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, customerType: e.target.value || undefined }))}
        >
          <option value="">유형 전체</option>
          <option value="buyer">매수</option>
          <option value="seller">매도</option>
          <option value="tenant">임차</option>
          <option value="landlord">임대</option>
        </select>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-text-muted" size={16} />
          <input
            className="w-full pl-10 pr-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
            placeholder="이름·전화·희망지역"
            value={filter.q ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value || undefined }))}
          />
        </div>
      </div>

      <div className="hud-card rounded-lg overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-hud-text-muted">불러오는 중...</p>
        ) : customers.length === 0 ? (
          <p className="p-6 text-hud-text-muted">고객이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-hud-bg-secondary border-b border-hud-border-secondary">
              <tr className="text-left text-hud-text-secondary">
                <th className="px-4 py-3 font-medium">이름</th>
                <th className="px-4 py-3 font-medium">유형</th>
                <th className="px-4 py-3 font-medium">전화</th>
                <th className="px-4 py-3 font-medium">예산</th>
                <th className="px-4 py-3 font-medium">희망 지역</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hud-border-secondary">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-hud-bg-hover transition-hud">
                  <td className="px-4 py-3">
                    <Link to={`/customers/${c.id}`} className="text-hud-accent-primary hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${typeBadgeColors[c.customerType]}`}>
                      {typeLabels[c.customerType]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-hud-text-secondary">{c.phone ?? '-'}</td>
                  <td className="px-4 py-3 text-hud-text-secondary">
                    {fmt(c.budgetMin)} ~ {fmt(c.budgetMax)}
                  </td>
                  <td className="px-4 py-3 text-hud-text-secondary">{c.desiredArea ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 빌드 검증**

Run: `npm run build -w web`
Expected: 빌드 성공.

- [ ] **Step 3: 커밋**

```bash
git add web/src/pages/customers/CustomerList.tsx
git commit -m "feat(web): customer list page (HUD table + filters)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: 고객 상세 페이지 + 매칭 매트릭스

**Files:**
- Create: `web/src/pages/customers/CustomerDetail.tsx`

- [ ] **Step 1: 생성**

```tsx
import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Users, Plus, Trash2, Edit3 } from 'lucide-react'
import Button from '../../components/common/Button'
import {
  getCustomer,
  deleteCustomer,
  listMatches,
  createMatch,
  updateMatch,
  deleteMatch,
} from '../../api/customers'
import { listListings } from '../../api/listings'

const typeLabels: Record<string, string> = {
  buyer: '매수', seller: '매도', tenant: '임차', landlord: '임대',
}
const statusLabels: Record<string, string> = {
  suggested: '추천', interested: '관심', visited: '임장', contracted: '계약', rejected: '보류',
}
const statusColors: Record<string, string> = {
  suggested: 'bg-hud-bg-secondary text-hud-text-secondary',
  interested: 'bg-hud-accent-info/20 text-hud-accent-info',
  visited: 'bg-hud-accent-warning/20 text-hud-accent-warning',
  contracted: 'bg-hud-accent-success/20 text-hud-accent-success',
  rejected: 'bg-hud-text-muted/20 text-hud-text-muted',
}

function fmt(n: number | null): string {
  return n == null ? '-' : n.toLocaleString() + '원'
}

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const customerId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => getCustomer(customerId),
  })
  const { data: matches } = useQuery({
    queryKey: ['customer', customerId, 'matches'],
    queryFn: () => listMatches(customerId),
    enabled: !!customer,
  })
  const { data: listings } = useQuery({
    queryKey: ['listings', { all: true }],
    queryFn: () => listListings({ page: 1 }),
  })

  const [pickListing, setPickListing] = useState('')
  const [matchMemo, setMatchMemo] = useState('')

  const addMatch = useMutation({
    mutationFn: () =>
      createMatch(customerId, {
        listingId: Number(pickListing),
        memo: matchMemo || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer', customerId, 'matches'] })
      setPickListing('')
      setMatchMemo('')
    },
  })

  const changeStatus = useMutation({
    mutationFn: ({ matchId, status }: { matchId: number; status: string }) =>
      updateMatch(customerId, matchId, { status: status as 'suggested' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer', customerId, 'matches'] }),
  })

  const removeMatch = useMutation({
    mutationFn: (matchId: number) => deleteMatch(customerId, matchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer', customerId, 'matches'] }),
  })

  const delCustomer = useMutation({
    mutationFn: () => deleteCustomer(customerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      navigate('/customers', { replace: true })
    },
  })

  if (isLoading) return <p className="p-6 text-hud-text-muted">불러오는 중...</p>
  if (!customer) return <p className="p-6 text-hud-text-muted">고객을 찾을 수 없습니다.</p>

  const onAddMatch = (e: FormEvent) => {
    e.preventDefault()
    if (pickListing) addMatch.mutate()
  }

  return (
    <div className="p-6 text-hud-text-primary space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users size={24} className="text-hud-accent-primary" />
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          <span className="px-2 py-0.5 rounded text-xs bg-hud-accent-info/20 text-hud-accent-info">
            {typeLabels[customer.customerType]}
          </span>
        </div>
        <div className="flex gap-2">
          <Link to={`/customers/${customer.id}/edit`}>
            <Button variant="outline" leftIcon={<Edit3 size={16} />}>수정</Button>
          </Link>
          <Button
            variant="outline"
            leftIcon={<Trash2 size={16} />}
            onClick={() => { if (confirm('이 고객을 삭제할까요?')) delCustomer.mutate() }}
          >
            삭제
          </Button>
        </div>
      </div>

      <div className="hud-card rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-3">고객 정보</h2>
        <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-sm">
          <div><span className="text-hud-text-muted">전화: </span>{customer.phone ?? '-'}</div>
          <div><span className="text-hud-text-muted">희망 지역: </span>{customer.desiredArea ?? '-'}</div>
          <div><span className="text-hud-text-muted">예산: </span>{fmt(customer.budgetMin)} ~ {fmt(customer.budgetMax)}</div>
        </div>
        {customer.memo && (
          <div className="mt-3 pt-3 border-t border-hud-border-secondary text-sm whitespace-pre-wrap">
            <div className="text-hud-text-muted mb-1">메모</div>
            {customer.memo}
          </div>
        )}
      </div>

      <div className="hud-card rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-3">매칭 매물</h2>

        {/* Add new match */}
        <form onSubmit={onAddMatch} className="flex flex-wrap gap-2 mb-4">
          <select
            className="px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
            value={pickListing}
            onChange={(e) => setPickListing(e.target.value)}
          >
            <option value="">매물 선택</option>
            {(listings?.data ?? []).map((l) => (
              <option key={l.id} value={l.id}>{l.title} — {l.address}</option>
            ))}
          </select>
          <input
            className="flex-1 min-w-[200px] px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
            placeholder="메모 (선택)"
            value={matchMemo}
            onChange={(e) => setMatchMemo(e.target.value)}
          />
          <Button variant="primary" type="submit" disabled={!pickListing || addMatch.isPending} leftIcon={<Plus size={16} />}>
            매칭 추가
          </Button>
        </form>

        {/* Match table */}
        {(matches ?? []).length === 0 ? (
          <p className="text-hud-text-muted text-sm">매칭된 매물이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-hud-border-secondary">
              <tr className="text-left text-hud-text-secondary">
                <th className="py-2 font-medium">매물</th>
                <th className="py-2 font-medium">상태</th>
                <th className="py-2 font-medium">메모</th>
                <th className="py-2 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hud-border-secondary">
              {(matches ?? []).map((m) => (
                <tr key={m.id}>
                  <td className="py-2">
                    {m.listing ? (
                      <Link to={`/listings/${m.listing.id}`} className="text-hud-accent-primary hover:underline">
                        {m.listing.title}
                      </Link>
                    ) : `#${m.listingId}`}
                    {m.listing && <div className="text-xs text-hud-text-muted">{m.listing.address}</div>}
                  </td>
                  <td className="py-2">
                    <select
                      className={`px-2 py-1 rounded text-xs border-0 ${statusColors[m.status]} focus:outline-none`}
                      value={m.status}
                      onChange={(e) => changeStatus.mutate({ matchId: m.id, status: e.target.value })}
                    >
                      {Object.entries(statusLabels).map(([v, label]) => (
                        <option key={v} value={v}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 text-hud-text-secondary">{m.memo ?? '-'}</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => { if (confirm('매칭을 해제할까요?')) removeMatch.mutate(m.id) }}
                      className="text-hud-text-muted hover:text-hud-accent-warning transition-hud"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 빌드 검증**

Run: `npm run build -w web`
Expected: 빌드 성공.

- [ ] **Step 3: 커밋**

```bash
git add web/src/pages/customers/CustomerDetail.tsx
git commit -m "feat(web): customer detail with matching matrix

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: 고객 등록/수정 폼

템플릿의 `web/src/pages/forms/FormElements.tsx` HUD 폼 패턴 참고. 인증 폼과 동일한 input class 사용.

**Files:**
- Create: `web/src/pages/customers/CustomerForm.tsx`

- [ ] **Step 1: 생성**

```tsx
import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { User, Phone, MapPin, FileText } from 'lucide-react'
import Button from '../../components/common/Button'
import { getCustomer, createCustomer, updateCustomer } from '../../api/customers'
import type { CreateCustomerRequest } from '@rems/shared'

const inputCls =
  'w-full pl-12 pr-4 py-3 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'
const plainCls =
  'w-full px-4 py-3 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'

type FormState = {
  name: string
  phone: string
  customerType: 'buyer' | 'seller' | 'tenant' | 'landlord'
  budgetMin: string
  budgetMax: string
  desiredArea: string
  memo: string
}

const empty: FormState = {
  name: '', phone: '', customerType: 'buyer',
  budgetMin: '', budgetMax: '', desiredArea: '', memo: '',
}

function toNum(s: string): number | undefined {
  if (s.trim() === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

export default function CustomerForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = id != null
  const customerId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [form, setForm] = useState<FormState>(empty)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useQuery({
    queryKey: ['customer', customerId],
    queryFn: async () => {
      const c = await getCustomer(customerId)
      setForm({
        name: c.name,
        phone: c.phone ?? '',
        customerType: c.customerType,
        budgetMin: c.budgetMin?.toString() ?? '',
        budgetMax: c.budgetMax?.toString() ?? '',
        desiredArea: c.desiredArea ?? '',
        memo: c.memo ?? '',
      })
      setLoaded(true)
      return c
    },
    enabled: isEdit && !loaded,
  })

  const set = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }) as FormState)

  const save = useMutation({
    mutationFn: async () => {
      const payload: CreateCustomerRequest = {
        name: form.name,
        phone: form.phone || undefined,
        customerType: form.customerType,
        budgetMin: toNum(form.budgetMin),
        budgetMax: toNum(form.budgetMax),
        desiredArea: form.desiredArea || undefined,
        memo: form.memo || undefined,
      }
      return isEdit ? updateCustomer(customerId, payload) : createCustomer(payload)
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['customer', saved.id] })
      navigate(`/customers/${saved.id}`, { replace: true })
    },
    onError: (e) => setError(e instanceof Error ? e.message : '저장 실패'),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    save.mutate()
  }

  return (
    <div className="p-6 text-hud-text-primary max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{isEdit ? '고객 수정' : '고객 등록'}</h1>
      <form onSubmit={onSubmit} className="hud-card rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm text-hud-text-secondary mb-2">이름</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
            <input required className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-sm text-hud-text-secondary mb-2">전화</label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
            <input className={inputCls} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="010-0000-0000" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-hud-text-secondary mb-2">유형</label>
          <select className={plainCls} value={form.customerType} onChange={(e) => set('customerType', e.target.value)}>
            <option value="buyer">매수</option>
            <option value="seller">매도</option>
            <option value="tenant">임차</option>
            <option value="landlord">임대</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-hud-text-secondary mb-2">예산 최소 (원)</label>
            <input type="number" className={plainCls} value={form.budgetMin} onChange={(e) => set('budgetMin', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-hud-text-secondary mb-2">예산 최대 (원)</label>
            <input type="number" className={plainCls} value={form.budgetMax} onChange={(e) => set('budgetMax', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-sm text-hud-text-secondary mb-2">희망 지역</label>
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
            <input className={inputCls} value={form.desiredArea} onChange={(e) => set('desiredArea', e.target.value)} placeholder="예: 강남구, 서초구" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-hud-text-secondary mb-2">메모</label>
          <div className="relative">
            <FileText className="absolute left-4 top-4 text-hud-text-muted" size={18} />
            <textarea
              className="w-full pl-12 pr-4 py-3 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
              rows={4}
              value={form.memo}
              onChange={(e) => set('memo', e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button variant="primary" fullWidth glow type="submit" disabled={save.isPending}>
          {save.isPending ? '저장 중...' : '저장'}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: 빌드 검증**

Run: `npm run build -w web`
Expected: 빌드 성공.

- [ ] **Step 3: 커밋**

```bash
git add web/src/pages/customers/CustomerForm.tsx
git commit -m "feat(web): customer create/edit form (HUD style)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: 라우트 + 사이드바 메뉴

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: App.tsx에 고객 라우트 추가**

Read `web/src/App.tsx`. Add imports alongside the listing imports:
```tsx
import CustomerList from './pages/customers/CustomerList'
import CustomerDetail from './pages/customers/CustomerDetail'
import CustomerForm from './pages/customers/CustomerForm'
```

Add these four routes inside the `RequireAuth`/`MainLayout` block, matching the existing nested-route syntax (place near the listings routes):
```tsx
<Route path="customers" element={<CustomerList />} />
<Route path="customers/new" element={<CustomerForm />} />
<Route path="customers/:id" element={<CustomerDetail />} />
<Route path="customers/:id/edit" element={<CustomerForm />} />
```
`customers/new` BEFORE `customers/:id` so the literal wins.

- [ ] **Step 2: Sidebar.tsx에 "고객" 메뉴 추가**

Read `web/src/components/layout/Sidebar.tsx`. Add `Users` to the lucide-react import. Add a menu item right after the 매물 item, using the same pattern (no children, direct link):
```ts
{ title: '고객', icon: <Users size={20} />, path: '/customers' },
```

- [ ] **Step 3: 빌드 검증**

Run: `npm run build -w web`
Expected: 타입 에러 없이 빌드 성공.

- [ ] **Step 4: 커밋**

```bash
git add web/src/App.tsx web/src/components/layout/Sidebar.tsx
git commit -m "feat(web): customer routes and sidebar menu

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: 통합 동작 확인

**Files:** (수정 없음 — 수동 검증)

- [ ] **Step 1: 전체 테스트**

Run: `npm run test -w api`
Expected: 45건 모두 통과 (기존 27 + 신규 18: customer CRUD 6 + 매칭 6 + 격리 3 + 역할 격리 3).

- [ ] **Step 2: 빌드**

Run: `npm run build -w web`
Expected: 통과.

- [ ] **Step 3: dev 흐름 확인**

Run (다른 터미널): `npm run dev`. 브라우저:
1. 로그인 → 사이드바 "고객" → 고객 등록 → 목록에 표시
2. 고객 상세 → 매물 매칭 추가 → 상태 변경 → 매칭 해제
3. 고객 수정 → 삭제
4. (선택) owner가 member 계정 추가 후 member 로그인 → member는 본인 고객만, owner는 사무소 전체 (수동 확인)

---

## 다음 계획

Plan 5 (Agents & Dashboard): 중개사 관리 페이지 (owner가 멤버 가입·비활성화), 대시보드(매물·고객·매칭 요약 + 차트 — 템플릿 차트 패턴 참고), 설정 페이지 사무소 정보 편집.
