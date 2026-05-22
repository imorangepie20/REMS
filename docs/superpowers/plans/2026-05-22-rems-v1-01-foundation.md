# REMS v1 — Plan 1: Foundation 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** hud-admin-template를 모노레포로 재구성하고, MariaDB·Prisma·Express API 서버·web SPA를 연결해 `npm run dev` 한 번으로 전체가 뜨는 동작 가능한 골격을 만든다.

**Architecture:** npm workspaces 모노레포(`web`/`api`/`packages/shared`). `web`은 Vite React SPA, `api`는 Express + Prisma 서버, 둘은 Vite 프록시(`/api`→:3000)로 연결. DB는 MariaDB, Prisma로 접근.

**Tech Stack:** Node.js 20+, TypeScript, npm workspaces, Vite + React 18, Express 4, Prisma 6, MariaDB 10.6+, zod, Vitest, supertest, TanStack Query.

---

## 사전 준비 (실행 전 확인)

- Node.js 20 이상, npm 10 이상.
- MariaDB 10.6 이상이 로컬에서 실행 중. `mysql` 클라이언트 접근 가능.
- 현재 `/Volumes/MacExtend 1/REMS/`는 git 저장소이며 설계 문서 1건이 커밋되어 있다. `hud-admin-template/`은 별도 `.git`을 가진 하위 폴더다.

## 완료 기준

- `npm run dev` 한 번으로 web(:5173)·api(:3000)가 동시에 뜬다.
- `curl http://localhost:5173/api/health` → `{"status":"ok"}` (Vite 프록시 경유).
- `npm run test` → api 테스트(health, db) 통과.
- MariaDB에 7개 테이블이 생성되어 있다.

---

## Task 1: 모노레포 구조로 재구성

기존 `hud-admin-template/`을 `web/`으로 옮기고, npm workspaces 루트를 만든다.

**Files:**
- Move: `hud-admin-template/` → `web/`
- Create: `package.json` (루트)
- Create: `.gitignore` (루트)
- Modify: `web/package.json` (name 변경)

- [ ] **Step 1: 템플릿을 web/으로 이동하고 중첩 git·빌드 산출물 제거**

Run:
```bash
cd "/Volumes/MacExtend 1/REMS"
mv hud-admin-template web
rm -rf web/.git web/.DS_Store web/node_modules web/dist web/tsconfig.tsbuildinfo web/tsconfig.node.tsbuildinfo
```
Expected: `web/` 폴더에 `package.json`, `src/`가 있고 `web/.git`은 없다.

- [ ] **Step 2: 루트 package.json 생성**

Create `package.json`:
```json
{
  "name": "rems",
  "private": true,
  "version": "0.0.0",
  "workspaces": ["web", "api", "packages/*"],
  "scripts": {
    "dev": "concurrently -n web,api -c blue,green \"npm run dev -w web\" \"npm run dev -w api\"",
    "test": "npm run test -w api"
  },
  "devDependencies": {
    "concurrently": "^9.1.2"
  }
}
```

- [ ] **Step 3: 루트 .gitignore 생성**

Create `.gitignore`:
```
node_modules/
dist/
.DS_Store
*.tsbuildinfo
.env
api/uploads/
```

- [ ] **Step 4: web 패키지 이름 변경**

Modify `web/package.json`: `"name"` 값을 `"hud-admin-template"`에서 `"@rems/web"`로 바꾼다. 다른 필드는 건드리지 않는다.

- [ ] **Step 5: 의존성 설치**

Run:
```bash
cd "/Volumes/MacExtend 1/REMS"
npm install
```
Expected: 루트에 `node_modules/`가 생기고 에러 없이 끝난다. `concurrently`와 web의 기존 의존성이 설치된다.

- [ ] **Step 6: web이 뜨는지 확인**

