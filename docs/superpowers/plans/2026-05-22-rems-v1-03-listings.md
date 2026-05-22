# REMS v1 — Plan 3: Listings 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매물(listing) 관리 기능을 구축한다 — 사무소 공용 매물 CRUD + 사진 업로드 + 카카오맵 표시, 그리고 사무소 간 데이터 격리를 자동 테스트로 보장한다.

**Architecture:** 모든 매물 라우트는 `requireAuth` 뒤에서 `req.agent.agencyId`로 강제 필터링한다(매물은 사무소 공용). 타 사무소 리소스 접근은 404. 사진은 multer로 `api/uploads/`에 저장하고 정적 서빙한다. 프론트는 매물 목록·상세·등록/수정 페이지와 재사용 `KakaoMap` 컴포넌트로 구성한다.

**Tech Stack:** Express 5 + Prisma + zod + multer; React + TanStack Query + react-router-dom + 카카오맵 JS SDK.

---

## 사전 준비 (실행 전 확인)

- `main` = `6a1a322` (Plan 2 완료). 작업은 새 브랜치 `feat/v1-listings`에서.
- MariaDB Docker 컨테이너 실행 중 (`docker compose up -d`), 7개 테이블 마이그레이션 완료.
- **카카오맵 JS 키 필요**: [developers.kakao.com](https://developers.kakao.com)에서 앱 생성 → JavaScript 키 발급 → 플랫폼에 `http://localhost:5173` 등록. 이 키를 `web/.env`에 `VITE_KAKAO_MAP_KEY=발급키`로 저장한다 (`.env`는 gitignore됨). 키가 없어도 매물 CRUD·목록은 동작하며 지도만 빈 영역으로 표시된다.

## 완료 기준

- `npm run test -w api` 통과 — 기존 11건 + 매물 CRUD·사진·**테넌트 격리** 신규 테스트.
- `npm run dev` → 로그인 후 매물 등록·목록·상세·수정·삭제, 지도에 마커 표시.
- 사무소 A 세션으로 사무소 B의 매물에 접근하면 404.
- 템플릿 데모 페이지 라우트 제거됨, 미인증 시 모든 경로가 `/login`으로.

## 새 브랜치 생성

```bash
cd "/Volumes/MacExtend 1/REMS"
git checkout main
git checkout -b feat/v1-listings
```

## 파일 구조

```
packages/shared/src/
  listings.ts                 — NEW: 매물 zod 스키마 + 타입
  index.ts                    — modified: re-export
api/src/
  listings/
    routes.ts                 — NEW: 매물 CRUD + 사진 라우트
    upload.ts                 — NEW: multer 설정
  app.ts                      — modified: listings 라우터 + uploads 정적 서빙
api/test/
  helpers.ts                  — modified: signupAgent 헬퍼 추가
  listings.test.ts            — NEW: CRUD 테스트
  tenant-isolation.test.ts    — NEW: 사무소 간 격리 테스트
api/package.json              — modified: multer
api/uploads/.gitkeep          — NEW: 업로드 디렉터리 유지
web/src/
  kakao.d.ts                  — NEW: window.kakao 타입
  components/KakaoMap.tsx     — NEW: 카카오맵 래퍼
  api/listings.ts             — NEW: 매물 API 클라이언트
  pages/listings/
    ListingList.tsx           — NEW: 목록 + 필터 + 지도 토글
    ListingDetail.tsx         — NEW: 상세 + 사진 + 지도
    ListingForm.tsx           — NEW: 등록/수정 폼
  App.tsx                     — modified: 매물 라우트 + 데모 라우트 제거
  components/layout/Sidebar.tsx — modified: 매물 메뉴
web/.env.example              — NEW: VITE_KAKAO_MAP_KEY 예시
```

---

# Phase A — 매물 백엔드

## Task 1: 공유 매물 zod 스키마

**Files:**
- Create: `packages/shared/src/listings.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: packages/shared/src/listings.ts 생성**

Create `packages/shared/src/listings.ts`:
```ts
import { z } from 'zod';

export const dealTypes = ['sale', 'jeonse', 'wolse'] as const;
export const propertyTypes = ['apartment', 'officetel', 'house', 'commercial', 'land'] as const;
export const listingStatuses = ['active', 'completed', 'hidden'] as const;

/** 매물 공통 필드 (refine 없는 평 객체 — create/update가 재사용) */
const listingFields = z.object({
  title: z.string().min(1).max(255),
  dealType: z.enum(dealTypes),
  propertyType: z.enum(propertyTypes),
  salePrice: z.number().int().nonnegative().optional(),
  deposit: z.number().int().nonnegative().optional(),
  monthlyRent: z.number().int().nonnegative().optional(),
  areaM2: z.number().positive(),
  address: z.string().min(1).max(255),
  addressDetail: z.string().max(255).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  floor: z.number().int().optional(),
  totalFloors: z.number().int().optional(),
  rooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  builtYear: z.number().int().min(1900).max(2100).optional(),
  description: z.string().max(5000).optional(),
});

/** 거래유형에 맞는 금액이 있는지 검증 */
function checkDealPrices(
  v: { dealType: string; salePrice?: number; deposit?: number; monthlyRent?: number },
  ctx: z.RefinementCtx,
): void {
  if (v.dealType === 'sale' && v.salePrice == null) {
    ctx.addIssue({ code: 'custom', message: '매매는 매매가가 필요합니다', path: ['salePrice'] });
  }
  if (v.dealType === 'jeonse' && v.deposit == null) {
    ctx.addIssue({ code: 'custom', message: '전세는 보증금이 필요합니다', path: ['deposit'] });
  }
  if (v.dealType === 'wolse' && (v.deposit == null || v.monthlyRent == null)) {
    ctx.addIssue({ code: 'custom', message: '월세는 보증금과 월세액이 필요합니다', path: ['monthlyRent'] });
  }
}

/** 매물 등록 요청 */
export const createListingSchema = listingFields.superRefine(checkDealPrices);
export type CreateListingRequest = z.infer<typeof createListingSchema>;

/** 매물 수정 요청 (모든 필드 선택 + status) */
export const updateListingSchema = listingFields.partial().extend({
  status: z.enum(listingStatuses).optional(),
});
export type UpdateListingRequest = z.infer<typeof updateListingSchema>;

/** 매물 목록 필터 쿼리 */
export const listingFilterSchema = z.object({
  dealType: z.enum(dealTypes).optional(),
  propertyType: z.enum(propertyTypes).optional(),
  status: z.enum(listingStatuses).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListingFilter = z.infer<typeof listingFilterSchema>;

/** 매물 사진 */
export interface ListingPhoto {
  id: number;
  url: string;
  sortOrder: number;
}

/** 매물 응답 */
export interface Listing {
  id: number;
  agencyId: number;
  createdBy: number;
  title: string;
  dealType: (typeof dealTypes)[number];
  propertyType: (typeof propertyTypes)[number];
  salePrice: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  areaM2: number;
  address: string;
  addressDetail: string | null;
  latitude: number | null;
  longitude: number | null;
  floor: number | null;
  totalFloors: number | null;
  rooms: number | null;
  bathrooms: number | null;
  builtYear: number | null;
  status: (typeof listingStatuses)[number];
  description: string | null;
  createdAt: string;
  updatedAt: string;
  photos: ListingPhoto[];
}
```

- [ ] **Step 2: packages/shared/src/index.ts에 re-export 추가**

In `packages/shared/src/index.ts`, the last line is `export * from './auth';`. Add a line right after it:
```ts
export * from './listings';
```

- [ ] **Step 3: 커밋**

```bash
git add packages/shared/
git commit -m "feat(shared): add listing zod schemas and types

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 매물 등록 라우트 (POST) + 라우터 마운트 (TDD)

**Files:**
- Modify: `api/test/helpers.ts` (signupAgent 헬퍼)
- Create: `api/test/listings.test.ts`
- Create: `api/src/listings/routes.ts`
- Modify: `api/src/app.ts`

- [ ] **Step 1: api/test/helpers.ts에 signupAgent 헬퍼 추가**

The current `api/test/helpers.ts` contains only `resetDb`. Replace its ENTIRE contents with:
```ts
import request from 'supertest';
import type { Express } from 'express';
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
```

- [ ] **Step 2: 실패하는 테스트 작성**

Create `api/test/listings.test.ts`:
```ts
import '../src/bigint-json';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app';
import { resetDb, signupAgent } from './helpers';

const sampleListing = {
  title: '강남 아파트',
  dealType: 'sale',
  propertyType: 'apartment',
  salePrice: 1500000000,
  areaM2: 84.5,
  address: '서울 강남구 역삼동 123',
};

describe('POST /api/listings', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('인증 없으면 401', async () => {
    const app = createApp();
    const res = await request(app).post('/api/listings').send(sampleListing);
    expect(res.status).toBe(401);
  });

  it('매물을 등록하고 201 + 생성된 매물을 반환한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const res = await agent.post('/api/listings').send(sampleListing);
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('강남 아파트');
    expect(res.body.salePrice).toBe(1500000000);
    expect(res.body.status).toBe('active');
    expect(res.body.photos).toEqual([]);
    expect(typeof res.body.agencyId).toBe('number');
  });

  it('매매인데 매매가가 없으면 400', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const res = await agent
      .post('/api/listings')
      .send({ ...sampleListing, salePrice: undefined });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
  });
});
```

- [ ] **Step 3: 테스트 실행 — 실패 확인**

Run: `npm run test -w api`
Expected: listings 테스트 FAIL (404 — 라우트 없음). 기존 11건은 통과.

- [ ] **Step 4: api/src/listings/routes.ts 생성**

Create `api/src/listings/routes.ts`:
```ts
import { Router } from 'express';
import { createListingSchema } from '@rems/shared';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';

export const listingsRouter = Router();

listingsRouter.use(requireAuth);

/** Prisma Listing 행을 API 응답 형태로 변환한다 */
function toListingResponse(
  row: Awaited<ReturnType<typeof prisma.listing.findFirstOrThrow>> & {
    photos?: { id: bigint; url: string; sortOrder: number }[];
  },
) {
  return {
    ...row,
    areaM2: Number(row.areaM2),
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    photos: (row.photos ?? []).map((p) => ({
      id: p.id,
      url: p.url,
      sortOrder: p.sortOrder,
    })),
  };
}

listingsRouter.post('/', async (req, res) => {
  const data = createListingSchema.parse(req.body);
  const agent = req.agent!;
  const created = await prisma.listing.create({
    data: {
      agencyId: agent.agencyId,
      createdBy: agent.id,
      title: data.title,
      dealType: data.dealType,
      propertyType: data.propertyType,
      salePrice: data.salePrice == null ? null : BigInt(data.salePrice),
      deposit: data.deposit == null ? null : BigInt(data.deposit),
      monthlyRent: data.monthlyRent == null ? null : BigInt(data.monthlyRent),
      areaM2: data.areaM2,
      address: data.address,
      addressDetail: data.addressDetail,
      latitude: data.latitude,
      longitude: data.longitude,
      floor: data.floor,
      totalFloors: data.totalFloors,
      rooms: data.rooms,
      bathrooms: data.bathrooms,
      builtYear: data.builtYear,
      description: data.description,
    },
    include: { photos: true },
  });
  res.status(201).json(toListingResponse(created));
});
```

- [ ] **Step 5: api/src/app.ts에 listings 라우터 마운트**

In `api/src/app.ts`, add the import alongside the existing `authRouter` import:
```ts
import { listingsRouter } from './listings/routes';
```
And mount it right after the `app.use('/api/auth', authRouter);` line:
```ts
  app.use('/api/listings', listingsRouter);
```

- [ ] **Step 6: 테스트 실행 — 통과 확인**

Run: `npm run test -w api`
Expected: PASS — 기존 11건 + listings 3건 = 14건.

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "feat(api): POST /api/listings creates agency-scoped listing

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 매물 목록·상세 라우트 (GET) (TDD)

**Files:**
- Modify: `api/test/listings.test.ts`
- Modify: `api/src/listings/routes.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

Append to `api/test/listings.test.ts`:
```ts

describe('GET /api/listings', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('우리 사무소 매물 목록을 페이지네이션 형태로 반환한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    await agent.post('/api/listings').send(sampleListing);
    await agent.post('/api/listings').send({ ...sampleListing, title: '두 번째 매물' });

    const res = await agent.get('/api/listings');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.page).toBe(1);
  });

  it('dealType 필터가 동작한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    await agent.post('/api/listings').send(sampleListing); // sale
    await agent
      .post('/api/listings')
      .send({ title: '전세집', dealType: 'jeonse', propertyType: 'house', deposit: 300000000, areaM2: 60, address: '서울 마포구' });

    const res = await agent.get('/api/listings?dealType=jeonse');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].title).toBe('전세집');
  });
});

