# Land Explorer — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** REMS v1 코드를 폐기하고 Land Explorer 새 프로젝트의 기반(Next.js + Postgres + Prisma + Tailwind/HUD 테마)을 구축한다. 인증·도메인 모델·페이지는 Phase 2 이후에서 다룬다.

**Architecture:** Next.js 15 App Router 단일 코드베이스. PostgreSQL 16 docker-compose. Prisma 5 ORM (Phase 1은 datasource·generator만, 모델은 Phase 2). Tailwind v3 + REMS의 HUD 테마(CSS 변수 + Tailwind 확장) 그대로 차용. 재활용 자산: `KakaoMap.tsx`, HUD 토큰 CSS, Tailwind 확장.

**Tech Stack:** Next.js 15, TypeScript 5, Node 20 LTS, PostgreSQL 16, Prisma 5, Tailwind CSS 3.4, Vitest 1.x, Docker Compose v2

**Working directory:** `/Volumes/MacExtend 1/REMS` (현재 repo 루트, REMS v1을 신규 프로젝트로 대체)

---

## File Structure

```
/Volumes/MacExtend 1/REMS/
├── docs/                                  # 보존 (REMS v1 plans + 새 spec/plan)
│   └── superpowers/
│       ├── specs/2026-06-03-land-explorer-design.md
│       └── plans/2026-06-03-land-explorer-01-foundation.md  (이 파일)
├── .gitignore                             # 갱신
├── README.md                              # 갱신
├── package.json                           # 신규 (Next.js)
├── package-lock.json                      # 신규
├── tsconfig.json                          # 신규 (Next.js)
├── next.config.ts                         # 신규
├── tailwind.config.ts                     # 신규 (HUD 토큰 포함)
├── postcss.config.mjs                     # 신규
├── vitest.config.ts                       # 신규
├── docker-compose.yml                     # 신규 (Postgres)
├── .env.example                           # 신규
├── prisma/
│   └── schema.prisma                      # 신규 (datasource + generator만)
├── public/
│   └── (favicon, 기타 정적 자산)
├── src/
│   ├── app/
│   │   ├── layout.tsx                     # 루트 레이아웃 (HUD 테마 적용)
│   │   ├── page.tsx                       # 홈 placeholder
│   │   ├── globals.css                    # HUD CSS 변수 + Tailwind 디렉티브
│   │   └── api/
│   │       └── health/
│   │           └── route.ts               # GET /api/health
│   ├── components/
│   │   └── KakaoMap.tsx                   # REMS에서 차용 (slate-100 → hud-bg-secondary 이미 적용됨)
│   └── lib/
│       └── (Phase 2부터)
└── tests/
    └── health.test.ts                     # 첫 통합 테스트
```

**제거 대상 (Task 3에서):**
- `api/` (전체)
- `web/` (전체)
- `packages/` (전체)
- 기존 root `package.json`, `package-lock.json`, `node_modules/`, `docker-compose.yml` (MariaDB)

**보존:**
- `docs/` (REMS v1 plans/specs도 포함; 폐기 기록으로 가치)
- `.git/`

---

## Tasks

### Task 1: REMS v1 보존 (tag + branch + push)

**Files:** (없음 — git 상태만 변경)

- [ ] **Step 1: 현재 상태 확인**

```bash
cd "/Volumes/MacExtend 1/REMS"
git status
git log --oneline -1
```
Expected: working tree clean, HEAD가 최신 main 커밋

- [ ] **Step 2: REMS v1 보존 태그 생성**

```bash
git tag -a rems-v1-final -m "REMS v1 final state before Land Explorer pivot"
```

- [ ] **Step 3: 보존 브랜치 생성**

```bash
git branch legacy/rems-v1
```

- [ ] **Step 4: 태그 + 브랜치 원격 푸시**

```bash
git push origin rems-v1-final
git push origin legacy/rems-v1
```
Expected: 두 ref 모두 푸시 완료

- [ ] **Step 5: 검증**

```bash
git tag -l rems-v1-final
git branch -a | grep rems-v1
```
Expected: 태그 1개, 로컬·원격 브랜치 표시

### Task 2: 재활용 자산 임시 보존

**Files:**
- Create: `_carryover/KakaoMap.tsx`
- Create: `_carryover/hud-tokens.css`
- Create: `_carryover/tailwind-hud-extension.txt`

> `_carryover/`는 Task 3 직후 Task 5·6에서 새 위치로 옮기고 삭제할 임시 폴더.

