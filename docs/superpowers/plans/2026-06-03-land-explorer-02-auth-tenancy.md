# Land Explorer — Phase 2: Auth & Multi-tenancy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 멀티테넌트 인증 시스템 구축 — 사무소(agency) 단위로 직원(agent)이 가입·로그인하고, owner/member 역할로 권한이 격리되며, 사무소·계정·중개사 정보를 설정 페이지에서 관리한다.

**Architecture:** Next.js Route Handlers로 REST API 구현, httpOnly 쿠키 + DB Session 테이블로 세션 관리, bcrypt로 비밀번호 해싱. Prisma 모델 Agency/Agent/Session + Role/AgentStatus enum. App Router의 route group `(auth)` (공용)와 `(app)` (인증 필수)으로 레이아웃 분리. Settings 페이지는 단일 페이지 + 사이드바 섹션 state.

**Tech Stack:** Next.js 15 App Router, Prisma 5 + Postgres 16, bcrypt(js), zod, React 19 (Client + Server Components 혼합), Tailwind v4 + HUD 테마, Vitest 1.x

**Working directory:** `/Volumes/MacExtend 1/REMS`

---

## File Structure

```
prisma/
├── schema.prisma                          # 모델·enum 추가
└── migrations/                            # 첫 실제 마이그레이션 (Phase 1은 db push만 했음)
    └── <timestamp>_init_auth_tenancy/
        └── migration.sql

src/
├── lib/
│   ├── db.ts                              # (Phase 1 그대로)
│   ├── password.ts                        # bcrypt hash/verify
│   ├── session.ts                         # 토큰 생성·쿠키 set/clear/get·세션 검증
│   ├── auth-helpers.ts                    # requireAuth(), requireOwner() route 헬퍼
│   ├── validators.ts                      # zod 스키마 (signup, login, password, agency, agent)
│   ├── api-client.ts                      # 클라이언트 fetch 래퍼
│   └── errors.ts                          # AuthError, ForbiddenError 등 도메인 에러
├── app/
│   ├── layout.tsx                         # (Phase 1 그대로 — HUD body)
│   ├── globals.css                        # (Phase 1 그대로)
│   ├── (auth)/                            # 공용 라우트 그룹
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (app)/                             # 인증 필수 라우트 그룹
│   │   ├── layout.tsx                     # Sidebar + TopBar + 인증 가드
│   │   ├── page.tsx                       # 대시보드 (Phase 1 홈을 이리 이동)
│   │   └── settings/
│   │       └── page.tsx                   # 5섹션 단일 페이지
│   └── api/
│       ├── health/route.ts                # (Phase 1 그대로)
│       ├── auth/
│       │   ├── signup/route.ts
│       │   ├── login/route.ts
│       │   ├── logout/route.ts
│       │   ├── me/route.ts
│       │   └── password/route.ts
│       ├── agency/route.ts                # PATCH (owner)
│       └── agents/
│           ├── route.ts                   # GET, POST (owner for POST)
│           └── [id]/route.ts              # PATCH (self or owner)
├── auth/
│   ├── AuthContext.tsx                    # Provider + useAuth()
│   └── RequireAuth.tsx                    # (선택) 가드 컴포넌트
├── components/
│   ├── common/
│   │   └── Button.tsx                     # REMS 차용
│   └── layout/
│       ├── Sidebar.tsx
│       └── TopBar.tsx

tests/
├── health.test.ts                         # (Phase 1 그대로)
├── helpers.ts                             # resetDb(), signupAgent(), addMember() 등 픽스처
├── auth-signup.test.ts
├── auth-login.test.ts
├── auth-logout-me.test.ts
├── auth-password.test.ts
├── agency.test.ts
├── agents.test.ts
└── tenancy.test.ts                        # 사무소 간 데이터 격리
```

**삭제:**
- `prisma/schema.prisma`의 `PhaseOnePlaceholder` 모델 (Task 1에서)
- `src/app/page.tsx` (Phase 1 홈) — Task 19에서 `(app)/page.tsx`로 이동
- Postgres의 `PhaseOnePlaceholder` 테이블 — Task 2 migration이 drop

---

## Tasks

### Task 1: Prisma 스키마 — Agency/Agent/Session + enum

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 스키마 전체 교체**

`prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  owner
  member
}

enum AgentStatus {
  active
  suspended
}

model Agency {
  id             Int      @id @default(autoincrement())
  name           String
  businessNumber String?
  phone          String?
  address        String?
  agents         Agent[]
  createdAt      DateTime @default(now())
}

model Agent {
  id           Int          @id @default(autoincrement())
  agencyId     Int
  agency       Agency       @relation(fields: [agencyId], references: [id])
  email        String       @unique
  passwordHash String
  name         String
  phone        String?
  role         Role         @default(member)
  status       AgentStatus  @default(active)
  sessions     Session[]
  createdAt    DateTime     @default(now())

  @@index([agencyId])
}

model Session {
  id        Int      @id @default(autoincrement())
  agentId   Int
  agent     Agent    @relation(fields: [agentId], references: [id], onDelete: Cascade)
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([agentId])
}
```

- [ ] **Step 2: prisma format으로 정규화**

```bash
npx prisma format
```
Expected: "Formatted X files in Yms"

- [ ] **Step 3: 커밋**

```bash
git add prisma/schema.prisma
git commit -m "feat(prisma): Agency/Agent/Session 모델 + Role/AgentStatus enum (PhaseOnePlaceholder 제거)"
```

### Task 2: 첫 마이그레이션 (auth-tenancy init)

**Files:**
- Create: `prisma/migrations/<timestamp>_init_auth_tenancy/migration.sql`
- Create: `prisma/migrations/migration_lock.toml`

- [ ] **Step 1: 마이그레이션 생성 + 적용**

```bash
npx prisma migrate dev --name init_auth_tenancy
```
Expected:
- 자동 생성된 `prisma/migrations/<timestamp>_init_auth_tenancy/migration.sql`이 PhaseOnePlaceholder 테이블 DROP + Agency/Agent/Session 테이블·enum CREATE를 포함
- `migration_lock.toml`도 생성
- `prisma generate` 자동 호출
- `Your database is now in sync` 메시지

- [ ] **Step 2: 실제 DB 검증**

```bash
docker compose exec -T db psql -U app -d land_explorer -c '\dt' | head -20
docker compose exec -T db psql -U app -d land_explorer -c "SELECT typname FROM pg_type WHERE typname IN ('Role','AgentStatus');"
```
Expected:
- 테이블 목록에 `Agency`, `Agent`, `Session`, `_prisma_migrations` 포함, `PhaseOnePlaceholder` 없음
- `Role`, `AgentStatus` 타입 존재

- [ ] **Step 3: 마이그레이션 커밋**

```bash
git add prisma/migrations/
git commit -m "feat(db): init_auth_tenancy 마이그레이션 — Agency/Agent/Session 테이블 생성"
```

### Task 3: Validators (zod 스키마)

**Files:**
- Create: `src/lib/validators.ts`

- [ ] **Step 1: 모듈 작성**

`src/lib/validators.ts`:
```typescript
import { z } from 'zod'

export const signupSchema = z.object({
  agency: z.object({
    name: z.string().min(1, '사무소 이름은 필수입니다').max(100),
  }),
  owner: z.object({
    name: z.string().min(1, '이름은 필수입니다').max(50),
    email: z.string().email('올바른 이메일을 입력하세요').max(100),
    password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다').max(100),
    phone: z.string().max(20).optional(),
  }),
})
export type SignupInput = z.infer<typeof signupSchema>

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
export type LoginInput = z.infer<typeof loginSchema>

export const changePasswordSchema = z.object({
  current: z.string().min(1, '현재 비밀번호를 입력하세요'),
  next: z.string().min(8, '새 비밀번호는 최소 8자 이상이어야 합니다').max(100),
})
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

export const updateAgencySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  businessNumber: z.string().max(50).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
})
export type UpdateAgencyInput = z.infer<typeof updateAgencySchema>

export const createAgentSchema = z.object({
  name: z.string().min(1).max(50),
  email: z.string().email().max(100),
  password: z.string().min(8).max(100),
  phone: z.string().max(20).optional(),
})
export type CreateAgentInput = z.infer<typeof createAgentSchema>

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  phone: z.string().max(20).nullable().optional(),
  role: z.enum(['owner', 'member']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
})
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>
```

- [ ] **Step 2: zod 설치**

```bash
npm install zod
```

- [ ] **Step 3: TS 컴파일 검증**

```bash
npx tsc --noEmit
```
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add src/lib/validators.ts package.json package-lock.json
git commit -m "feat(lib): zod validators (signup/login/password/agency/agent)"
```

### Task 4: Password 라이브러리 (bcrypt) — TDD

**Files:**
- Create: `src/lib/password.ts`
- Create: `tests/lib-password.test.ts`

- [ ] **Step 1: bcryptjs 설치**

```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```

- [ ] **Step 2: 실패 테스트 작성**

`tests/lib-password.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/password'