describe('GET /api/listings/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('매물 상세를 반환한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const created = await agent.post('/api/listings').send(sampleListing);
    const res = await agent.get(`/api/listings/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.title).toBe('강남 아파트');
  });

  it('없는 매물이면 404', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const res = await agent.get('/api/listings/999999');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npm run test -w api`
Expected: GET 테스트 FAIL (404 — 라우트 없음).

- [ ] **Step 3: routes.ts에 목록·상세 + 공용 헬퍼 추가**

Update the import block at the top of `api/src/listings/routes.ts` to:
```ts
import { Router } from 'express';
import { createListingSchema, listingFilterSchema } from '@rems/shared';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';
import { NotFoundError } from '../errors';
```

Then APPEND to `api/src/listings/routes.ts`:
```ts

/** 우리 사무소의 매물을 id로 찾는다. 없거나 타 사무소면 404. */
async function findOwnListingOrThrow(id: string, agencyId: bigint) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new NotFoundError('매물을 찾을 수 없습니다');
  }
  const listing = await prisma.listing.findFirst({
    where: { id: BigInt(numericId), agencyId },
    include: { photos: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!listing) throw new NotFoundError('매물을 찾을 수 없습니다');
  return listing;
}

listingsRouter.get('/', async (req, res) => {
  const filter = listingFilterSchema.parse(req.query);
  const agencyId = req.agent!.agencyId;

  const where = {
    agencyId,
    ...(filter.dealType ? { dealType: filter.dealType } : {}),
    ...(filter.propertyType ? { propertyType: filter.propertyType } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.q
      ? { OR: [{ title: { contains: filter.q } }, { address: { contains: filter.q } }] }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      include: { photos: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      skip: (filter.page - 1) * filter.limit,
      take: filter.limit,
    }),
    prisma.listing.count({ where }),
  ]);

  res.json({
    data: rows.map(toListingResponse),
    total,
    page: filter.page,
    limit: filter.limit,
  });
});

listingsRouter.get('/:id', async (req, res) => {
  const listing = await findOwnListingOrThrow(req.params.id, req.agent!.agencyId);
  res.json(toListingResponse(listing));
});
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npm run test -w api`
Expected: PASS — 18건 (11 + listings 7).

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat(api): GET /api/listings list (filtered) and detail

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 매물 수정·삭제 라우트 (PATCH, DELETE) (TDD)

**Files:**
- Modify: `api/test/listings.test.ts`
- Modify: `api/src/listings/routes.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

Append to `api/test/listings.test.ts`:
```ts

describe('PATCH /api/listings/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('매물을 수정한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const created = await agent.post('/api/listings').send(sampleListing);
    const res = await agent
      .patch(`/api/listings/${created.body.id}`)
      .send({ title: '수정된 제목', status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('수정된 제목');
    expect(res.body.status).toBe('completed');
  });

  it('없는 매물 수정은 404', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const res = await agent.patch('/api/listings/999999').send({ title: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/listings/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('매물을 삭제하고 204를 반환한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const created = await agent.post('/api/listings').send(sampleListing);
    const del = await agent.delete(`/api/listings/${created.body.id}`);
    expect(del.status).toBe(204);
    const after = await agent.get(`/api/listings/${created.body.id}`);
    expect(after.status).toBe(404);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npm run test -w api`
Expected: PATCH/DELETE 테스트 FAIL.

- [ ] **Step 3: routes.ts에 수정·삭제 추가**

Update the import block at the top of `api/src/listings/routes.ts` to add `updateListingSchema`:
```ts
import { createListingSchema, updateListingSchema, listingFilterSchema } from '@rems/shared';
```

Then APPEND to `api/src/listings/routes.ts`:
```ts

listingsRouter.patch('/:id', async (req, res) => {
  await findOwnListingOrThrow(req.params.id, req.agent!.agencyId);
  const data = updateListingSchema.parse(req.body);
  const updated = await prisma.listing.update({
    where: { id: BigInt(Number(req.params.id)) },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.dealType !== undefined ? { dealType: data.dealType } : {}),
      ...(data.propertyType !== undefined ? { propertyType: data.propertyType } : {}),
      ...(data.salePrice !== undefined
        ? { salePrice: data.salePrice == null ? null : BigInt(data.salePrice) }
        : {}),
      ...(data.deposit !== undefined
        ? { deposit: data.deposit == null ? null : BigInt(data.deposit) }
        : {}),
      ...(data.monthlyRent !== undefined
        ? { monthlyRent: data.monthlyRent == null ? null : BigInt(data.monthlyRent) }
        : {}),
      ...(data.areaM2 !== undefined ? { areaM2: data.areaM2 } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.addressDetail !== undefined ? { addressDetail: data.addressDetail } : {}),
      ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
      ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
      ...(data.floor !== undefined ? { floor: data.floor } : {}),
      ...(data.totalFloors !== undefined ? { totalFloors: data.totalFloors } : {}),
      ...(data.rooms !== undefined ? { rooms: data.rooms } : {}),
      ...(data.bathrooms !== undefined ? { bathrooms: data.bathrooms } : {}),
      ...(data.builtYear !== undefined ? { builtYear: data.builtYear } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
    },
    include: { photos: { orderBy: { sortOrder: 'asc' } } },
  });
  res.json(toListingResponse(updated));
});

listingsRouter.delete('/:id', async (req, res) => {
  await findOwnListingOrThrow(req.params.id, req.agent!.agencyId);
  await prisma.listing.delete({ where: { id: BigInt(Number(req.params.id)) } });
  res.status(204).send();
});
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npm run test -w api`
Expected: PASS — 21건.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat(api): PATCH and DELETE /api/listings/:id

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 테넌트 격리 자동 테스트 (TDD — 회귀 방지)

설계 스펙의 최우선 요구. 사무소 A의 세션으로 사무소 B의 매물에 접근할 수 없음을 모든 경로에서 검증한다. 이 시점에 라우트는 이미 `agencyId` 필터를 갖고 있으므로 테스트는 바로 통과해야 한다 — 통과하지 않으면 격리 버그가 있는 것이다.

**Files:**
- Create: `api/test/tenant-isolation.test.ts`

- [ ] **Step 1: 격리 테스트 작성**

Create `api/test/tenant-isolation.test.ts`:
```ts
import '../src/bigint-json';
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app';
import { resetDb, signupAgent } from './helpers';

const listingA = {
  title: 'A사무소 매물',
  dealType: 'sale',
  propertyType: 'apartment',
  salePrice: 900000000,
  areaM2: 70,
  address: '서울 서초구',
};

describe('테넌트 격리 — 사무소 A의 매물은 사무소 B에게 보이지 않는다', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('B의 목록에는 A의 매물이 없다', async () => {
    const app = createApp();
    const agentA = await signupAgent(app, { agencyName: 'A부동산', email: 'a@example.com' });
    await agentA.post('/api/listings').send(listingA);

    const agentB = await signupAgent(app, { agencyName: 'B부동산', email: 'b@example.com' });
    const res = await agentB.get('/api/listings');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  it('B가 A의 매물 상세를 요청하면 404', async () => {
    const app = createApp();
    const agentA = await signupAgent(app, { agencyName: 'A부동산', email: 'a@example.com' });
    const created = await agentA.post('/api/listings').send(listingA);

    const agentB = await signupAgent(app, { agencyName: 'B부동산', email: 'b@example.com' });
    const res = await agentB.get(`/api/listings/${created.body.id}`);
    expect(res.status).toBe(404);
  });

  it('B가 A의 매물을 수정/삭제하려 하면 404', async () => {
    const app = createApp();
    const agentA = await signupAgent(app, { agencyName: 'A부동산', email: 'a@example.com' });
    const created = await agentA.post('/api/listings').send(listingA);

    const agentB = await signupAgent(app, { agencyName: 'B부동산', email: 'b@example.com' });
    const patch = await agentB.patch(`/api/listings/${created.body.id}`).send({ title: '탈취' });
    expect(patch.status).toBe(404);
    const del = await agentB.delete(`/api/listings/${created.body.id}`);
    expect(del.status).toBe(404);

    // A의 매물은 그대로다
    const stillThere = await agentA.get(`/api/listings/${created.body.id}`);
    expect(stillThere.status).toBe(200);
    expect(stillThere.body.title).toBe('A사무소 매물');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 통과 확인**

Run: `npm run test -w api`
Expected: PASS — 24건. 격리 테스트 3건이 모두 통과해야 한다. **실패하면 라우트의 `agencyId` 필터에 버그가 있는 것이므로 멈추고 조사하라.**

- [ ] **Step 3: 커밋**

```bash
git add api/test/tenant-isolation.test.ts
git commit -m "test(api): tenant isolation — agency cannot access another's listings

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 사진 업로드 인프라 + POST 사진 라우트 (TDD)

**Files:**
- Modify: `api/package.json` (multer)
- Create: `api/src/listings/upload.ts`
- Create: `api/uploads/.gitkeep`
- Modify: `api/src/app.ts` (정적 서빙)
- Modify: `api/src/listings/routes.ts` (POST /:id/photos)
- Modify: `api/test/listings.test.ts`

- [ ] **Step 1: multer 설치**

Run:
```bash
cd "/Volumes/MacExtend 1/REMS"
npm install multer -w api
npm install -D @types/multer -w api
```

- [ ] **Step 2: 업로드 디렉터리 유지 파일 생성**

Create `api/uploads/.gitkeep` (빈 파일):
```
```
(루트 `.gitignore`에 `api/uploads/`가 있어 업로드물은 커밋되지 않지만, `.gitkeep`은 `git add -f`로 추가해 디렉터리 자체는 유지한다 — Step 7에서 처리.)

- [ ] **Step 3: api/src/listings/upload.ts 생성**

Create `api/src/listings/upload.ts`:
```ts
import multer from 'multer';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import { ValidationError } from '../errors';

const UPLOAD_DIR = 'uploads';
const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `${randomBytes(16).toString('hex')}${ext}`);
  },
});

/** 매물 사진 업로드 미들웨어 — 이미지 1장, 5MB 제한 */
export const photoUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED.has(ext)) {
      cb(new ValidationError('jpg, png, webp 이미지만 업로드할 수 있습니다'));
      return;
    }
    cb(null, true);
  },
}).single('photo');
```

- [ ] **Step 4: api/src/app.ts에 uploads 정적 서빙 추가**

In `api/src/app.ts`, add this line right after `app.use(express.json());`:
```ts
  app.use('/uploads', express.static('uploads'));
```

- [ ] **Step 5: 실패하는 테스트 추가**

Append to `api/test/listings.test.ts`:
```ts

describe('POST /api/listings/:id/photos', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('매물에 사진을 추가한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const created = await agent.post('/api/listings').send(sampleListing);
    // 1x1 PNG 바이트
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const res = await agent
      .post(`/api/listings/${created.body.id}/photos`)
      .attach('photo', png, 'test.png');
    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^\/uploads\/[a-f0-9]{32}\.png$/);

    const detail = await agent.get(`/api/listings/${created.body.id}`);
    expect(detail.body.photos).toHaveLength(1);
  });

  it('타 사무소 매물에는 사진을 못 올린다 (404)', async () => {
    const app = createApp();
    const agentA = await signupAgent(app, { agencyName: 'A', email: 'a@example.com' });
    const created = await agentA.post('/api/listings').send(sampleListing);
    const agentB = await signupAgent(app, { agencyName: 'B', email: 'b@example.com' });
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const res = await agentB
      .post(`/api/listings/${created.body.id}/photos`)
      .attach('photo', png, 'test.png');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 6: 테스트 실행 — 실패 확인**

Run: `npm run test -w api`
Expected: 사진 테스트 FAIL (404 — 라우트 없음).

- [ ] **Step 7: routes.ts에 POST 사진 라우트 추가**

Update the import block at the top of `api/src/listings/routes.ts` to add the upload middleware:
```ts
import { Router } from 'express';
import { createListingSchema, updateListingSchema, listingFilterSchema } from '@rems/shared';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';
import { NotFoundError } from '../errors';
import { photoUpload } from './upload';
```

Then APPEND to `api/src/listings/routes.ts`:
```ts

listingsRouter.post('/:id/photos', async (req, res, next) => {
  // 매물 소유 확인을 업로드보다 먼저
  await findOwnListingOrThrow(req.params.id, req.agent!.agencyId);
  photoUpload(req, res, (err: unknown) => {
    if (err) return next(err);
    void (async () => {
      try {
        if (!req.file) throw new NotFoundError('업로드된 파일이 없습니다');
        const count = await prisma.listingPhoto.count({
          where: { listingId: BigInt(Number(req.params.id)) },
        });
        const photo = await prisma.listingPhoto.create({
          data: {
            listingId: BigInt(Number(req.params.id)),
            url: `/uploads/${req.file.filename}`,
            sortOrder: count,
          },
        });
        res.status(201).json({ id: photo.id, url: photo.url, sortOrder: photo.sortOrder });
      } catch (e) {
        next(e);
      }
    })();
  });
});
```

- [ ] **Step 8: 테스트 실행 — 통과 확인**

Run: `npm run test -w api`
Expected: PASS — 26건.

- [ ] **Step 9: 커밋**

```bash
git add -A
git add -f api/uploads/.gitkeep
git commit -m "feat(api): POST /api/listings/:id/photos with multer upload

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 사진 삭제 라우트 (DELETE) (TDD)

**Files:**
- Modify: `api/test/listings.test.ts`
- Modify: `api/src/listings/routes.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

Append to `api/test/listings.test.ts`:
```ts

describe('DELETE /api/listings/:id/photos/:photoId', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('사진을 삭제한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const created = await agent.post('/api/listings').send(sampleListing);
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const photo = await agent
      .post(`/api/listings/${created.body.id}/photos`)
      .attach('photo', png, 'test.png');

    const del = await agent.delete(
      `/api/listings/${created.body.id}/photos/${photo.body.id}`,
    );
    expect(del.status).toBe(204);

    const detail = await agent.get(`/api/listings/${created.body.id}`);
    expect(detail.body.photos).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npm run test -w api`
Expected: 사진 삭제 테스트 FAIL.

- [ ] **Step 3: routes.ts에 DELETE 사진 라우트 추가**

APPEND to `api/src/listings/routes.ts`:
```ts

listingsRouter.delete('/:id/photos/:photoId', async (req, res) => {
  await findOwnListingOrThrow(req.params.id, req.agent!.agencyId);
  const photoId = Number(req.params.photoId);
  if (!Number.isInteger(photoId) || photoId <= 0) {
    throw new NotFoundError('사진을 찾을 수 없습니다');
  }
  const photo = await prisma.listingPhoto.findFirst({
    where: { id: BigInt(photoId), listingId: BigInt(Number(req.params.id)) },
  });
  if (!photo) throw new NotFoundError('사진을 찾을 수 없습니다');
  await prisma.listingPhoto.delete({ where: { id: photo.id } });
  res.status(204).send();
});
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npm run test -w api`
Expected: PASS — 27건.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat(api): DELETE /api/listings/:id/photos/:photoId

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

# Phase B — 매물 프론트엔드

## Task 8: 매물 API 클라이언트

**Files:**
- Create: `web/src/api/listings.ts`

- [ ] **Step 1: web/src/api/listings.ts 생성**

Create `web/src/api/listings.ts`:
```ts
import type {
  Listing,
  ListingPhoto,
  CreateListingRequest,
  UpdateListingRequest,
  Paginated,
} from '@rems/shared'
import { apiFetch } from './client'

export interface ListingQuery {
  dealType?: string
  propertyType?: string
  status?: string
  q?: string
  page?: number
}

export function listListings(query: ListingQuery = {}): Promise<Paginated<Listing>> {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.set(k, String(v))
  })
  const qs = params.toString()
  return apiFetch<Paginated<Listing>>(`/listings${qs ? `?${qs}` : ''}`)
}

export function getListing(id: number): Promise<Listing> {
  return apiFetch<Listing>(`/listings/${id}`)
}

export function createListing(data: CreateListingRequest): Promise<Listing> {
  return apiFetch<Listing>('/listings', { method: 'POST', body: JSON.stringify(data) })
}

export function updateListing(id: number, data: UpdateListingRequest): Promise<Listing> {
  return apiFetch<Listing>(`/listings/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export function deleteListing(id: number): Promise<void> {
  return apiFetch<void>(`/listings/${id}`, { method: 'DELETE' })
}

/** 사진 업로드 — multipart라 apiFetch 대신 fetch 직접 사용 */
export async function uploadListingPhoto(id: number, file: File): Promise<ListingPhoto> {
  const form = new FormData()
  form.append('photo', file)
  const res = await fetch(`/api/listings/${id}/photos`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  if (!res.ok) throw new Error('사진 업로드 실패')
  return res.json() as Promise<ListingPhoto>
}

export function deleteListingPhoto(listingId: number, photoId: number): Promise<void> {
  return apiFetch<void>(`/listings/${listingId}/photos/${photoId}`, { method: 'DELETE' })
}
```

- [ ] **Step 2: 커밋**

```bash
git add web/src/api/listings.ts
git commit -m "feat(web): listings API client

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: KakaoMap 컴포넌트

**Files:**
- Create: `web/src/kakao.d.ts`
- Create: `web/src/components/KakaoMap.tsx`
- Create: `web/.env.example`

- [ ] **Step 1: web/src/kakao.d.ts 생성**

Create `web/src/kakao.d.ts`:
```ts
/** 카카오맵 SDK는 전역 window.kakao로 노출된다. v1에서는 느슨한 타입으로 둔다. */
declare global {
  interface Window {
    kakao: any
  }
}
export {}
```

- [ ] **Step 2: web/.env.example 생성**

Create `web/.env.example`:
```
VITE_KAKAO_MAP_KEY=여기에_카카오_JavaScript_키
```

- [ ] **Step 3: web/src/components/KakaoMap.tsx 생성**

Create `web/src/components/KakaoMap.tsx`:
```tsx
import { useEffect, useRef } from 'react'

const KEY = import.meta.env.VITE_KAKAO_MAP_KEY as string | undefined

let sdkPromise: Promise<void> | null = null

/** 카카오맵 SDK를 한 번만 로드한다 */
function loadKakaoSdk(): Promise<void> {
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise<void>((resolve, reject) => {
    if (!KEY) {
      reject(new Error('VITE_KAKAO_MAP_KEY 미설정'))
      return
    }
    if (window.kakao?.maps) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KEY}&autoload=false`
    script.async = true
    script.onload = () => window.kakao.maps.load(() => resolve())
    script.onerror = () => reject(new Error('카카오맵 SDK 로드 실패'))
    document.head.appendChild(script)
  })
  return sdkPromise
}

export interface MapMarker {
  id: number
  lat: number
  lng: number
  title: string
}

interface KakaoMapProps {
  markers: MapMarker[]
  center?: { lat: number; lng: number }
  level?: number
  onMarkerClick?: (id: number) => void
  className?: string
}

const SEOUL = { lat: 37.5665, lng: 126.978 }

export function KakaoMap({
  markers,
  center,
  level = 5,
  onMarkerClick,
  className,
}: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    loadKakaoSdk()
      .then(() => {
        if (cancelled || !containerRef.current) return
        const kakao = window.kakao
        const c = center ?? markers[0] ?? SEOUL
        const map = new kakao.maps.Map(containerRef.current, {
          center: new kakao.maps.LatLng(c.lat, c.lng),
          level,
        })
        markers.forEach((m) => {
          const marker = new kakao.maps.Marker({
            position: new kakao.maps.LatLng(m.lat, m.lng),
            title: m.title,
          })
          marker.setMap(map)
          if (onMarkerClick) {
            kakao.maps.event.addListener(marker, 'click', () => onMarkerClick(m.id))
          }
        })
      })
      .catch((e) => console.warn('지도를 표시할 수 없습니다:', e.message))
    return () => {
      cancelled = true
    }
  }, [markers, center, level, onMarkerClick])

  if (!KEY) {
    return (
      <div className={className ?? 'w-full h-96'}>
        <div className="flex h-full items-center justify-center bg-slate-100 text-slate-500 text-sm">
          카카오맵 키(VITE_KAKAO_MAP_KEY)가 설정되지 않았습니다
        </div>
      </div>
    )
  }
  return <div ref={containerRef} className={className ?? 'w-full h-96'} />
}
```

- [ ] **Step 4: 커밋**

```bash
git add web/src/kakao.d.ts web/src/components/KakaoMap.tsx web/.env.example
git commit -m "feat(web): KakaoMap component with lazy SDK loading

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: 매물 목록 페이지 (필터 + 지도 토글)