- [ ] **Step 1: 임시 폴더 생성**

```bash
mkdir -p _carryover
```

- [ ] **Step 2: KakaoMap.tsx + 타입 선언 복사**

```bash
cp web/src/components/KakaoMap.tsx _carryover/KakaoMap.tsx
cp web/src/kakao.d.ts _carryover/kakao.d.ts
```

- [ ] **Step 3: HUD CSS 토큰 부분만 추출**

```bash
# globals.css용 — 전체 web/src/index.css를 통째로 복사 (HUD 변수 포함)
cp web/src/index.css _carryover/hud-tokens.css
```

- [ ] **Step 4: Tailwind 확장 부분 추출**

```bash
cp web/tailwind.config.js _carryover/tailwind-hud-extension.txt
```

- [ ] **Step 5: 검증**

```bash
ls -la _carryover/
wc -l _carryover/*
```
Expected: 4개 파일, 라인 수 (`KakaoMap.tsx` ≈93, `kakao.d.ts` ≈8, `hud-tokens.css` ≈342, `tailwind-hud-extension.txt` ≈100)

### Task 3: 기존 dev 프로세스 종료 + REMS 파일 제거

**Files:**
- Delete: `api/`, `web/`, `packages/`, `node_modules/`
- Delete: `package.json`, `package-lock.json`, `docker-compose.yml`, `.DS_Store`

- [ ] **Step 1: 실행 중인 dev 서버 식별**

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN 2>/dev/null
lsof -nP -iTCP:5173 -sTCP:LISTEN 2>/dev/null
lsof -nP -iTCP:3306 -sTCP:LISTEN 2>/dev/null
```
Expected: 떠있는 프로세스 PID 목록 (없으면 빈 줄)

- [ ] **Step 2: dev 서버 종료**

```bash
# 위 PID들을 kill (예시; 실제 PID로 교체)
# kill <web-pid> <api-pid>
docker compose down 2>/dev/null || true
```

- [ ] **Step 3: REMS 디렉토리 삭제**

```bash
cd "/Volumes/MacExtend 1/REMS"
rm -rf api web packages node_modules
```

- [ ] **Step 4: REMS 루트 파일 삭제 (.gitignore·README.md 포함 — Task 4의 create-next-app이 새로 생성하므로)**

```bash
rm -f package.json package-lock.json docker-compose.yml .DS_Store .gitignore README.md
```

- [ ] **Step 5: 검증**

```bash
ls -a | grep -vE '^(\.\.?|\.git|docs|_carryover)$'
```
Expected: 출력 없음 (`.git`, `docs/`, `_carryover/` 3개만 남음)

- [ ] **Step 6: git status 확인**

```bash
git status --short | head -30
```
Expected: 대량 D (삭제) 표시

### Task 4: Next.js 15 scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `public/` (예: favicon)
- Create: `.gitignore` (갱신)

- [ ] **Step 1: create-next-app 실행 (현재 디렉토리에)**

```bash
cd "/Volumes/MacExtend 1/REMS"
npx --yes create-next-app@15 . \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-eslint \
  --use-npm
```
Expected: scaffold 완료 메시지. `_carryover/`와 `docs/`는 보존된 채 표준 Next.js 파일 생성. (Task 3에서 충돌 파일을 모두 지웠으므로 프롬프트 없음.) `--turbopack`은 의도적으로 미지정 — Next 15 기본 webpack 사용.

- [ ] **Step 2: 생성된 파일 확인**

```bash
ls -la src/app/
ls -la public/
cat package.json | head -25
```
Expected: `layout.tsx`, `page.tsx`, `globals.css` 존재. `package.json`에 `next`, `react`, `tailwindcss` 의존성 보임.

- [ ] **Step 3: 첫 빌드로 정상 동작 검증**

```bash
npm run build
```
Expected: `Compiled successfully` + `Generating static pages` 출력

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "feat: Next.js 15 scaffold (App Router, TS, Tailwind, src/)

REMS v1을 폐기하고 Land Explorer 신규 베이스로 교체.
이전 코드는 tag rems-v1-final, branch legacy/rems-v1에 보존."
```

### Task 5: HUD 테마 복원 (Tailwind v4 @theme)

**Files:**
- Modify: `src/app/globals.css`