describe('password', () => {
  it('hash + verify 라운드트립', async () => {
    const hash = await hashPassword('hunter2-strong!')
    expect(hash).not.toBe('hunter2-strong!')
    expect(hash.length).toBeGreaterThan(20)
    expect(await verifyPassword('hunter2-strong!', hash)).toBe(true)
  })
  it('잘못된 비밀번호는 false', async () => {
    const hash = await hashPassword('correct')
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })
})
```

- [ ] **Step 3: 테스트 실행, 실패 확인**

```bash
npm test -- tests/lib-password.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/password'`

- [ ] **Step 4: 구현**

`src/lib/password.ts`:
```typescript
import bcrypt from 'bcryptjs'

const COST = 10

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, COST)
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash)
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npm test -- tests/lib-password.test.ts
```
Expected: `2 passed`

- [ ] **Step 6: 커밋**

```bash
git add src/lib/password.ts tests/lib-password.test.ts package.json package-lock.json
git commit -m "feat(lib): bcrypt 기반 password hash/verify + 테스트"
```

### Task 5: Session 라이브러리

**Files:**
- Create: `src/lib/session.ts`
- Create: `tests/lib-session.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/lib-session.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { generateSessionToken, SESSION_COOKIE } from '@/lib/session'

describe('session', () => {
  it('토큰은 64자 hex 문자열', () => {
    const t = generateSessionToken()
    expect(t).toMatch(/^[0-9a-f]{64}$/)
  })
  it('두 번 호출하면 서로 다른 토큰', () => {
    expect(generateSessionToken()).not.toBe(generateSessionToken())
  })
  it('쿠키 이름은 le_session', () => {
    expect(SESSION_COOKIE).toBe('le_session')
  })
})
```

- [ ] **Step 2: 테스트 실행, 실패 확인**

```bash
npm test -- tests/lib-session.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: 구현 — Request/NextResponse 기반 (Vitest 직접 호출 가능)**

> Next.js `cookies()` from `next/headers`는 AsyncLocalStorage 컨텍스트가 필요해서 Vitest에서 라우트 핸들러 직접 호출 시 동작하지 않는다. 대신 Request 헤더에서 읽고 `NextResponse.cookies`로 쓴다.

`src/lib/session.ts`:
```typescript
import { randomBytes } from 'node:crypto'
import type { NextResponse } from 'next/server'
import { prisma } from './db'

export const SESSION_COOKIE = 'le_session'
const SESSION_TTL_DAYS = 30
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

export async function createSession(agentId: number): Promise<string> {
  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await prisma.session.create({ data: { agentId, token, expiresAt } })
  return token
}

export function setSessionCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  })
  return res
}

export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}

export function getSessionTokenFromRequest(req: Request): string | null {
  const cookie = req.headers.get('cookie') ?? ''
  const m = cookie.match(/(?:^|;\s*)le_session=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

export interface SessionAgent {
  id: number
  agencyId: number
  email: string
  name: string
  role: 'owner' | 'member'
  status: 'active' | 'suspended'
}

export async function getSessionAgent(req: Request): Promise<SessionAgent | null> {
  const token = getSessionTokenFromRequest(req)
  if (!token) return null
  const session = await prisma.session.findUnique({
    where: { token },
    include: { agent: true },
  })
  if (!session) return null
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }
  if (session.agent.status !== 'active') return null
  const a = session.agent
  return {
    id: a.id,
    agencyId: a.agencyId,
    email: a.email,
    name: a.name,
    role: a.role,
    status: a.status,
  }
}

export async function destroySession(token: string): Promise<void> {
  await prisma.session.delete({ where: { token } }).catch(() => {})
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- tests/lib-session.test.ts
```
Expected: `3 passed`

- [ ] **Step 5: 커밋**

```bash
git add src/lib/session.ts tests/lib-session.test.ts
git commit -m "feat(lib): session — 토큰 생성, httpOnly 쿠키, DB 세션 검증"
```

### Task 6: 에러 클래스 + auth-helpers

**Files:**
- Create: `src/lib/errors.ts`
- Create: `src/lib/auth-helpers.ts`

- [ ] **Step 1: errors.ts 작성**

`src/lib/errors.ts`:
```typescript
export class AuthError extends Error {
  constructor(message = '로그인이 필요합니다') {
    super(message)
    this.name = 'AuthError'
  }
}

export class ForbiddenError extends Error {
  constructor(message = '권한이 없습니다') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export class ConflictError extends Error {
  constructor(message = '이미 존재합니다') {
    super(message)
    this.name = 'ConflictError'
  }
}

export class NotFoundError extends Error {
  constructor(message = '찾을 수 없습니다') {
    super(message)
    this.name = 'NotFoundError'
  }
}
```

- [ ] **Step 2: auth-helpers.ts 작성**

`src/lib/auth-helpers.ts`:
```typescript
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getSessionAgent, type SessionAgent } from './session'
import { AuthError, ForbiddenError, ConflictError, NotFoundError } from './errors'

export async function requireAuth(req: Request): Promise<SessionAgent> {
  const agent = await getSessionAgent(req)
  if (!agent) throw new AuthError()
  return agent
}

export async function requireOwner(req: Request): Promise<SessionAgent> {
  const agent = await requireAuth(req)
  if (agent.role !== 'owner') throw new ForbiddenError('owner 권한이 필요합니다')
  return agent
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: '입력값이 올바르지 않습니다', details: err.issues } },
      { status: 400 },
    )
  }
  if (err instanceof AuthError) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: err.message } }, { status: 401 })
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: err.message } }, { status: 403 })
  }
  if (err instanceof NotFoundError) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: err.message } }, { status: 404 })
  }
  if (err instanceof ConflictError) {
    return NextResponse.json({ error: { code: 'CONFLICT', message: err.message } }, { status: 409 })
  }
  console.error(err)
  return NextResponse.json({ error: { code: 'INTERNAL', message: '서버 오류' } }, { status: 500 })
}
```

- [ ] **Step 3: TS 검증**

```bash
npx tsc --noEmit
```
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add src/lib/errors.ts src/lib/auth-helpers.ts
git commit -m "feat(lib): errors + auth-helpers (requireAuth, requireOwner, errorResponse)"
```

### Task 7: tests/helpers.ts — DB reset + 픽스처

**Files:**
- Create: `tests/helpers.ts`

> 통합 테스트들은 같은 Postgres에 접근하므로 매 테스트마다 DB 상태를 깨끗이 한다. `fileParallelism: false`(Phase 1에서 이미 설정)와 결합.

- [ ] **Step 1: helpers.ts 작성**

`tests/helpers.ts`:
```typescript
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/password'

export async function resetDb(): Promise<void> {
  // 외래키 의존 순서 역방향
  await prisma.session.deleteMany()
  await prisma.agent.deleteMany()
  await prisma.agency.deleteMany()
}

export interface SignupResult {
  agencyId: number
  agentId: number
  cookie: string  // "le_session=..." (테스트에서 fetch 헤더로 사용)
}

export async function signupAgent(
  fetcher: (req: Request) => Promise<Response>,
  overrides: Partial<{ agencyName: string; name: string; email: string; password: string }> = {},
): Promise<SignupResult> {
  const payload = {
    agency: { name: overrides.agencyName ?? '테스트사무소' },
    owner: {
      name: overrides.name ?? '홍길동',
      email: overrides.email ?? `test-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`,
      password: overrides.password ?? 'pw12345678',
    },
  }
  const res = await fetcher(new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }))
  if (res.status !== 200) {
    throw new Error(`signup failed: ${res.status} ${await res.text()}`)
  }
  const body = await res.json()
  const setCookie = res.headers.get('set-cookie') ?? ''
  // "le_session=...; Path=/; HttpOnly; ..." → "le_session=..."
  const match = setCookie.match(/le_session=[^;]+/)
  if (!match) throw new Error(`no session cookie in: ${setCookie}`)
  return { agencyId: body.agency.id, agentId: body.agent.id, cookie: match[0] }
}

export async function addMember(agencyId: number, overrides: Partial<{ name: string; email: string; password: string }> = {}): Promise<{ id: number; email: string; password: string }> {
  const email = overrides.email ?? `member-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
  const password = overrides.password ?? 'member1234'
  const agent = await prisma.agent.create({
    data: {
      agencyId,
      name: overrides.name ?? '멤버',
      email,
      passwordHash: await hashPassword(password),
      role: 'member',
    },
  })
  return { id: agent.id, email, password }
}
```

- [ ] **Step 2: TS 검증**

```bash
npx tsc --noEmit
```
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add tests/helpers.ts
git commit -m "test: 픽스처 helpers (resetDb, signupAgent, addMember)"
```

### Task 8: POST /api/auth/signup — TDD