Run:
```bash
npm run build -w web
```
Expected: Vite 빌드가 성공한다 (`web/dist/` 생성). 빌드만 검증하고 dev 서버는 Task 6에서 확인한다.

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "chore: restructure into npm workspaces monorepo, move template to web/"
```

---

## Task 2: packages/shared 패키지

web·api가 공유할 zod 스키마·타입 패키지를 만든다.

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: packages/shared/package.json 생성**

Create `packages/shared/package.json`:
```json
{
  "name": "@rems/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "zod": "^3.24.1"
  }
}
```

- [ ] **Step 2: packages/shared/tsconfig.json 생성**

Create `packages/shared/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: packages/shared/src/index.ts 생성**

Create `packages/shared/src/index.ts`:
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
```

- [ ] **Step 4: 의존성 설치 및 검증**

Run:
```bash
cd "/Volumes/MacExtend 1/REMS"
npm install
ls node_modules/@rems/shared
```
Expected: `npm install`이 성공하고, `node_modules/@rems/shared`가 `packages/shared`로 심링크되어 있다.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat(shared): add @rems/shared package with pagination schema"
```

---

## Task 3: api 패키지 + Express 골격 + health 엔드포인트

Express API 서버 골격을 만들고, `/api/health`를 TDD로 구현한다.

**Files:**
- Create: `api/package.json`
- Create: `api/tsconfig.json`
- Create: `api/vitest.config.ts`
- Create: `api/.env.example`
- Create: `api/src/config.ts`
- Create: `api/src/errors.ts`
- Create: `api/src/middleware/errorHandler.ts`
- Create: `api/src/app.ts`
- Create: `api/src/index.ts`
- Test: `api/test/health.test.ts`

- [ ] **Step 1: api/package.json 생성**

Create `api/package.json`:
```json
{
  "name": "@rems/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "test": "vitest run",
    "prisma:migrate": "prisma migrate dev",
    "prisma:generate": "prisma generate"
  },
  "dependencies": {
    "@prisma/client": "^6.2.1",
    "@rems/shared": "*",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.10.5",
    "@types/supertest": "^6.0.2",
    "prisma": "^6.2.1",
    "supertest": "^7.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: api/tsconfig.json 생성**

Create `api/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: 의존성 설치**

Run:
```bash
cd "/Volumes/MacExtend 1/REMS"
npm install
```
Expected: api 의존성(express, prisma, vitest 등)이 설치된다.

- [ ] **Step 4: api/vitest.config.ts 생성**