> **Tailwind v4 주의**: Task 4가 가져온 Next.js 15 scaffold는 Tailwind v4 (config-less 방식)를 사용한다. 별도 `tailwind.config.ts` 파일 없음. 모든 디자인 토큰은 `globals.css`의 `@theme` 블록에서 등록한다. 토큰 이름 `--color-hud-bg-primary`는 자동으로 `bg-hud-bg-primary` 유틸 클래스로 노출된다.

- [ ] **Step 1: globals.css 전체 교체**

`src/app/globals.css`:
```css
@import "tailwindcss";

/* HUD 다크 테마 디자인 토큰 — Tailwind v4 @theme로 등록 */
@theme {
  /* 배경 */
  --color-hud-bg-primary: #0a0e1a;
  --color-hud-bg-secondary: #111827;
  --color-hud-bg-card: #1f2937;
  --color-hud-bg-hover: #1e293b;

  /* 텍스트 */
  --color-hud-text-primary: #f1f5f9;
  --color-hud-text-secondary: #cbd5e1;
  --color-hud-text-muted: #64748b;

  /* 보더 */
  --color-hud-border-primary: #1e293b;
  --color-hud-border-secondary: #334155;

  /* 액센트 */
  --color-hud-accent-primary: #06b6d4;
  --color-hud-accent-secondary: #a78bfa;
  --color-hud-accent-info: #3b82f6;
  --color-hud-accent-warning: #f59e0b;
  --color-hud-accent-success: #10b981;
  --color-hud-accent-danger: #ef4444;
  --color-hud-on-accent: #0a0e1a;

  /* 폰트 */
  --font-sans: Inter, Roboto, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", monospace;

  /* 그림자 */
  --shadow-hud: 0 4px 12px rgba(0,0,0,0.4);
  --shadow-hud-glow: 0 0 20px rgba(6,182,212,0.4);

  /* 애니메이션 */
  --animate-pulse-glow: pulse-glow 2s ease-in-out infinite;
  --animate-fade-in: fadeIn 0.3s ease-out;
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(6,182,212,0.3); }
  50% { box-shadow: 0 0 40px rgba(6,182,212,0.5); }
}
@keyframes fadeIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

/* 기본 body — HUD 다크 */
body {
  background-color: var(--color-hud-bg-primary);
  color: var(--color-hud-text-primary);
  font-family: var(--font-sans);
}

/* HUD 카드 컴포넌트 클래스 (REMS 차용) */
.hud-card {
  background-color: var(--color-hud-bg-card);
  border: 1px solid var(--color-hud-border-secondary);
}
.hud-card-bottom {
  border-bottom: 2px solid var(--color-hud-accent-primary);
}

/* 트랜지션 */
.transition-hud {
  transition: all 0.2s ease-out;
}

/* 버튼 글로우 */
.btn-glow {
  box-shadow: var(--shadow-hud-glow);
}
```

> **이름 규칙 확정**: 모든 HUD 토큰은 kebab-case (예: `--color-hud-on-accent` → `text-hud-on-accent`). REMS의 `onAccent` camelCase는 폐기. Phase 2 이후 UI에서 `text-hud-on-accent`로 사용.

- [ ] **Step 2: 빌드 검증**

```bash
npm run build
```
Expected: `Compiled successfully`. 다크 배경(`#0a0e1a`)이 적용되었는지 확인하려면 dev 서버로:

```bash
npm run dev &
sleep 4
curl -s http://localhost:3000/ -o /dev/null -w "HTTP %{http_code}\n"
kill %1
```
Expected: `HTTP 200`. (시각 검증은 사용자 브라우저 단계에서.)

- [ ] **Step 3: 커밋**

```bash
git add src/app/globals.css
git commit -m "feat: HUD 테마 토큰 (Tailwind v4 @theme) 복원 — REMS v1 차용"
```

### Task 6: KakaoMap 컴포넌트 복원