**Files:**
- Create: `tests/auth-signup.test.ts`
- Create: `src/app/api/auth/signup/route.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/auth-signup.test.ts`:
```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb } from './helpers'
import { POST } from '@/app/api/auth/signup/route'

beforeEach(async () => { await resetDb() })

describe('POST /api/auth/signup', () => {
  it('agency + owner를 생성하고 세션 쿠키를 발급한다', async () => {
    const req = new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agency: { name: '테스트사무소' },
        owner: { name: '홍길동', email: 'test@example.com', password: 'pw12345678', phone: '010-1234-5678' },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.agency.name).toBe('테스트사무소')
    expect(body.agent.email).toBe('test@example.com')
    expect(body.agent.role).toBe('owner')
    expect(res.headers.get('set-cookie')).toMatch(/le_session=/)
  })

  it('잘못된 이메일이면 400', async () => {
    const req = new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agency: { name: 'A' },
        owner: { name: 'B', email: 'not-an-email', password: 'pw12345678' },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('이메일 중복이면 409', async () => {
    const payload = JSON.stringify({
      agency: { name: 'A' },
      owner: { name: 'B', email: 'dup@example.com', password: 'pw12345678' },
    })
    const first = await POST(new Request('http://localhost/api/auth/signup', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: payload,
    }))
    expect(first.status).toBe(200)
    const second = await POST(new Request('http://localhost/api/auth/signup', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: payload,
    }))
    expect(second.status).toBe(409)
  })
})
```

- [ ] **Step 2: 테스트 실행, 실패 확인**

```bash
npm test -- tests/auth-signup.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: 라우트 구현**

`src/app/api/auth/signup/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { signupSchema } from '@/lib/validators'
import { hashPassword } from '@/lib/password'
import { createSession, setSessionCookie } from '@/lib/session'
import { ConflictError } from '@/lib/errors'
import { errorResponse } from '@/lib/auth-helpers'

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const json = await req.json()
    const input = signupSchema.parse(json)

    const existing = await prisma.agent.findUnique({ where: { email: input.owner.email } })
    if (existing) throw new ConflictError('이미 가입된 이메일입니다')

    const passwordHash = await hashPassword(input.owner.password)

    const { agency, agent } = await prisma.$transaction(async (tx) => {
      const agency = await tx.agency.create({ data: { name: input.agency.name } })
      const agent = await tx.agent.create({
        data: {
          agencyId: agency.id,
          email: input.owner.email,
          name: input.owner.name,
          phone: input.owner.phone ?? null,
          passwordHash,
          role: 'owner',
        },
      })
      return { agency, agent }
    })

    const token = await createSession(agent.id)
    const res = NextResponse.json({
      agency: { id: agency.id, name: agency.name },
      agent: {
        id: agent.id,
        email: agent.email,
        name: agent.name,
        role: agent.role,
        agencyId: agent.agencyId,
      },
    })
    return setSessionCookie(res, token)
  } catch (err) {
    return errorResponse(err)
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- tests/auth-signup.test.ts
```
Expected: `3 passed`

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/auth/signup/route.ts tests/auth-signup.test.ts
git commit -m "feat(api): POST /api/auth/signup + 테스트 (agency+owner+세션 트랜잭션)"
```

### Task 9: POST /api/auth/login — TDD

**Files:**
- Create: `tests/auth-login.test.ts`
- Create: `src/app/api/auth/login/route.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/auth-login.test.ts`:
```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signupAgent } from './helpers'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { POST as loginHandler } from '@/app/api/auth/login/route'

beforeEach(async () => { await resetDb() })

describe('POST /api/auth/login', () => {
  it('올바른 자격증명으로 200 + 세션 쿠키', async () => {
    await signupAgent(signupHandler, { email: 'a@x.com', password: 'pw12345678' })
    const res = await loginHandler(new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@x.com', password: 'pw12345678' }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.agent.email).toBe('a@x.com')
    expect(res.headers.get('set-cookie')).toMatch(/le_session=/)
  })

  it('잘못된 비밀번호면 401', async () => {
    await signupAgent(signupHandler, { email: 'b@x.com', password: 'right1234' })
    const res = await loginHandler(new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'b@x.com', password: 'wrong1234' }),
    }))
    expect(res.status).toBe(401)
  })

  it('없는 이메일이면 401', async () => {
    const res = await loginHandler(new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@x.com', password: 'pw12345678' }),
    }))
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/auth-login.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: 구현**

`src/app/api/auth/login/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { loginSchema } from '@/lib/validators'
import { verifyPassword } from '@/lib/password'
import { createSession, setSessionCookie } from '@/lib/session'
import { AuthError } from '@/lib/errors'
import { errorResponse } from '@/lib/auth-helpers'

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const json = await req.json()
    const { email, password } = loginSchema.parse(json)

    const agent = await prisma.agent.findUnique({ where: { email } })
    if (!agent) throw new AuthError('이메일 또는 비밀번호가 잘못되었습니다')
    if (agent.status !== 'active') throw new AuthError('계정이 비활성화되었습니다')
    const ok = await verifyPassword(password, agent.passwordHash)
    if (!ok) throw new AuthError('이메일 또는 비밀번호가 잘못되었습니다')

    const token = await createSession(agent.id)
    const res = NextResponse.json({
      agent: {
        id: agent.id,
        email: agent.email,
        name: agent.name,
        role: agent.role,
        agencyId: agent.agencyId,
      },
    })
    return setSessionCookie(res, token)
  } catch (err) {
    return errorResponse(err)
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- tests/auth-login.test.ts
```
Expected: `3 passed`

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/auth/login/route.ts tests/auth-login.test.ts
git commit -m "feat(api): POST /api/auth/login + 테스트"
```

### Task 10: POST /api/auth/logout + GET /api/auth/me — TDD

**Files:**
- Create: `tests/auth-logout-me.test.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/auth/me/route.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/auth-logout-me.test.ts`:
```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signupAgent } from './helpers'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { GET as meHandler } from '@/app/api/auth/me/route'
import { POST as logoutHandler } from '@/app/api/auth/logout/route'

beforeEach(async () => { await resetDb() })

function withCookie(url: string, cookie: string, init: RequestInit = {}): Request {
  return new Request(url, { ...init, headers: { ...(init.headers ?? {}), cookie } })
}

describe('auth me/logout', () => {
  it('GET /me — 쿠키 없으면 401', async () => {
    const res = await meHandler(new Request('http://localhost/api/auth/me'))
    expect(res.status).toBe(401)
  })

  it('GET /me — 가입 직후 쿠키로 200 + agent 정보', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const res = await meHandler(withCookie('http://localhost/api/auth/me', cookie))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.agent.role).toBe('owner')
    expect(body.agency).toBeTruthy()
  })

  it('POST /logout — 쿠키 무효화', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const out = await logoutHandler(withCookie('http://localhost/api/auth/logout', cookie, { method: 'POST' }))
    expect(out.status).toBe(200)
    // 쿠키 삭제 헤더 확인
    expect(out.headers.get('set-cookie') ?? '').toMatch(/le_session=/)
    // 같은 쿠키로 me 호출 시 세션 DB 레코드는 삭제됐어야 함 → 401
    const me = await meHandler(withCookie('http://localhost/api/auth/me', cookie))
    expect(me.status).toBe(401)
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/auth-logout-me.test.ts
```
Expected: FAIL — modules not found

- [ ] **Step 3: me 구현**

`src/app/api/auth/me/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, errorResponse } from '@/lib/auth-helpers'

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const agent = await requireAuth(req)
    const agency = await prisma.agency.findUnique({ where: { id: agent.agencyId } })
    return NextResponse.json({
      agent: {
        id: agent.id,
        email: agent.email,
        name: agent.name,
        role: agent.role,
        agencyId: agent.agencyId,
      },
      agency: agency ? { id: agency.id, name: agency.name } : null,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
```

- [ ] **Step 4: logout 구현**

`src/app/api/auth/logout/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { clearSessionCookie, destroySession, getSessionTokenFromRequest } from '@/lib/session'

export async function POST(req: Request): Promise<NextResponse> {
  const token = getSessionTokenFromRequest(req)
  if (token) {
    await destroySession(token)
  }
  const res = NextResponse.json({ ok: true })
  return clearSessionCookie(res)
}
```

- [ ] **Step 5: 통과 확인**

```bash
npm test -- tests/auth-logout-me.test.ts
```
Expected: `3 passed`

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/auth/me/route.ts src/app/api/auth/logout/route.ts tests/auth-logout-me.test.ts
git commit -m "feat(api): GET /api/auth/me + POST /api/auth/logout + 테스트"
```

### Task 11: PATCH /api/auth/password — TDD

**Files:**
- Create: `tests/auth-password.test.ts`
- Create: `src/app/api/auth/password/route.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/auth-password.test.ts`:
```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signupAgent } from './helpers'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { POST as loginHandler } from '@/app/api/auth/login/route'
import { PATCH as passwordHandler } from '@/app/api/auth/password/route'

beforeEach(async () => { await resetDb() })