Create `api/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 5: 실패하는 테스트 작성**

Create `api/test/health.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('GET /api/health', () => {
  it('200과 {status:"ok"}를 반환한다', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 6: 테스트 실행 — 실패 확인**

Run:
```bash
npm run test -w api
```
Expected: FAIL — `../src/app` 모듈을 찾을 수 없다.

- [ ] **Step 7: api/src/errors.ts 생성**

Create `api/src/errors.ts`:
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

- [ ] **Step 8: api/src/middleware/errorHandler.ts 생성**

Create `api/src/middleware/errorHandler.ts`:
```ts
import type { Request, Response, NextFunction } from 'express';
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
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: { code: 'INTERNAL', message: '서버 오류가 발생했습니다' },
  });
}
```

- [ ] **Step 9: api/src/app.ts 생성**

Create `api/src/app.ts`:
```ts
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
```

- [ ] **Step 10: 테스트 실행 — 통과 확인**

Run:
```bash
npm run test -w api
```
Expected: PASS — `GET /api/health` 테스트 통과.

- [ ] **Step 11: api/src/config.ts 생성**

Create `api/src/config.ts`:
```ts
import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? '',
};
```

- [ ] **Step 12: api/src/index.ts 생성**

Create `api/src/index.ts`:
```ts
import { createApp } from './app';
import { config } from './config';

const app = createApp();
app.listen(config.port, () => {
  console.log(`REMS API listening on http://localhost:${config.port}`);
});
```

- [ ] **Step 13: api/.env.example 생성**

Create `api/.env.example`:
```
DATABASE_URL="mysql://rems:rems@localhost:3306/rems"
PORT=3000
```

- [ ] **Step 14: 커밋**

```bash
git add -A
git commit -m "feat(api): Express skeleton with health endpoint and error handler"
```

---

## Task 4: Prisma 스키마 + MariaDB 마이그레이션

설계 문서 5장의 7개 테이블을 Prisma 스키마로 정의하고 MariaDB에 마이그레이션한다.

**Files:**
- Create: `api/prisma/schema.prisma`
- Create: `api/.env`
- Create: `api/src/db.ts`
- Test: `api/test/db.test.ts`

- [ ] **Step 1: MariaDB 데이터베이스·사용자 생성**

MariaDB에 root로 접속해 실행한다 (Prisma는 마이그레이션 시 shadow DB를 만들므로 로컬 개발용으로 전역 권한을 부여한다):
```sql
CREATE DATABASE IF NOT EXISTS rems CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'rems'@'localhost' IDENTIFIED BY 'rems';
GRANT ALL PRIVILEGES ON *.* TO 'rems'@'localhost';
FLUSH PRIVILEGES;
```
Expected: 에러 없이 완료.

- [ ] **Step 2: api/.env 생성**

Create `api/.env`:
```
DATABASE_URL="mysql://rems:rems@localhost:3306/rems"
PORT=3000
```
(`.env`는 루트 `.gitignore`에 의해 커밋되지 않는다.)

- [ ] **Step 3: api/prisma/schema.prisma 생성**

Create `api/prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model Agency {
  id             BigInt     @id @default(autoincrement())
  name           String     @db.VarChar(255)
  businessNumber String?    @map("business_number") @db.VarChar(20)
  phone          String?    @db.VarChar(20)
  address        String?    @db.VarChar(255)
  createdAt      DateTime   @default(now()) @map("created_at")
  agents         Agent[]
  listings       Listing[]
  customers      Customer[]

  @@map("agency")
}

enum AgentRole {
  owner
  member
}

enum AgentStatus {
  active
  inactive
}

model Agent {
  id           BigInt      @id @default(autoincrement())
  agencyId     BigInt      @map("agency_id")
  email        String      @unique @db.VarChar(255)
  passwordHash String      @map("password_hash") @db.VarChar(255)
  name         String      @db.VarChar(100)
  phone        String?     @db.VarChar(20)
  role         AgentRole
  status       AgentStatus @default(active)
  createdAt    DateTime    @default(now()) @map("created_at")
  agency       Agency      @relation(fields: [agencyId], references: [id])
  sessions     Session[]
  listings     Listing[]
  customers    Customer[]

  @@index([agencyId])
  @@map("agent")
}

model Session {
  id        String   @id @db.VarChar(64)
  agentId   BigInt   @map("agent_id")
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")
  agent     Agent    @relation(fields: [agentId], references: [id], onDelete: Cascade)

  @@index([agentId])
  @@map("session")
}

enum ListingSource {
  manual
  naver
  public_data
}

enum DealType {
  sale
  jeonse
  wolse
}

enum PropertyType {
  apartment
  officetel
  house
  commercial
  land
}

enum ListingStatus {
  active
  completed
  hidden
}

model Listing {
  id            BigInt            @id @default(autoincrement())
  agencyId      BigInt            @map("agency_id")
  createdBy     BigInt            @map("created_by")
  source        ListingSource     @default(manual)
  sourceId      String?           @map("source_id") @db.VarChar(100)
  title         String            @db.VarChar(255)
  dealType      DealType          @map("deal_type")
  propertyType  PropertyType      @map("property_type")
  salePrice     BigInt?           @map("sale_price")
  deposit       BigInt?
  monthlyRent   BigInt?           @map("monthly_rent")
  areaM2        Decimal           @map("area_m2") @db.Decimal(10, 2)
  address       String            @db.VarChar(255)
  addressDetail String?           @map("address_detail") @db.VarChar(255)
  latitude      Decimal?          @db.Decimal(10, 7)
  longitude     Decimal?          @db.Decimal(10, 7)
  floor         Int?
  totalFloors   Int?              @map("total_floors")
  rooms         Int?
  bathrooms     Int?
  builtYear     Int?              @map("built_year")
  status        ListingStatus     @default(active)
  description   String?           @db.Text
  createdAt     DateTime          @default(now()) @map("created_at")
  updatedAt     DateTime          @updatedAt @map("updated_at")
  agency        Agency            @relation(fields: [agencyId], references: [id])
  creator       Agent             @relation(fields: [createdBy], references: [id])
  photos        ListingPhoto[]
  customerLinks CustomerListing[]

  @@unique([agencyId, source, sourceId])
  @@index([agencyId, status])
  @@map("listing")
}

model ListingPhoto {
  id        BigInt   @id @default(autoincrement())
  listingId BigInt   @map("listing_id")
  url       String   @db.VarChar(500)
  sortOrder Int      @default(0) @map("sort_order")
  createdAt DateTime @default(now()) @map("created_at")
  listing   Listing  @relation(fields: [listingId], references: [id], onDelete: Cascade)

  @@index([listingId])
  @@map("listing_photo")
}

enum CustomerType {
  buyer
  seller
  tenant
  landlord
}

model Customer {
  id           BigInt            @id @default(autoincrement())
  agencyId     BigInt            @map("agency_id")
  ownerAgentId BigInt            @map("owner_agent_id")
  name         String            @db.VarChar(100)
  phone        String?           @db.VarChar(20)
  customerType CustomerType      @map("customer_type")
  budgetMin    BigInt?           @map("budget_min")
  budgetMax    BigInt?           @map("budget_max")
  desiredArea  String?           @map("desired_area") @db.VarChar(255)
  memo         String?           @db.Text
  createdAt    DateTime          @default(now()) @map("created_at")
  updatedAt    DateTime          @updatedAt @map("updated_at")
  agency       Agency            @relation(fields: [agencyId], references: [id])
  ownerAgent   Agent             @relation(fields: [ownerAgentId], references: [id])
  listingLinks CustomerListing[]

  @@index([agencyId, ownerAgentId])
  @@map("customer")
}

enum MatchStatus {
  suggested
  interested
  visited
  contracted
  rejected
}

model CustomerListing {
  id         BigInt      @id @default(autoincrement())
  customerId BigInt      @map("customer_id")
  listingId  BigInt      @map("listing_id")
  status     MatchStatus @default(suggested)
  memo       String?     @db.Text
  createdAt  DateTime    @default(now()) @map("created_at")
  updatedAt  DateTime    @updatedAt @map("updated_at")
  customer   Customer    @relation(fields: [customerId], references: [id], onDelete: Cascade)
  listing    Listing     @relation(fields: [listingId], references: [id], onDelete: Cascade)

  @@unique([customerId, listingId])
  @@map("customer_listing")
}
```

- [ ] **Step 4: 마이그레이션 실행**

Run:
```bash
npm run prisma:migrate -w api -- --name init
```
Expected: `api/prisma/migrations/`에 마이그레이션이 생성되고, MariaDB `rems` DB에 7개 테이블(`agency`, `agent`, `session`, `listing`, `listing_photo`, `customer`, `customer_listing`)이 만들어진다. Prisma Client도 함께 생성된다.

- [ ] **Step 5: 테이블 생성 확인**

Run:
```bash
mysql -urems -prems rems -e "SHOW TABLES;"
```
Expected: 7개 테이블 + `_prisma_migrations`가 출력된다.

- [ ] **Step 6: api/src/db.ts 생성**

Create `api/src/db.ts`:
```ts
import { PrismaClient } from '@prisma/client';

/** 앱 전역에서 공유하는 Prisma 클라이언트 */
export const prisma = new PrismaClient();
```

- [ ] **Step 7: DB 연결 테스트 작성**

Create `api/test/db.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { prisma } from '../src/db';

describe('database connection', () => {
  it('agency 테이블 카운트를 조회할 수 있다', async () => {
    const count = await prisma.agency.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 8: 테스트 실행 — 통과 확인**

Run:
```bash
npm run test -w api
```
Expected: PASS — health, db 테스트 2개 모두 통과.

- [ ] **Step 9: 커밋**

```bash
git add -A
git commit -m "feat(api): Prisma schema with 7 tables and MariaDB migration"
```

---

## Task 5: web — Vite 프록시 + TanStack Query + API 클라이언트

web SPA를 api와 연결한다.

**Files:**
- Modify: `web/vite.config.ts`
- Modify: `web/src/main.tsx`
- Create: `web/src/api/client.ts`

- [ ] **Step 1: TanStack Query 설치**

Run:
```bash
cd "/Volumes/MacExtend 1/REMS"
npm install @tanstack/react-query@^5.62.11 -w web
```
Expected: `web/package.json` dependencies에 `@tanstack/react-query`가 추가된다.

- [ ] **Step 2: web/vite.config.ts에 프록시 추가**

Replace `web/vite.config.ts` 전체 내용:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    server: {
        host: true,
        port: 5173,
        proxy: {
            '/api': 'http://localhost:3000',
        },
    },
})
```

- [ ] **Step 3: web/src/main.tsx에 QueryClientProvider 추가**

Replace `web/src/main.tsx` 전체 내용:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './themes/initTheme'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <App />
            </ThemeProvider>
        </QueryClientProvider>
    </StrictMode>,
)
```

- [ ] **Step 4: web/src/api/client.ts 생성**

Create `web/src/api/client.ts`:
```ts
/** API 에러 응답을 나타내는 예외 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** API 호출 공통 래퍼. `/api` 프리픽스를 붙이고 에러 응답을 ApiError로 변환한다. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const err = body?.error ?? { code: 'UNKNOWN', message: '요청에 실패했습니다' };
    throw new ApiError(res.status, err.code, err.message);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
```

- [ ] **Step 5: web 빌드 검증**

Run:
```bash
npm run build -w web
```
Expected: 타입 에러 없이 빌드 성공.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat(web): wire Vite proxy, TanStack Query, and API client"
```

---

## Task 6: 통합 검증

전체가 함께 동작하는지 확인하고 루트 README를 추가한다.

**Files:**
- Create: `README.md` (루트)

- [ ] **Step 1: 루트 README.md 생성**

Create `README.md`:
```markdown
# REMS

부동산 중개사용 멀티테넌트 매물·고객 관리 SaaS.

## 구조

- `web/` — Vite + React SPA
- `api/` — Express + Prisma API 서버
- `packages/shared/` — web·api 공유 zod 스키마·타입

## 개발

사전 준비: Node.js 20+, MariaDB 10.6+.

```
npm install
npm run dev     # web :5173, api :3000 동시 실행
npm run test    # api 테스트
```

설계 문서: `docs/superpowers/specs/2026-05-22-rems-v1-design.md`
```

- [ ] **Step 2: 전체 dev 실행**

Run (별도 터미널에서):
```bash
cd "/Volumes/MacExtend 1/REMS"
npm run dev
```
Expected: web(`:5173`)·api(`:3000`)가 모두 뜬다. api 콘솔에 `REMS API listening on http://localhost:3000`이 출력된다.

- [ ] **Step 3: api 직접 호출 확인**

Run (dev가 실행 중인 상태에서 다른 터미널):
```bash
curl -s http://localhost:3000/api/health
```
Expected: `{"status":"ok"}`

- [ ] **Step 4: Vite 프록시 경유 호출 확인**

Run:
```bash
curl -s http://localhost:5173/api/health
```
Expected: `{"status":"ok"}` (web dev 서버가 `/api`를 api로 프록시).

- [ ] **Step 5: 전체 테스트 실행**

Run:
```bash
npm run test
```
Expected: api 테스트(health, db) 모두 통과.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "docs: add root README with dev instructions"
```

---

## 다음 계획

Plan 1 완료 후 Plan 2 (Auth & Tenancy)를 작성한다: 사무소 가입·로그인·로그아웃·세션, 인증 미들웨어, 테넌트 강제 서비스 계층, 로그인/가입 페이지.