**Files:**
- Create: `src/components/KakaoMap.tsx`
- Create: `src/types/kakao.d.ts`

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p src/components src/types
```

- [ ] **Step 2: 파일 이동 (KakaoMap + 타입 선언)**

```bash
cp _carryover/KakaoMap.tsx src/components/KakaoMap.tsx
cp _carryover/kakao.d.ts src/types/kakao.d.ts
```

- [ ] **Step 3: 환경변수 이름 통일 — Vite의 `VITE_*`를 Next의 `NEXT_PUBLIC_*`로 교체**

`src/components/KakaoMap.tsx`에서 `import.meta.env.VITE_KAKAO_MAP_KEY`를 `process.env.NEXT_PUBLIC_KAKAO_MAP_KEY`로 치환:

```bash
sed -i.bak 's|import\.meta\.env\.VITE_KAKAO_MAP_KEY|process.env.NEXT_PUBLIC_KAKAO_MAP_KEY|g' src/components/KakaoMap.tsx
rm src/components/KakaoMap.tsx.bak
```

또한 `'use client'` 지시문이 필요 (useEffect/useRef 사용 — Next.js App Router 서버 컴포넌트 기본). 파일 맨 첫 줄에 추가:
```typescript
'use client'
```

- [ ] **Step 4: tsconfig가 `src/types/*.d.ts`를 포함하는지 확인**

Next.js 기본 `tsconfig.json`은 `"include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]` — `src/types/kakao.d.ts`도 `**/*.ts`에 매치되어 포함됨. 별도 수정 불필요.

- [ ] **Step 5: 빌드 검증**

```bash
npm run build
```
Expected: 통과. 카카오맵 미사용으로 자동 tree-shake되어 size 영향 없음.

- [ ] **Step 6: 커밋**

```bash
git add src/components/KakaoMap.tsx src/types/kakao.d.ts
git commit -m "feat: KakaoMap 컴포넌트 + 타입 선언 복원 (REMS v1 차용, Vite→Next 환경변수 마이그)"
```

### Task 7: Postgres docker-compose

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.env` (gitignore에 의해 제외)
- Modify: `.gitignore`

- [ ] **Step 1: .gitignore에 `.env` 추가**

`.gitignore`에 다음 라인 추가 (이미 있으면 스킵):
```
.env
.env*.local
```

- [ ] **Step 2: docker-compose.yml 작성**

`docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:16
    container_name: land-explorer-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: land_explorer
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
    ports:
      - "5432:5432"
    volumes:
      - land-explorer-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d land_explorer"]
      interval: 5s
      timeout: 5s
      retries: 30

volumes:
  land-explorer-data:
```

- [ ] **Step 3: .env.example 작성**

`.env.example`:
```
DATABASE_URL="postgresql://app:app@localhost:5432/land_explorer?schema=public"
NEXT_PUBLIC_KAKAO_MAP_KEY=
```

- [ ] **Step 4: .env 작성 (로컬 개발용)**

`.env`:
```
DATABASE_URL="postgresql://app:app@localhost:5432/land_explorer?schema=public"
```

- [ ] **Step 5: db 컨테이너 기동**

```bash
docker compose up -d
```
Expected: `Created` 메시지, healthcheck 통과까지 5-10초

- [ ] **Step 6: 연결 검증**

```bash
sleep 5
docker compose exec -T db pg_isready -U app -d land_explorer
```
Expected: `accepting connections`

- [ ] **Step 7: 커밋**

```bash
git add docker-compose.yml .env.example .gitignore
git commit -m "feat: Postgres 16 docker-compose + env 템플릿"
```

### Task 8: Prisma 5 설치 + 기본 스키마

**Files:**
- Create: `prisma/schema.prisma`
- Modify: `package.json` (의존성 추가)

- [ ] **Step 1: Prisma 설치**

```bash
npm install -D prisma@^5
npm install @prisma/client@^5
```

- [ ] **Step 2: Prisma 초기화 (디렉토리 + 스키마 골격)**

```bash
npx prisma init --datasource-provider postgresql
```
Expected: `prisma/schema.prisma`, `.env`(이미 존재 → 스킵 또는 합쳐짐) 생성

- [ ] **Step 3: schema.prisma 정리**