describe('PATCH /api/auth/password', () => {
  it('현재 비번 검증 후 새 비번으로 변경 + 새 비번으로 로그인 성공', async () => {
    const { cookie } = await signupAgent(signupHandler, { email: 'pw@x.com', password: 'oldpw1234' })
    const res = await passwordHandler(new Request('http://localhost/api/auth/password', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ current: 'oldpw1234', next: 'newpw5678' }),
    }))
    expect(res.status).toBe(200)

    const login = await loginHandler(new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'pw@x.com', password: 'newpw5678' }),
    }))
    expect(login.status).toBe(200)
  })

  it('현재 비번 틀리면 401', async () => {
    const { cookie } = await signupAgent(signupHandler, { email: 'pw2@x.com', password: 'right1234' })
    const res = await passwordHandler(new Request('http://localhost/api/auth/password', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ current: 'wrong1234', next: 'newpw5678' }),
    }))
    expect(res.status).toBe(401)
  })

  it('비로그인 401', async () => {
    const res = await passwordHandler(new Request('http://localhost/api/auth/password', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ current: 'x', next: 'pw12345678' }),
    }))
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/auth-password.test.ts
```
Expected: FAIL

- [ ] **Step 3: 구현**

`src/app/api/auth/password/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { changePasswordSchema } from '@/lib/validators'
import { hashPassword, verifyPassword } from '@/lib/password'
import { requireAuth, errorResponse } from '@/lib/auth-helpers'
import { AuthError } from '@/lib/errors'

export async function PATCH(req: Request): Promise<NextResponse> {
  try {
    const me = await requireAuth(req)
    const { current, next } = changePasswordSchema.parse(await req.json())

    const agent = await prisma.agent.findUnique({ where: { id: me.id } })
    if (!agent) throw new AuthError()
    const ok = await verifyPassword(current, agent.passwordHash)
    if (!ok) throw new AuthError('현재 비밀번호가 올바르지 않습니다')

    const nextHash = await hashPassword(next)
    await prisma.agent.update({ where: { id: me.id }, data: { passwordHash: nextHash } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
```

- [ ] **Step 4: 통과 확인**

```bash
npm test -- tests/auth-password.test.ts
```
Expected: `3 passed`

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/auth/password/route.ts tests/auth-password.test.ts
git commit -m "feat(api): PATCH /api/auth/password + 테스트"
```

### Task 12: PATCH /api/agency — TDD (owner only)

**Files:**
- Create: `tests/agency.test.ts`
- Create: `src/app/api/agency/route.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/agency.test.ts`:
```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signupAgent, addMember } from './helpers'
import { prisma } from '@/lib/db'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { POST as loginHandler } from '@/app/api/auth/login/route'
import { PATCH as agencyHandler } from '@/app/api/agency/route'

beforeEach(async () => { await resetDb() })

describe('PATCH /api/agency', () => {
  it('owner — 사무소 정보 수정 200', async () => {
    const { agencyId, cookie } = await signupAgent(signupHandler)
    const res = await agencyHandler(new Request('http://localhost/api/agency', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: '신규명', phone: '02-1234-5678', address: '서울시 강남구' }),
    }))
    expect(res.status).toBe(200)
    const updated = await prisma.agency.findUnique({ where: { id: agencyId } })
    expect(updated?.name).toBe('신규명')
    expect(updated?.phone).toBe('02-1234-5678')
  })

  it('member — 403', async () => {
    const { agencyId } = await signupAgent(signupHandler)
    const member = await addMember(agencyId)
    const login = await loginHandler(new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: member.email, password: member.password }),
    }))
    const cookie = (login.headers.get('set-cookie') ?? '').match(/le_session=[^;]+/)?.[0] ?? ''
    const res = await agencyHandler(new Request('http://localhost/api/agency', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: 'X' }),
    }))
    expect(res.status).toBe(403)
  })

  it('비로그인 — 401', async () => {
    const res = await agencyHandler(new Request('http://localhost/api/agency', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    }))
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/agency.test.ts
```
Expected: FAIL

- [ ] **Step 3: 구현**

`src/app/api/agency/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { updateAgencySchema } from '@/lib/validators'
import { requireOwner, errorResponse } from '@/lib/auth-helpers'

export async function PATCH(req: Request): Promise<NextResponse> {
  try {
    const me = await requireOwner(req)
    const data = updateAgencySchema.parse(await req.json())
    const updated = await prisma.agency.update({ where: { id: me.agencyId }, data })
    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      businessNumber: updated.businessNumber,
      phone: updated.phone,
      address: updated.address,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
```

- [ ] **Step 4: 통과 확인**

```bash
npm test -- tests/agency.test.ts
```
Expected: `3 passed`

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/agency/route.ts tests/agency.test.ts
git commit -m "feat(api): PATCH /api/agency (owner) + 테스트"
```

### Task 13: GET + POST /api/agents — TDD

**Files:**
- Create: `tests/agents.test.ts` (Tasks 13-14 공유)
- Create: `src/app/api/agents/route.ts`

- [ ] **Step 1: 실패 테스트 작성 (GET, POST 위주)**

`tests/agents.test.ts`:
```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signupAgent, addMember } from './helpers'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { POST as loginHandler } from '@/app/api/auth/login/route'
import { GET as listAgents, POST as createAgent } from '@/app/api/agents/route'

beforeEach(async () => { await resetDb() })

function loginCookie(email: string, password: string) {
  return loginHandler(new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })).then((r) => (r.headers.get('set-cookie') ?? '').match(/le_session=[^;]+/)?.[0] ?? '')
}

describe('GET /api/agents', () => {
  it('owner — 사무소 멤버 리스트', async () => {
    const { agencyId, cookie } = await signupAgent(signupHandler, { email: 'o@x.com', password: 'pw12345678' })
    await addMember(agencyId, { email: 'm1@x.com' })
    await addMember(agencyId, { email: 'm2@x.com' })
    const res = await listAgents(new Request('http://localhost/api/agents', { headers: { cookie } }))
    expect(res.status).toBe(200)
    const arr = await res.json()
    expect(arr).toHaveLength(3)
    expect(arr.map((a: { email: string }) => a.email).sort()).toEqual(['m1@x.com', 'm2@x.com', 'o@x.com'])
  })

  it('member — 같은 사무소 리스트 가능', async () => {
    const { agencyId } = await signupAgent(signupHandler, { email: 'owner@x.com', password: 'pw12345678' })
    const member = await addMember(agencyId, { email: 'mem@x.com' })
    const cookie = await loginCookie(member.email, member.password)
    const res = await listAgents(new Request('http://localhost/api/agents', { headers: { cookie } }))
    expect(res.status).toBe(200)
  })

  it('비로그인 401', async () => {
    const res = await listAgents(new Request('http://localhost/api/agents'))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/agents', () => {
  it('owner — 새 멤버 생성 200', async () => {
    const { cookie } = await signupAgent(signupHandler, { email: 'o2@x.com', password: 'pw12345678' })
    const res = await createAgent(new Request('http://localhost/api/agents', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: '신규멤버', email: 'new@x.com', password: 'pw12345678', phone: '010-9999-9999' }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.email).toBe('new@x.com')
    expect(body.role).toBe('member')
  })

  it('member — 멤버 생성 시도 403', async () => {
    const { agencyId } = await signupAgent(signupHandler, { email: 'o3@x.com', password: 'pw12345678' })
    const m = await addMember(agencyId)
    const cookie = await loginCookie(m.email, m.password)
    const res = await createAgent(new Request('http://localhost/api/agents', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: 'x', email: 'fail@x.com', password: 'pw12345678' }),
    }))
    expect(res.status).toBe(403)
  })

  it('이메일 중복 409', async () => {
    const { cookie } = await signupAgent(signupHandler, { email: 'o4@x.com', password: 'pw12345678' })
    const payload = JSON.stringify({ name: 'd', email: 'dup-mem@x.com', password: 'pw12345678' })
    await createAgent(new Request('http://localhost/api/agents', {
      method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: payload,
    }))
    const second = await createAgent(new Request('http://localhost/api/agents', {
      method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: payload,
    }))
    expect(second.status).toBe(409)
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/agents.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: 구현**

`src/app/api/agents/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAgentSchema } from '@/lib/validators'
import { hashPassword } from '@/lib/password'
import { requireAuth, requireOwner, errorResponse } from '@/lib/auth-helpers'
import { ConflictError } from '@/lib/errors'

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const me = await requireAuth(req)
    const agents = await prisma.agent.findMany({
      where: { agencyId: me.agencyId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, email: true, name: true, phone: true,
        role: true, status: true, createdAt: true,
      },
    })
    return NextResponse.json(agents)
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const me = await requireOwner(req)
    const input = createAgentSchema.parse(await req.json())

    const existing = await prisma.agent.findUnique({ where: { email: input.email } })
    if (existing) throw new ConflictError('이미 가입된 이메일입니다')

    const passwordHash = await hashPassword(input.password)
    const agent = await prisma.agent.create({
      data: {
        agencyId: me.agencyId,
        email: input.email,
        name: input.name,
        phone: input.phone ?? null,
        passwordHash,
        role: 'member',
      },
      select: {
        id: true, email: true, name: true, phone: true,
        role: true, status: true, createdAt: true,
      },
    })
    return NextResponse.json(agent)
  } catch (err) {
    return errorResponse(err)
  }
}
```

- [ ] **Step 4: 통과 확인**

```bash
npm test -- tests/agents.test.ts
```
Expected: `6 passed` (3 GET + 3 POST)

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/agents/route.ts tests/agents.test.ts
git commit -m "feat(api): GET + POST /api/agents (owner POST) + 테스트"
```

### Task 14: PATCH /api/agents/[id] — TDD

**Files:**
- Modify: `tests/agents.test.ts` (PATCH 케이스 추가)
- Create: `src/app/api/agents/[id]/route.ts`

- [ ] **Step 1: 테스트 추가** — `tests/agents.test.ts` 맨 아래에 새 describe 블록 추가:

```typescript
import { PATCH as updateAgent } from '@/app/api/agents/[id]/route'

describe('PATCH /api/agents/[id]', () => {
  it('본인 — name/phone 수정 200', async () => {
    const { agentId, cookie } = await signupAgent(signupHandler, { email: 'self@x.com', password: 'pw12345678' })
    const res = await updateAgent(
      new Request(`http://localhost/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ name: '바꿈', phone: '010-0000-0000' }),
      }),
      { params: Promise.resolve({ id: String(agentId) }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('바꿈')
  })

  it('member — 다른 사람 수정 시도 403', async () => {
    const { agencyId } = await signupAgent(signupHandler, { email: 'o5@x.com', password: 'pw12345678' })
    const m1 = await addMember(agencyId, { email: 'mm1@x.com' })
    const m2 = await addMember(agencyId, { email: 'mm2@x.com' })
    const cookie = await loginCookie(m1.email, m1.password)
    const res = await updateAgent(
      new Request(`http://localhost/api/agents/${m2.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ name: 'x' }),
      }),
      { params: Promise.resolve({ id: String(m2.id) }) },
    )
    expect(res.status).toBe(403)
  })

  it('owner — 멤버 status 변경 200', async () => {
    const { agencyId, cookie } = await signupAgent(signupHandler, { email: 'o6@x.com', password: 'pw12345678' })
    const m = await addMember(agencyId)
    const res = await updateAgent(
      new Request(`http://localhost/api/agents/${m.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ status: 'suspended' }),
      }),
      { params: Promise.resolve({ id: String(m.id) }) },
    )
    expect(res.status).toBe(200)
  })

  it('member — 자기 status 변경 시도 403', async () => {
    const { agencyId } = await signupAgent(signupHandler, { email: 'o7@x.com', password: 'pw12345678' })
    const m = await addMember(agencyId)
    const cookie = await loginCookie(m.email, m.password)
    const res = await updateAgent(
      new Request(`http://localhost/api/agents/${m.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ status: 'suspended' }),
      }),
      { params: Promise.resolve({ id: String(m.id) }) },
    )
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/agents.test.ts
```
Expected: PATCH 케이스 fail (module not found)

- [ ] **Step 3: 구현**

`src/app/api/agents/[id]/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { updateAgentSchema } from '@/lib/validators'
import { requireAuth, errorResponse } from '@/lib/auth-helpers'
import { ForbiddenError, NotFoundError } from '@/lib/errors'

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const me = await requireAuth(req)
    const { id } = await ctx.params
    const targetId = Number(id)
    if (!Number.isFinite(targetId)) throw new NotFoundError('없는 사용자입니다')

    const target = await prisma.agent.findUnique({ where: { id: targetId } })
    if (!target || target.agencyId !== me.agencyId) throw new NotFoundError('없는 사용자입니다')

    const input = updateAgentSchema.parse(await req.json())

    const wantsManageFields = input.role !== undefined || input.status !== undefined
    const isSelf = me.id === targetId
    const isOwner = me.role === 'owner'

    if (wantsManageFields) {
      if (!isOwner) throw new ForbiddenError('owner 권한이 필요합니다')
      if (isSelf) throw new ForbiddenError('자신의 role/status는 변경할 수 없습니다')
    } else {
      // 프로필(name/phone)만 수정 — 본인 또는 owner
      if (!isSelf && !isOwner) throw new ForbiddenError('타인의 정보는 owner만 수정할 수 있습니다')
    }

    const updated = await prisma.agent.update({
      where: { id: targetId },
      data: {
        name: input.name,
        phone: input.phone === undefined ? undefined : input.phone,
        role: input.role,
        status: input.status,
      },
      select: { id: true, email: true, name: true, phone: true, role: true, status: true, createdAt: true },
    })
    return NextResponse.json(updated)
  } catch (err) {
    return errorResponse(err)
  }
}
```

- [ ] **Step 4: 통과 확인**

```bash
npm test -- tests/agents.test.ts
```
Expected: `10 passed` (이전 6 + 새 4)

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/agents/\[id\]/route.ts tests/agents.test.ts
git commit -m "feat(api): PATCH /api/agents/[id] (self profile / owner manage) + 테스트"
```

### Task 15: 멀티테넌시 격리 통합 테스트

**Files:**
- Create: `tests/tenancy.test.ts`

- [ ] **Step 1: 테스트 작성**

`tests/tenancy.test.ts`:
```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signupAgent } from './helpers'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { GET as listAgents } from '@/app/api/agents/route'
import { PATCH as updateAgent } from '@/app/api/agents/[id]/route'
import { PATCH as agencyHandler } from '@/app/api/agency/route'

beforeEach(async () => { await resetDb() })

describe('tenancy isolation', () => {
  it('사무소 A owner는 사무소 B agent를 보거나 수정할 수 없다', async () => {
    const A = await signupAgent(signupHandler, { agencyName: 'A사무소', email: 'a@x.com', password: 'pw12345678' })
    const B = await signupAgent(signupHandler, { agencyName: 'B사무소', email: 'b@x.com', password: 'pw12345678' })

    // A의 agents 리스트에 B의 agent는 없다
    const listA = await listAgents(new Request('http://localhost/api/agents', { headers: { cookie: A.cookie } }))
    const arrA = await listA.json()
    expect(arrA.map((a: { email: string }) => a.email)).toEqual(['a@x.com'])

    // A가 B의 agentId를 PATCH 시도 → 404 (격리)
    const patch = await updateAgent(
      new Request(`http://localhost/api/agents/${B.agentId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie: A.cookie },
        body: JSON.stringify({ name: '침해' }),
      }),
      { params: Promise.resolve({ id: String(B.agentId) }) },
    )
    expect(patch.status).toBe(404)
  })

  it('각 사무소의 agency 수정은 본인 agencyId에만 적용', async () => {
    const A = await signupAgent(signupHandler, { agencyName: 'A', email: 'aa@x.com', password: 'pw12345678' })
    const B = await signupAgent(signupHandler, { agencyName: 'B', email: 'bb@x.com', password: 'pw12345678' })

    await agencyHandler(new Request('http://localhost/api/agency', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: A.cookie },
      body: JSON.stringify({ name: 'A_변경' }),
    }))

    // B의 cookie로 me → agency name 보면 B 그대로
    // (간단히 B가 자신 agency 다시 PATCH해보기로 검증)
    const resB = await agencyHandler(new Request('http://localhost/api/agency', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: B.cookie },
      body: JSON.stringify({ name: 'B_변경' }),
    }))
    expect(resB.status).toBe(200)
    const body = await resB.json()
    expect(body.id).toBe(B.agencyId)
    expect(body.name).toBe('B_변경')
  })
})
```

- [ ] **Step 2: 실행 + 통과 확인**

```bash
npm test -- tests/tenancy.test.ts
```
Expected: `2 passed`

- [ ] **Step 3: 전체 테스트 스위트 확인**

```bash
npm test
```
Expected: 모든 테스트 통과 (Phase 1 health + Task 4-15 누계). 정확한 카운트는 합산.

- [ ] **Step 4: 커밋**

```bash
git add tests/tenancy.test.ts
git commit -m "test: 사무소 간 멀티테넌시 격리 통합 테스트"
```

### Task 16: lib/api-client.ts + Button 컴포넌트

**Files:**
- Create: `src/lib/api-client.ts`
- Create: `src/components/common/Button.tsx`

- [ ] **Step 1: api-client 작성**

`src/lib/api-client.ts`:
```typescript
export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    let err: ApiError
    try {
      const body = await res.json()
      err = body.error ?? { code: 'UNKNOWN', message: res.statusText }
    } catch {
      err = { code: 'UNKNOWN', message: res.statusText }
    }
    const e = new Error(err.message)
    ;(e as Error & { code?: string }).code = err.code
    throw e
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
```

- [ ] **Step 2: Button 작성 (REMS 차용)**

`src/components/common/Button.tsx`:
```typescript
import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  glow?: boolean
  fullWidth?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