**Files:**
- Create: `web/src/pages/listings/ListingList.tsx`

- [ ] **Step 1: web/src/pages/listings/ListingList.tsx 생성**

Create `web/src/pages/listings/ListingList.tsx`:
```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { listListings, type ListingQuery } from '../../api/listings'
import { KakaoMap, type MapMarker } from '../../components/KakaoMap'

const dealLabels: Record<string, string> = { sale: '매매', jeonse: '전세', wolse: '월세' }

export default function ListingList() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<ListingQuery>({})
  const [view, setView] = useState<'list' | 'map'>('list')
  const { data, isLoading } = useQuery({
    queryKey: ['listings', filter],
    queryFn: () => listListings(filter),
  })

  const listings = data?.data ?? []
  const markers: MapMarker[] = listings
    .filter((l) => l.latitude != null && l.longitude != null)
    .map((l) => ({ id: l.id, lat: l.latitude!, lng: l.longitude!, title: l.title }))

  return (
    <div className="p-6 text-slate-900">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">매물</h1>
        <Link to="/listings/new" className="px-4 py-2 bg-blue-600 text-white rounded">
          매물 등록
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className="px-3 py-2 border border-slate-300 rounded bg-white"
          value={filter.dealType ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, dealType: e.target.value || undefined }))}
        >
          <option value="">거래유형 전체</option>
          <option value="sale">매매</option>
          <option value="jeonse">전세</option>
          <option value="wolse">월세</option>
        </select>
        <input
          className="px-3 py-2 border border-slate-300 rounded bg-white"
          placeholder="제목·주소 검색"
          value={filter.q ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value || undefined }))}
        />
        <button
          className="px-3 py-2 border border-slate-300 rounded bg-white"
          onClick={() => setView((v) => (v === 'list' ? 'map' : 'list'))}
        >
          {view === 'list' ? '지도 보기' : '목록 보기'}
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-500">불러오는 중...</p>
      ) : view === 'map' ? (
        <KakaoMap
          markers={markers}
          onMarkerClick={(id) => navigate(`/listings/${id}`)}
          className="w-full h-[500px] rounded border border-slate-200"
        />
      ) : listings.length === 0 ? (
        <p className="text-slate-500">매물이 없습니다.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <Link
              key={l.id}
              to={`/listings/${l.id}`}
              className="block border border-slate-200 rounded-lg p-4 bg-white hover:shadow"
            >
              <div className="text-sm text-blue-600">{dealLabels[l.dealType]}</div>
              <div className="font-semibold">{l.title}</div>
              <div className="text-sm text-slate-600">{l.address}</div>
              <div className="text-sm text-slate-500">{l.areaM2}㎡</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add web/src/pages/listings/ListingList.tsx
git commit -m "feat(web): listing list page with filters and map toggle

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: 매물 상세 페이지

**Files:**
- Create: `web/src/pages/listings/ListingDetail.tsx`

- [ ] **Step 1: web/src/pages/listings/ListingDetail.tsx 생성**

Create `web/src/pages/listings/ListingDetail.tsx`:
```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getListing, deleteListing } from '../../api/listings'
import { KakaoMap } from '../../components/KakaoMap'