`prisma/schema.prisma` 전체 교체:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 모델은 Phase 2 (Auth & Multi-tenancy)에서 정의한다.
// Phase 1은 datasource 연결과 generate 동작 검증까지.
```

- [ ] **Step 4: prisma generate 검증**

```bash
npx prisma generate
```
Expected: `Generated Prisma Client (vX.Y.Z) to ./node_modules/...`

- [ ] **Step 5: 빈 마이그레이션으로 DB 연결 확인**

```bash
npx prisma db push --skip-generate
```
Expected: `Your database is now in sync with your Prisma schema`

- [ ] **Step 6: src/lib/db.ts — Prisma 싱글톤**

`src/lib/db.ts`:
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

- [ ] **Step 7: 디렉토리 생성 + 커밋**

`src/lib/db.ts` 파일을 Step 6 코드 블록 내용으로 생성한 뒤:
```bash
mkdir -p src/lib
# Step 6의 코드 블록을 src/lib/db.ts에 저장
git status --short    # node_modules는 .gitignore 적용 확인
git add prisma package.json package-lock.json src/lib/db.ts
git commit -m "feat: Prisma 5 + Postgres datasource + 싱글톤 client"
```
Expected: `node_modules/` 변경은 무시됨. prisma/, package*, src/lib/db.ts만 커밋됨.

### Task 9: Vitest + Health API + 첫 통합 테스트

**Files:**
- Create: `vitest.config.ts`
- Create: `src/app/api/health/route.ts`
- Create: `tests/health.test.ts`
- Modify: `package.json` scripts

- [ ] **Step 1: Vitest + 의존성 설치**

```bash
npm install -D vitest@^1 @vitest/coverage-v8@^1 happy-dom@^15
```

- [ ] **Step 2: vitest.config.ts 작성**

`vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 3: package.json scripts 갱신**

`package.json`의 `scripts` 섹션에 추가:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: 실패 테스트 먼저 작성**

`tests/health.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/health/route'

describe('GET /api/health', () => {
  it('200 OK with status field', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ status: 'ok' })
  })
})
```

- [ ] **Step 5: 테스트 실행하여 실패 확인**

```bash
npm test
```
Expected: FAIL — `Cannot find module '@/app/api/health/route'`

- [ ] **Step 6: health route 구현**

`src/app/api/health/route.ts`:
```typescript
import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({ status: 'ok' })
}
```

- [ ] **Step 7: 테스트 통과 확인**

```bash
npm test
```
Expected: `1 passed`

- [ ] **Step 8: dev 서버로 수동 검증**

```bash
npm run dev &
sleep 4
curl -s http://localhost:3000/api/health
kill %1
```
Expected: `{"status":"ok"}`

- [ ] **Step 9: 커밋**

```bash
git add vitest.config.ts package.json package-lock.json src/app/api/health/route.ts tests/health.test.ts
git commit -m "feat: Vitest + GET /api/health + 첫 통합 테스트"
```

### Task 10: 기본 레이아웃 + 홈 페이지 placeholder

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: layout.tsx 갱신 (HUD body 클래스 + 메타데이터)**