const variants: Record<string, string> = {
  primary: 'bg-hud-accent-primary text-hud-on-accent hover:bg-hud-accent-primary/90',
  secondary: 'bg-hud-accent-info text-hud-on-accent hover:bg-hud-accent-info/90',
  outline: 'border border-hud-accent-primary text-hud-accent-primary hover:bg-hud-accent-primary/10',
  ghost: 'text-hud-text-secondary hover:bg-hud-bg-hover hover:text-hud-text-primary',
  danger: 'bg-hud-accent-danger text-hud-on-accent hover:bg-hud-accent-danger/90',
}

const sizes: Record<string, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2',
}

export default function Button({
  children, variant = 'primary', size = 'md',
  glow = false, fullWidth = false,
  leftIcon, rightIcon, className = '', ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-hud disabled:opacity-50 disabled:cursor-not-allowed'
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${glow ? 'btn-glow' : ''} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {leftIcon && <span>{leftIcon}</span>}
      {children}
      {rightIcon && <span>{rightIcon}</span>}
    </button>
  )
}
```

- [ ] **Step 3: 빌드 검증**

```bash
npm run build
```
Expected: 통과

- [ ] **Step 4: 커밋**

```bash
git add src/lib/api-client.ts src/components/common/Button.tsx
git commit -m "feat(ui): api-client + Button 컴포넌트 (REMS 차용)"
```

### Task 17: AuthContext + RequireAuth

**Files:**
- Create: `src/auth/AuthContext.tsx`
- Create: `src/auth/RequireAuth.tsx`

- [ ] **Step 1: AuthContext 작성**

`src/auth/AuthContext.tsx`:
```typescript
'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiFetch } from '@/lib/api-client'