const dealLabels: Record<string, string> = { sale: '매매', jeonse: '전세', wolse: '월세' }

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>()
  const listingId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: listing, isLoading, isError } = useQuery({
    queryKey: ['listing', listingId],
    queryFn: () => getListing(listingId),
  })

  const del = useMutation({
    mutationFn: () => deleteListing(listingId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['listings'] })
      navigate('/listings', { replace: true })
    },
  })

  if (isLoading) return <p className="p-6 text-slate-500">불러오는 중...</p>
  if (isError || !listing) return <p className="p-6 text-slate-500">매물을 찾을 수 없습니다.</p>

  return (
    <div className="p-6 text-slate-900 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{listing.title}</h1>
        <div className="flex gap-2">
          <Link
            to={`/listings/${listing.id}/edit`}
            className="px-3 py-2 border border-slate-300 rounded bg-white"
          >
            수정
          </Link>
          <button
            className="px-3 py-2 border border-red-300 text-red-600 rounded bg-white"
            onClick={() => {
              if (confirm('이 매물을 삭제할까요?')) del.mutate()
            }}
          >
            삭제
          </button>
        </div>
      </div>

      <div className="grid gap-1 text-sm">
        <div>거래유형: {dealLabels[listing.dealType]}</div>
        {listing.salePrice != null && <div>매매가: {listing.salePrice.toLocaleString()}원</div>}
        {listing.deposit != null && <div>보증금: {listing.deposit.toLocaleString()}원</div>}
        {listing.monthlyRent != null && (
          <div>월세: {listing.monthlyRent.toLocaleString()}원</div>
        )}
        <div>면적: {listing.areaM2}㎡</div>
        <div>주소: {listing.address} {listing.addressDetail ?? ''}</div>
        {listing.description && <div className="mt-2 whitespace-pre-wrap">{listing.description}</div>}
      </div>

      {listing.photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {listing.photos.map((p) => (
            <img key={p.id} src={p.url} alt="매물 사진" className="w-40 h-32 object-cover rounded" />
          ))}
        </div>
      )}

      {listing.latitude != null && listing.longitude != null && (
        <KakaoMap
          markers={[
            {
              id: listing.id,
              lat: listing.latitude,
              lng: listing.longitude,
              title: listing.title,
            },
          ]}
          className="w-full h-80 rounded border border-slate-200"
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add web/src/pages/listings/ListingDetail.tsx
git commit -m "feat(web): listing detail page with photos and map

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: 매물 등록/수정 폼 페이지

**Files:**
- Create: `web/src/pages/listings/ListingForm.tsx`

- [ ] **Step 1: web/src/pages/listings/ListingForm.tsx 생성**

Create `web/src/pages/listings/ListingForm.tsx`:
```tsx
import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getListing, createListing, updateListing, uploadListingPhoto } from '../../api/listings'
import type { CreateListingRequest } from '@rems/shared'

const inputCls =
  'w-full px-3 py-2 border border-slate-300 rounded bg-white text-slate-900 placeholder:text-slate-400'

type FormState = {
  title: string
  dealType: 'sale' | 'jeonse' | 'wolse'
  propertyType: 'apartment' | 'officetel' | 'house' | 'commercial' | 'land'
  salePrice: string
  deposit: string
  monthlyRent: string
  areaM2: string
  address: string
  description: string
}

const empty: FormState = {
  title: '',
  dealType: 'sale',
  propertyType: 'apartment',
  salePrice: '',
  deposit: '',
  monthlyRent: '',
  areaM2: '',
  address: '',
  description: '',
}

function toNumber(s: string): number | undefined {
  if (s.trim() === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

export default function ListingForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = id != null
  const listingId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [form, setForm] = useState<FormState>(empty)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useQuery({
    queryKey: ['listing', listingId],
    queryFn: async () => {
      const l = await getListing(listingId)
      setForm({
        title: l.title,
        dealType: l.dealType,
        propertyType: l.propertyType,
        salePrice: l.salePrice?.toString() ?? '',
        deposit: l.deposit?.toString() ?? '',
        monthlyRent: l.monthlyRent?.toString() ?? '',
        areaM2: l.areaM2.toString(),
        address: l.address,
        description: l.description ?? '',
      })
      setLoaded(true)
      return l
    },
    enabled: isEdit && !loaded,
  })

  const set = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }) as FormState)

  const save = useMutation({
    mutationFn: async () => {
      const payload: CreateListingRequest = {
        title: form.title,
        dealType: form.dealType,
        propertyType: form.propertyType,
        salePrice: toNumber(form.salePrice),
        deposit: toNumber(form.deposit),
        monthlyRent: toNumber(form.monthlyRent),
        areaM2: toNumber(form.areaM2) ?? 0,
        address: form.address,
        description: form.description || undefined,
      }
      const saved = isEdit
        ? await updateListing(listingId, payload)
        : await createListing(payload)
      if (photoFile) await uploadListingPhoto(saved.id, photoFile)
      return saved
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['listings'] })
      qc.invalidateQueries({ queryKey: ['listing', saved.id] })
      navigate(`/listings/${saved.id}`, { replace: true })
    },
    onError: (e) => setError(e instanceof Error ? e.message : '저장 실패'),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    save.mutate()
  }

  return (
    <div className="p-6 text-slate-900">
      <h1 className="text-2xl font-semibold mb-4">{isEdit ? '매물 수정' : '매물 등록'}</h1>
      <form onSubmit={onSubmit} className="max-w-lg space-y-3">
        <input className={inputCls} placeholder="매물명" required value={form.title}
          onChange={(e) => set('title', e.target.value)} />
        <select className={inputCls} value={form.dealType}
          onChange={(e) => set('dealType', e.target.value)}>
          <option value="sale">매매</option>
          <option value="jeonse">전세</option>
          <option value="wolse">월세</option>
        </select>
        <select className={inputCls} value={form.propertyType}
          onChange={(e) => set('propertyType', e.target.value)}>
          <option value="apartment">아파트</option>
          <option value="officetel">오피스텔</option>
          <option value="house">주택</option>
          <option value="commercial">상가</option>
          <option value="land">토지</option>
        </select>
        {form.dealType === 'sale' && (
          <input className={inputCls} type="number" placeholder="매매가 (원)" value={form.salePrice}
            onChange={(e) => set('salePrice', e.target.value)} />
        )}
        {(form.dealType === 'jeonse' || form.dealType === 'wolse') && (
          <input className={inputCls} type="number" placeholder="보증금 (원)" value={form.deposit}
            onChange={(e) => set('deposit', e.target.value)} />
        )}
        {form.dealType === 'wolse' && (
          <input className={inputCls} type="number" placeholder="월세액 (원)" value={form.monthlyRent}
            onChange={(e) => set('monthlyRent', e.target.value)} />
        )}
        <input className={inputCls} type="number" step="0.01" placeholder="전용면적 (㎡)" required
          value={form.areaM2} onChange={(e) => set('areaM2', e.target.value)} />
        <input className={inputCls} placeholder="주소" required value={form.address}
          onChange={(e) => set('address', e.target.value)} />
        <textarea className={inputCls} placeholder="설명" rows={4} value={form.description}
          onChange={(e) => set('description', e.target.value)} />
        <input type="file" accept="image/*"
          onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={save.isPending}
          className="w-full py-2 bg-blue-600 text-white rounded disabled:opacity-50">
          {save.isPending ? '저장 중...' : '저장'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add web/src/pages/listings/ListingForm.tsx
git commit -m "feat(web): listing create/edit form page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: 매물 라우트 등록 + 사이드바 메뉴

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: App.tsx에 매물 라우트 추가**

Read `web/src/App.tsx`. It has a protected section (the `<MainLayout>` wrapped in `<RequireAuth>` from Plan 2) containing nested `<Route>` definitions. Add these four imports at the top:
```tsx
import ListingList from './pages/listings/ListingList'
import ListingDetail from './pages/listings/ListingDetail'
import ListingForm from './pages/listings/ListingForm'
```

Add these four routes among the existing nested protected routes (inside the `MainLayout`/`RequireAuth` section):
```tsx
<Route path="listings" element={<ListingList />} />
<Route path="listings/new" element={<ListingForm />} />
<Route path="listings/:id" element={<ListingDetail />} />
<Route path="listings/:id/edit" element={<ListingForm />} />
```
Match the existing route syntax in the file (with or without leading `/` depending on how nested routes are written there). Do not change other routes in this task.

- [ ] **Step 2: Sidebar.tsx에 매물 메뉴 추가**

Read `web/src/components/layout/Sidebar.tsx`. It renders navigation links. Add a link to `/listings` labeled "매물" following the existing link pattern in that file (same component/markup the other nav items use). Place it near the top of the main nav list. Do not remove other items in this task — demo cleanup is Task 14.

- [ ] **Step 3: 빌드 검증**

Run: `npm run build -w web`
Expected: 타입 에러 없이 빌드 성공.

- [ ] **Step 4: 커밋**

```bash
git add web/src/App.tsx web/src/components/layout/Sidebar.tsx
git commit -m "feat(web): register listing routes and sidebar menu

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

# Phase C — 정리

## Task 14: 데모 페이지·라우트 제거 + catch-all 가드

설계 스펙 7.2(데모 페이지 제거)와 Plan 2 리뷰 #2(공개 catch-all 라우트)를 처리한다.

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/layout/Sidebar.tsx`
- Delete: 부동산과 무관한 데모 페이지 파일들

- [ ] **Step 1: 데모 페이지 파일 삭제**

Run:
```bash
cd "/Volumes/MacExtend 1/REMS"
git rm web/src/pages/pos/PosCounterCheckout.tsx web/src/pages/pos/PosCustomerOrder.tsx \
  web/src/pages/pos/PosKitchenOrder.tsx web/src/pages/pos/PosMenuStock.tsx \
  web/src/pages/pos/PosTableBooking.tsx \
  web/src/pages/ai/AiChat.tsx web/src/pages/ai/AiImageGenerator.tsx \
  web/src/pages/email/EmailCompose.tsx web/src/pages/email/EmailDetail.tsx \
  web/src/pages/email/EmailInbox.tsx \
  web/src/pages/ScrumBoard.tsx web/src/pages/Gallery.tsx web/src/pages/Products.tsx \
  web/src/pages/Pricing.tsx web/src/pages/Calendar.tsx web/src/pages/Widgets.tsx \
  web/src/pages/TidalPlayerPage.tsx web/src/components/TidalDockPlayer.tsx \
  web/src/pages/charts/ChartJs.tsx web/src/pages/dashboard/Analytics.tsx \
  web/src/pages/forms/FormElements.tsx web/src/pages/forms/FormPlugins.tsx \
  web/src/pages/forms/FormWizards.tsx \
  web/src/pages/tables/TableElements.tsx web/src/pages/tables/TablePlugins.tsx \
  web/src/pages/ui/UiBootstrap.tsx web/src/pages/ui/UiButtons.tsx \
  web/src/pages/ui/UiCard.tsx web/src/pages/ui/UiIcons.tsx \
  web/src/pages/ui/UiModalNotification.tsx web/src/pages/ui/UiTabsAccordions.tsx \
  web/src/pages/ui/UiTypography.tsx
```

- [ ] **Step 2: App.tsx에서 데모 라우트·import 제거 + catch-all 가드**

Edit `web/src/App.tsx`:
1. Remove every `import` line referencing a file deleted in Step 1.
2. Remove every `<Route>` that pointed to a deleted page.
3. Keep these routes: `/login`, `/signup`, dashboard(`/` 또는 index), `listings*`, `Profile`, `Settings`, `Error404`.
4. The catch-all `<Route path="*" element={<Error404 />} />` MUST be inside the `RequireAuth`-wrapped `MainLayout` section so unauthenticated users hitting an unknown path are redirected to `/login` (Plan 2 review #2). If it currently sits outside, move it inside the protected section.

Build will tell you if you missed an import — fix until `npm run build -w web` is clean.

- [ ] **Step 3: Sidebar.tsx에서 데모 메뉴 제거**

Edit `web/src/components/layout/Sidebar.tsx`: remove every nav item/link that pointed to a deleted demo page. Keep: 대시보드, 매물, Profile, Settings (and any section headers still relevant). Keep the theme/appearance controls intact.

- [ ] **Step 4: 빌드 검증**

Run: `npm run build -w web`
Expected: 타입 에러·미해결 import 없이 빌드 성공.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "chore(web): remove template demo pages, guard catch-all route

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: 통합 동작 확인 (수동)

**Files:** (수정 없음)

- [ ] **Step 1: 전체 테스트**

Run: `npm run test -w api`
Expected: 27건(또는 그 이상) 모두 통과 — 인증 11 + 매물 CRUD·사진·격리 16.

- [ ] **Step 2: dev 실행 + 흐름 확인**

Run: `npm run dev`. 브라우저에서:
1. 로그인 → 사이드바 "매물" → 매물 등록 → 목록에 표시
2. 매물 상세 → 수정 → 삭제
3. 카카오 키를 `web/.env`에 넣었다면 지도 토글·상세 지도에 마커 표시
4. 데모 메뉴(POS·이메일 등)가 사라졌는지 확인

- [ ] **Step 3: 테넌트 격리 수동 확인**

시크릿 창에서 두 번째 사무소를 가입해 첫 사무소의 매물이 보이지 않는지 확인. (자동 테스트가 이미 보장하지만 눈으로도 확인.)

---

## 다음 계획

Plan 3 완료 후 Plan 4 (Customers & Matching): 고객 CRM CRUD(개인 소속), 고객↔매물 매칭, 고객 페이지. 그리고 Plan 5 (Agents & Dashboard).