`src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Land Explorer',
  description: '네이버 부동산 탐색 + 내부 매물 관리',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="bg-hud-bg-primary text-hud-text-primary min-h-screen">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: page.tsx 갱신 (홈 placeholder)**

`src/app/page.tsx`:
```tsx
export default function Home() {
  return (
    <main className="p-12 max-w-3xl mx-auto">
      <h1 className="text-4xl font-bold text-hud-accent-primary mb-4">
        Land Explorer
      </h1>
      <p className="text-hud-text-secondary mb-8">
        Phase 1 (Foundation) 셋업 완료. Phase 2부터 인증·도메인 모델이 추가됩니다.
      </p>
      <div className="hud-card hud-card-bottom rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-2">상태</h2>
        <ul className="text-sm text-hud-text-secondary space-y-1">
          <li>✓ Next.js 15 App Router</li>
          <li>✓ Tailwind + HUD 테마</li>
          <li>✓ Postgres 16 (Docker)</li>
          <li>✓ Prisma 5</li>
          <li>✓ Vitest</li>
        </ul>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: dev 서버 수동 검증**

```bash
npm run dev &
sleep 4
curl -s http://localhost:3000/ | grep -oE 'Land Explorer' | head -1
kill %1
```
Expected: `Land Explorer`

- [ ] **Step 4: 빌드 검증**

```bash
npm run build
```
Expected: `Compiled successfully`

- [ ] **Step 5: 커밋**

```bash
git add src/app/layout.tsx src/app/page.tsx
git commit -m "feat: 루트 레이아웃 + 홈 placeholder (HUD 테마 적용)"
```

### Task 11: README 갱신 + _carryover 정리

**Files:**
- Modify: `README.md`
- Delete: `_carryover/`

- [ ] **Step 1: README.md 전체 교체**

`README.md`:
```markdown
# Land Explorer

네이버 부동산 인터랙티브 탐색 + 사무소 내부 매물 관리.

## 기술 스택

- Next.js 15 (App Router) + TypeScript
- PostgreSQL 16 + Prisma 5
- Tailwind CSS 3 + HUD 테마
- Vitest

## 개발 환경 설정

```bash
# 1. DB 컨테이너 기동
docker compose up -d

# 2. 의존성 설치
npm install

# 3. .env 확인 (없으면 .env.example 복사)
cp .env.example .env

# 4. Prisma 동기화 (Phase 1은 스키마 없음 → no-op)
npx prisma db push

# 5. dev 서버
npm run dev
```

## 스크립트

| 명령 | 동작 |
|---|---|
| `npm run dev` | 개발 서버 (포트 3000) |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버 |
| `npm test` | Vitest |
| `npm run test:watch` | Vitest watch 모드 |

## 디자인 문서

- 전체 설계: [docs/superpowers/specs/2026-06-03-land-explorer-design.md](docs/superpowers/specs/2026-06-03-land-explorer-design.md)
- Phase 1 플랜: [docs/superpowers/plans/2026-06-03-land-explorer-01-foundation.md](docs/superpowers/plans/2026-06-03-land-explorer-01-foundation.md)

## 이전 버전

REMS v1은 폐기되었으나 history는 보존되어 있다:
- Git tag: `rems-v1-final`
- Git branch: `legacy/rems-v1`
```

- [ ] **Step 2: _carryover 정리**

```bash
rm -rf _carryover/
```

- [ ] **Step 3: 최종 ls로 확인**

```bash
ls -la
```
Expected: `_carryover/` 없음; `docs/`, `prisma/`, `public/`, `src/`, `tests/`, `package.json`, `tailwind.config.ts` 등 표준 Next 구조

- [ ] **Step 4: 커밋 + 푸시**

```bash
# _carryover는 git에 add된 적 없으므로 git rm 불필요. filesystem 삭제는 Step 2에서 완료.
git add README.md
git status --short    # _carryover 잔여 없어야 함
git commit -m "docs: README 갱신 + 임시 carryover 정리"
git push origin main
```

### Task 12: Phase 1 통합 검증

**Files:** (없음 — 검증만)

- [ ] **Step 1: 빌드 + 테스트 + 컨테이너 상태 통합 점검**

```bash
docker compose ps
npm run build
npm test
```
Expected:
- `db` 컨테이너 `Up (healthy)`
- 빌드 통과 (`Compiled successfully`)
- 테스트 `1 passed`

- [ ] **Step 2: dev 서버 풀 라운드트립**

```bash
npm run dev &
DEV_PID=$!
sleep 5
echo "--- health ---"
curl -s http://localhost:3000/api/health
echo
echo "--- home ---"
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/
kill $DEV_PID
```
Expected:
- `{"status":"ok"}`
- `HTTP 200`

- [ ] **Step 3: Phase 2 진입 준비 확인**

```bash
git log --oneline | head -15
git status
```
Expected:
- Phase 1 task 11개 분량 커밋 보임
- working tree clean

- [ ] **Step 4: 완료 보고**

Phase 1 완료. 다음 단계:
- 사용자 검증 (브라우저로 http://localhost:3000/ 확인)
- Phase 2 (Auth & Multi-tenancy) 플랜 작성으로 진행

---

## Notes

- **Node 버전**: Node 20 LTS 가정. `node --version`이 20.x 미만이면 nvm/asdf로 업그레이드 필요.
- **Docker compose 명령**: `docker compose` (v2 플러그인). `docker-compose`(v1)는 macOS에서 점차 사라지는 추세 — v2 사용 가정.
- **포트 충돌**: 3000(Next), 5432(Postgres). 이전 dev 서버가 남아있다면 Task 3에서 종료.
- **Kakao Map key**: Phase 1은 KakaoMap 컴포넌트 가져오지만 화면에서 사용 안 함 → `NEXT_PUBLIC_KAKAO_MAP_KEY` 미설정 OK. Phase 3 (Naver Explore)에서 필요.
- **Tailwind v4**: Task 4의 `create-next-app@15`이 기본으로 Tailwind v4를 가져옴. config-less, `@theme` directive 방식. 별도 `tailwind.config.ts` 파일 없음 — 모든 토큰은 `globals.css` `@theme` 블록에 등록.

## Out of Scope (Phase 2 이후)

- 인증 (signup/login/me/password) — Phase 2
- Agency/Agent/Session 모델 — Phase 2
- 사이드바·탑바 본격 구현 — Phase 2
- 모든 도메인 페이지 (`/explore`, `/listings`, `/settings`) — Phase 2–5
- 네이버 API 프록시 — Phase 3