export interface Me {
  agent: { id: number; email: string; name: string; role: 'owner' | 'member'; agencyId: number }
  agency: { id: number; name: string } | null
}

interface AuthContextValue {
  me: Me | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      const data = await apiFetch<Me>('/auth/me')
      setMe(data)
    } catch {
      setMe(null)
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try { await apiFetch<{ ok: true }>('/auth/logout', { method: 'POST' }) } catch {}
    setMe(null)
  }

  useEffect(() => { refresh() }, [])

  return (
    <AuthContext.Provider value={{ me, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

- [ ] **Step 2: RequireAuth 작성**

`src/auth/RequireAuth.tsx`:
```typescript
'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthContext'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !me) router.replace('/login')
  }, [loading, me, router])

  if (loading) {
    return <div className="p-12 text-hud-text-muted">로딩 중...</div>
  }
  if (!me) return null
  return <>{children}</>
}
```

- [ ] **Step 3: 빌드 검증**

```bash
npm run build
```
Expected: 통과

- [ ] **Step 4: 커밋**

```bash
git add src/auth/AuthContext.tsx src/auth/RequireAuth.tsx
git commit -m "feat(ui): AuthProvider + RequireAuth 컴포넌트"
```

### Task 18: (app) 레이아웃 + 사이드바·탑바 + 대시보드 이동

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/page.tsx` (Phase 1 page.tsx 이동)
- Delete: `src/app/page.tsx`
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/TopBar.tsx`

- [ ] **Step 1: lucide-react 설치**

```bash
npm install lucide-react
```

- [ ] **Step 2: Sidebar 작성**

`src/components/layout/Sidebar.tsx`:
```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Map, Building, Settings } from 'lucide-react'

const NAV = [
  { href: '/', label: '대시보드', icon: LayoutDashboard },
  { href: '/explore', label: '탐색', icon: Map },
  { href: '/listings', label: '내부 매물', icon: Building },
  { href: '/settings', label: '설정', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-56 bg-hud-bg-secondary border-r border-hud-border-secondary p-4 flex flex-col gap-1">
      <div className="text-hud-accent-primary font-bold text-lg mb-4 px-2">Land Explorer</div>
      {NAV.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-hud
              ${active
                ? 'bg-hud-accent-primary/20 text-hud-accent-primary'
                : 'text-hud-text-secondary hover:bg-hud-bg-hover hover:text-hud-text-primary'}`}
          >
            <Icon size={16} />
            {item.label}
          </Link>
        )
      })}
    </aside>
  )
}
```

- [ ] **Step 3: TopBar 작성**

`src/components/layout/TopBar.tsx`:
```typescript
'use client'

import { useAuth } from '@/auth/AuthContext'
import { LogOut } from 'lucide-react'

export function TopBar() {
  const { me, logout } = useAuth()
  if (!me) return null
  return (
    <header className="h-14 bg-hud-bg-secondary border-b border-hud-border-secondary px-6 flex items-center justify-between">
      <div className="text-sm text-hud-text-muted">
        {me.agency?.name ?? '사무소 없음'}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-hud-text-secondary">{me.agent.name} · {me.agent.role}</span>
        <button
          onClick={logout}
          className="text-hud-text-muted hover:text-hud-accent-danger transition-hud"
          aria-label="로그아웃"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: (app) layout 작성**

`src/app/(app)/layout.tsx`:
```typescript
import { ReactNode } from 'react'
import { AuthProvider } from '@/auth/AuthContext'
import { RequireAuth } from '@/auth/RequireAuth'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <RequireAuth>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <TopBar />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </div>
      </RequireAuth>
    </AuthProvider>
  )
}
```

- [ ] **Step 5: 대시보드 페이지 이동**

`src/app/(app)/page.tsx`:
```typescript
export default function Dashboard() {
  return (
    <div className="p-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-hud-accent-primary mb-4">대시보드</h1>
      <p className="text-hud-text-secondary mb-8">
        Phase 2 (Auth & Multi-tenancy) 진행 중. 통계·차트는 Phase 5에서 추가됩니다.
      </p>
      <div className="hud-card hud-card-bottom rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-2">진행 상태</h2>
        <ul className="text-sm text-hud-text-secondary space-y-1">
          <li>✓ Phase 1 Foundation</li>
          <li>· Phase 2 Auth (진행 중)</li>
          <li>· Phase 3 Naver Explore</li>
          <li>· Phase 4 Internal Listings</li>
          <li>· Phase 5 Export + Chart</li>
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Phase 1 page.tsx 삭제**

```bash
rm src/app/page.tsx
```

- [ ] **Step 7: 빌드 검증**

```bash
npm run build
```
Expected: 통과. `/` 라우트가 `(app)/page.tsx`로 잡혀야 함.

- [ ] **Step 8: 커밋**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/TopBar.tsx \
        src/app/\(app\)/layout.tsx src/app/\(app\)/page.tsx \
        package.json package-lock.json
git rm src/app/page.tsx
git commit -m "feat(ui): (app) route group + Sidebar/TopBar + 대시보드 이동"
```

### Task 19: /login 페이지

**Files:**
- Create: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: 페이지 작성**

`src/app/(auth)/login/page.tsx`:
```typescript
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/common/Button'
import { apiFetch } from '@/lib/api-client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null); setLoading(true)
    try {
      await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      router.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 실패')
    } finally {
      setLoading(false)
    }
  }

  const input = 'w-full px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="hud-card hud-card-bottom rounded-lg p-8 w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-hud-accent-primary text-center">로그인</h1>
        <div>
          <label className="block text-xs text-hud-text-muted mb-1">이메일</label>
          <input type="email" required className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-hud-text-muted mb-1">비밀번호</label>
          <input type="password" required className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-hud-accent-danger">{error}</p>}
        <Button variant="primary" type="submit" fullWidth glow disabled={loading}>
          {loading ? '로그인 중...' : '로그인'}
        </Button>
        <p className="text-center text-sm text-hud-text-muted">
          계정이 없으세요?{' '}
          <Link href="/signup" className="text-hud-accent-primary hover:underline">가입하기</Link>
        </p>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: 빌드 검증**

```bash
npm run build
```
Expected: 통과

- [ ] **Step 3: 커밋**

```bash
git add src/app/\(auth\)/login/page.tsx
git commit -m "feat(ui): /login 페이지"
```

### Task 20: /signup 페이지

**Files:**
- Create: `src/app/(auth)/signup/page.tsx`

- [ ] **Step 1: 페이지 작성**

`src/app/(auth)/signup/page.tsx`:
```typescript
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/common/Button'
import { apiFetch } from '@/lib/api-client'

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    agencyName: '', name: '', email: '', password: '', phone: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null); setLoading(true)
    try {
      await apiFetch('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          agency: { name: form.agencyName },
          owner: { name: form.name, email: form.email, password: form.password, phone: form.phone || undefined },
        }),
      })
      router.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : '가입 실패')
    } finally {
      setLoading(false)
    }
  }

  const input = 'w-full px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="hud-card hud-card-bottom rounded-lg p-8 w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-hud-accent-primary text-center">사무소 가입</h1>
        <div>
          <label className="block text-xs text-hud-text-muted mb-1">사무소 이름 *</label>
          <input required className={input} value={form.agencyName} onChange={(e) => set('agencyName', e.target.value)} />
        </div>
        <div className="border-t border-hud-border-secondary pt-4">
          <p className="text-xs text-hud-text-muted mb-3">대표 계정</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-hud-text-muted mb-1">이름 *</label>
              <input required className={input} value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-hud-text-muted mb-1">이메일 *</label>
              <input type="email" required className={input} value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-hud-text-muted mb-1">비밀번호 (8자 이상) *</label>
              <input type="password" required minLength={8} className={input} value={form.password} onChange={(e) => set('password', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-hud-text-muted mb-1">전화 (선택)</label>
              <input className={input} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="010-0000-0000" />
            </div>
          </div>
        </div>
        {error && <p className="text-sm text-hud-accent-danger">{error}</p>}
        <Button variant="primary" type="submit" fullWidth glow disabled={loading}>
          {loading ? '가입 중...' : '가입하기'}
        </Button>
        <p className="text-center text-sm text-hud-text-muted">
          이미 계정이 있으세요?{' '}
          <Link href="/login" className="text-hud-accent-primary hover:underline">로그인</Link>
        </p>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: 빌드 검증**

```bash
npm run build
```
Expected: 통과

- [ ] **Step 3: 커밋**

```bash
git add src/app/\(auth\)/signup/page.tsx
git commit -m "feat(ui): /signup 페이지"
```

### Task 21: Settings 페이지 — shell + section state + Appearance placeholder

**Files:**
- Create: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: 페이지 작성 (shell + 5섹션 placeholder)**

`src/app/(app)/settings/page.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { Building2, User, KeyRound, Users, Palette } from 'lucide-react'

const SECTIONS = [
  { key: 'agency', label: '사무소 정보', icon: Building2 },
  { key: 'account', label: '내 계정', icon: User },
  { key: 'password', label: '비밀번호 변경', icon: KeyRound },
  { key: 'agents', label: '중개사 관리', icon: Users, ownerOnly: true },
  { key: 'appearance', label: '외관', icon: Palette },
] as const

type SectionKey = typeof SECTIONS[number]['key']

export default function SettingsPage() {
  const [current, setCurrent] = useState<SectionKey>('agency')

  return (
    <div className="flex min-h-full">
      <nav className="w-56 border-r border-hud-border-secondary p-4 space-y-1">
        <h2 className="text-sm font-semibold text-hud-text-primary mb-3 px-2">설정</h2>
        {SECTIONS.map((s) => {
          const Icon = s.icon
          const active = s.key === current
          return (
            <button
              key={s.key}
              onClick={() => setCurrent(s.key)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-hud
                ${active
                  ? 'bg-hud-accent-primary/20 text-hud-accent-primary'
                  : 'text-hud-text-secondary hover:bg-hud-bg-hover hover:text-hud-text-primary'}`}
            >
              <Icon size={16} />
              {s.label}
            </button>
          )
        })}
      </nav>

      <div className="flex-1 p-6">
        {current === 'agency' && <p className="text-hud-text-muted">사무소 정보 (Task 22에서 구현)</p>}
        {current === 'account' && <p className="text-hud-text-muted">내 계정 (Task 22에서 구현)</p>}
        {current === 'password' && <p className="text-hud-text-muted">비밀번호 변경 (Task 22에서 구현)</p>}
        {current === 'agents' && <p className="text-hud-text-muted">중개사 관리 (Task 23에서 구현)</p>}
        {current === 'appearance' && <p className="text-hud-text-muted">외관 설정은 후속 작업에서 추가됩니다.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 빌드 검증**

```bash
npm run build
```
Expected: 통과

- [ ] **Step 3: 커밋**

```bash
git add src/app/\(app\)/settings/page.tsx
git commit -m "feat(ui): /settings 5섹션 shell + Appearance placeholder"
```

### Task 22: Settings — Agency / Account / Password 섹션

**Files:**
- Create: `src/components/settings/AgencySection.tsx`
- Create: `src/components/settings/AccountSection.tsx`
- Create: `src/components/settings/PasswordSection.tsx`
- Modify: `src/app/(app)/settings/page.tsx` (placeholder → 실제 컴포넌트)

- [ ] **Step 1: AgencySection**

`src/components/settings/AgencySection.tsx`:
```typescript
'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Button from '@/components/common/Button'
import { apiFetch } from '@/lib/api-client'
import { useAuth } from '@/auth/AuthContext'

interface Agency {
  id: number
  name: string
  businessNumber: string | null
  phone: string | null
  address: string | null
}

const input = 'w-full px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'

export default function AgencySection() {
  const { me, refresh } = useAuth()
  const isOwner = me?.agent.role === 'owner'
  const [form, setForm] = useState({ name: '', businessNumber: '', phone: '', address: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    apiFetch<{ agency: { id: number; name: string } }>('/auth/me')
      .then(async () => {
        // /me는 간단 필드만 — 전체는 별도 GET이 없으므로 PATCH 후 응답으로 보강
        // 초기값은 me.agency.name부터 채우고 나머지는 빈 값
        if (me?.agency) setForm((f) => ({ ...f, name: me.agency.name }))
      })
      .finally(() => setLoading(false))
  }, [me])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null); setSuccess(false); setSaving(true)
    try {
      const updated = await apiFetch<Agency>('/agency', {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name,
          businessNumber: form.businessNumber || null,
          phone: form.phone || null,
          address: form.address || null,
        }),
      })
      setForm({
        name: updated.name,
        businessNumber: updated.businessNumber ?? '',
        phone: updated.phone ?? '',
        address: updated.address ?? '',
      })
      setSuccess(true)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-hud-text-muted">불러오는 중...</p>

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      <h2 className="text-lg font-semibold text-hud-text-primary">사무소 정보</h2>
      {!isOwner && <p className="text-sm text-hud-accent-warning">owner만 수정할 수 있습니다.</p>}
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">사무소 이름</label>
        <input className={input} value={form.name} disabled={!isOwner}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </div>
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">사업자등록번호</label>
        <input className={input} value={form.businessNumber} disabled={!isOwner}
          onChange={(e) => setForm((f) => ({ ...f, businessNumber: e.target.value }))} />
      </div>
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">전화</label>
        <input className={input} value={form.phone} disabled={!isOwner}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
      </div>
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">주소</label>
        <input className={input} value={form.address} disabled={!isOwner}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
      </div>
      {error && <p className="text-sm text-hud-accent-danger">{error}</p>}
      {success && <p className="text-sm text-hud-accent-success">저장되었습니다.</p>}
      {isOwner && (
        <Button variant="primary" type="submit" disabled={saving}>
          {saving ? '저장 중...' : '저장'}
        </Button>
      )}
    </form>
  )
}
```

- [ ] **Step 2: AccountSection**

`src/components/settings/AccountSection.tsx`:
```typescript
'use client'

import { useState, type FormEvent } from 'react'
import Button from '@/components/common/Button'
import { apiFetch } from '@/lib/api-client'
import { useAuth } from '@/auth/AuthContext'

const input = 'w-full px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'

export default function AccountSection() {
  const { me, refresh } = useAuth()
  const [name, setName] = useState(me?.agent.name ?? '')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!me) return null

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null); setSuccess(false); setSaving(true)
    try {
      await apiFetch(`/agents/${me.agent.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, phone: phone || null }),
      })
      setSuccess(true)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      <h2 className="text-lg font-semibold text-hud-text-primary">내 계정</h2>
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">이메일 (변경 불가)</label>
        <input className={input + ' opacity-60'} value={me.agent.email} disabled />
      </div>
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">이름</label>
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">전화</label>
        <input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      {error && <p className="text-sm text-hud-accent-danger">{error}</p>}
      {success && <p className="text-sm text-hud-accent-success">저장되었습니다.</p>}
      <Button variant="primary" type="submit" disabled={saving}>{saving ? '저장 중...' : '저장'}</Button>
    </form>
  )
}
```

- [ ] **Step 3: PasswordSection**

`src/components/settings/PasswordSection.tsx`:
```typescript
'use client'

import { useState, type FormEvent } from 'react'
import Button from '@/components/common/Button'
import { apiFetch } from '@/lib/api-client'

const input = 'w-full px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'

export default function PasswordSection() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null); setSuccess(false)
    if (next !== confirm) {
      setError('새 비밀번호 확인이 일치하지 않습니다')
      return
    }
    setSaving(true)
    try {
      await apiFetch('/auth/password', {
        method: 'PATCH',
        body: JSON.stringify({ current, next }),
      })
      setCurrent(''); setNext(''); setConfirm('')
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      <h2 className="text-lg font-semibold text-hud-text-primary">비밀번호 변경</h2>
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">현재 비밀번호</label>
        <input type="password" required className={input} value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">새 비밀번호 (8자 이상)</label>
        <input type="password" required minLength={8} className={input} value={next} onChange={(e) => setNext(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">새 비밀번호 확인</label>
        <input type="password" required minLength={8} className={input} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && <p className="text-sm text-hud-accent-danger">{error}</p>}
      {success && <p className="text-sm text-hud-accent-success">변경되었습니다.</p>}
      <Button variant="primary" type="submit" disabled={saving}>{saving ? '저장 중...' : '변경'}</Button>
    </form>
  )
}
```

- [ ] **Step 4: settings/page.tsx 갱신 — placeholder → 실제 컴포넌트**

`src/app/(app)/settings/page.tsx`의 `<div className="flex-1 p-6">` 블록을 다음으로 교체:
```typescript
<div className="flex-1 p-6">
  {current === 'agency' && <AgencySection />}
  {current === 'account' && <AccountSection />}
  {current === 'password' && <PasswordSection />}
  {current === 'agents' && <p className="text-hud-text-muted">중개사 관리 (Task 23에서 구현)</p>}
  {current === 'appearance' && <p className="text-hud-text-muted">외관 설정은 후속 작업에서 추가됩니다.</p>}
</div>
```

또한 파일 상단에 임포트 추가:
```typescript
import AgencySection from '@/components/settings/AgencySection'
import AccountSection from '@/components/settings/AccountSection'
import PasswordSection from '@/components/settings/PasswordSection'
```

- [ ] **Step 5: 빌드 검증**

```bash
npm run build
```
Expected: 통과

- [ ] **Step 6: 커밋**

```bash
git add src/components/settings/AgencySection.tsx \
        src/components/settings/AccountSection.tsx \
        src/components/settings/PasswordSection.tsx \
        src/app/\(app\)/settings/page.tsx
git commit -m "feat(ui): Settings — 사무소·계정·비밀번호 섹션"
```

### Task 23: Settings — Agents 섹션 (owner only)

**Files:**
- Create: `src/components/settings/AgentsSection.tsx`
- Modify: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: AgentsSection 작성**

`src/components/settings/AgentsSection.tsx`:
```typescript
'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Button from '@/components/common/Button'
import { apiFetch } from '@/lib/api-client'
import { useAuth } from '@/auth/AuthContext'

interface Agent {
  id: number
  email: string
  name: string
  phone: string | null
  role: 'owner' | 'member'
  status: 'active' | 'suspended'
  createdAt: string
}

const input = 'w-full px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'

export default function AgentsSection() {
  const { me } = useAuth()
  const isOwner = me?.agent.role === 'owner'
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' })
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = async () => {
    setLoading(true)
    try {
      const list = await apiFetch<Agent[]>('/agents')
      setAgents(list)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { reload() }, [])

  const onAdd = async (e: FormEvent) => {
    e.preventDefault()
    setError(null); setAdding(true)
    try {
      await apiFetch('/agents', { method: 'POST', body: JSON.stringify(form) })
      setForm({ name: '', email: '', password: '', phone: '' })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '추가 실패')
    } finally {
      setAdding(false)
    }
  }

  const toggleStatus = async (a: Agent) => {
    if (a.id === me?.agent.id) return
    try {
      await apiFetch(`/agents/${a.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: a.status === 'active' ? 'suspended' : 'active' }),
      })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 변경 실패')
    }
  }

  if (!isOwner) {
    return <p className="text-hud-accent-warning text-sm">owner만 접근할 수 있습니다.</p>
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-lg font-semibold text-hud-text-primary">중개사 관리</h2>

      <form onSubmit={onAdd} className="hud-card rounded-lg p-4 grid grid-cols-2 gap-3">
        <div className="col-span-2 text-sm font-semibold text-hud-text-secondary">새 중개사 추가</div>
        <input className={input} placeholder="이름 *" required value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <input className={input} placeholder="이메일 *" type="email" required value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        <input className={input} placeholder="비밀번호 (8자 이상) *" type="password" required minLength={8} value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
        <input className={input} placeholder="전화 (선택)" value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        {error && <p className="col-span-2 text-sm text-hud-accent-danger">{error}</p>}
        <div className="col-span-2">
          <Button variant="primary" type="submit" disabled={adding}>
            {adding ? '추가 중...' : '추가'}
          </Button>
        </div>
      </form>

      {loading ? (
        <p className="text-hud-text-muted text-sm">불러오는 중...</p>
      ) : (
        <table className="w-full text-sm hud-card rounded-lg overflow-hidden">
          <thead className="bg-hud-bg-secondary border-b border-hud-border-secondary text-left text-hud-text-secondary">
            <tr>
              <th className="px-4 py-2 font-medium">이름</th>
              <th className="px-4 py-2 font-medium">이메일</th>
              <th className="px-4 py-2 font-medium">역할</th>
              <th className="px-4 py-2 font-medium">상태</th>
              <th className="px-4 py-2 font-medium w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hud-border-secondary">
            {agents.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2">{a.name}</td>
                <td className="px-4 py-2 text-hud-text-secondary">{a.email}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${a.role === 'owner'
                    ? 'bg-hud-accent-primary/20 text-hud-accent-primary'
                    : 'bg-hud-bg-secondary text-hud-text-secondary'}`}>
                    {a.role}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${a.status === 'active'
                    ? 'bg-hud-accent-success/20 text-hud-accent-success'
                    : 'bg-hud-accent-warning/20 text-hud-accent-warning'}`}>
                    {a.status === 'active' ? '활성' : '비활성'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  {a.id !== me?.agent.id && (
                    <button onClick={() => toggleStatus(a)} className="text-xs text-hud-accent-primary hover:underline">
                      {a.status === 'active' ? '비활성화' : '활성화'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

- [ ] **Step 2: settings/page.tsx 갱신**

`src/app/(app)/settings/page.tsx`에서:
1. 상단 임포트에 추가: `import AgentsSection from '@/components/settings/AgentsSection'`
2. `{current === 'agents' && <p ...>중개사 관리 (Task 23에서 구현)</p>}` 라인을 `{current === 'agents' && <AgentsSection />}` 로 교체

- [ ] **Step 3: 빌드 검증**

```bash
npm run build
```
Expected: 통과

- [ ] **Step 4: 커밋**

```bash
git add src/components/settings/AgentsSection.tsx src/app/\(app\)/settings/page.tsx
git commit -m "feat(ui): Settings — 중개사 관리 섹션 (owner only)"
```

### Task 24: Phase 2 통합 검증

**Files:** 없음 — 검증만

- [ ] **Step 1: 모든 테스트 실행**

```bash
npm test 2>&1 | tail -20
```
Expected: 모든 테스트 통과. 누적: health(1) + lib-password(2) + lib-session(3) + auth-signup(3) + auth-login(3) + auth-logout-me(3) + auth-password(3) + agency(3) + agents(10) + tenancy(2) = **33 passed**.

- [ ] **Step 2: 빌드**

```bash
npm run build 2>&1 | tail -10
```
Expected: 통과

- [ ] **Step 3: dev 서버 라운드트립 (수동)**

```bash
npm run dev &
DEV_PID=$!
sleep 5
echo "--- signup ---"
curl -s -c /tmp/le-c.txt -X POST http://localhost:3000/api/auth/signup \
  -H 'content-type: application/json' \
  -d '{"agency":{"name":"통합테스트사무소"},"owner":{"name":"홍길동","email":"verify@example.com","password":"pw12345678"}}' | head -c 300
echo
echo "--- me ---"
curl -s -b /tmp/le-c.txt http://localhost:3000/api/auth/me
echo
echo "--- agents ---"
curl -s -b /tmp/le-c.txt http://localhost:3000/api/agents
echo
echo "--- agency PATCH ---"
curl -s -b /tmp/le-c.txt -X PATCH http://localhost:3000/api/agency \
  -H 'content-type: application/json' \
  -d '{"phone":"02-1234-5678","address":"서울 강남"}'
echo
echo "--- logout ---"
curl -s -b /tmp/le-c.txt -X POST http://localhost:3000/api/auth/logout
echo
kill $DEV_PID
```
Expected:
- signup 200 + cookie
- me 200 + agent/agency
- agents 200 + array(1)
- agency PATCH 200
- logout `{"ok":true}`

- [ ] **Step 4: 페이지 라우팅 확인 (HTTP 코드만)**

```bash
npm run dev &
DEV_PID=$!
sleep 5
for path in / /login /signup /settings; do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000$path)
  echo "$path → $code"
done
kill $DEV_PID
```
Expected:
- `/` → 200 (RequireAuth로 가드되어도 page 자체는 렌더, useEffect로 client redirect)
- `/login` → 200
- `/signup` → 200
- `/settings` → 200

- [ ] **Step 5: 최종 보고**

Phase 2 완료. 다음 단계: 브라우저 시각 검증 → 사용자 승인 → Phase 3 (Naver Explore) 플랜 작성.

---

## Notes

- **세션 쿠키 secure 플래그**: 개발 환경(`NODE_ENV !== 'production'`)에서는 `secure: false` — `http://localhost:3000`에서도 동작. 프로덕션 배포 시 HTTPS 필수.
- **CSRF**: SameSite=Lax + 동일 출처 정책으로 기본 보호. 다른 도메인에서 폼 POST하는 공격은 차단됨. 명시적 CSRF 토큰은 Phase 3+에서 도입 고려.
- **member의 사무소 정보 조회**: 본 플랜에서는 `/api/agency` GET 라우트를 만들지 않았음. me 응답의 `agency.name`만 보임. 필요 시 후속 phase에서 GET 추가.
- **Settings의 Agency section 초기 로드**: 현재 me에서 `name`만 보이고 businessNumber/phone/address는 비어 있음. 첫 PATCH 응답으로 채워짐. UX 개선 원하면 별도 GET `/api/agency`를 추가하는 것이 자연스러움 (현재는 YAGNI 차원에서 생략).
- **Appearance 섹션**: 다크/라이트 토글, 폰트 크기, 액센트 컬러 등은 Phase 2 외 후속 작업에서. Phase 2에서는 placeholder만.
- **dev 서버 포트**: 3000. Phase 1에서 정함.

## Out of Scope (Phase 3 이후)

- 네이버 API 프록시·세션 캐시·탐색 페이지 — Phase 3
- 내부 매물 CRUD·사진·계약서 — Phase 4
- 엑셀 다운로드·평형별 평균가 차트 — Phase 5
- Appearance 섹션 본격 구현 (HUD 테마 토글 등)
- CSRF 토큰 시스템
- 비밀번호 재설정 (이메일 발송)
- 2FA
- 감사 로그
