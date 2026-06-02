# Land Explorer

네이버 부동산 인터랙티브 탐색 + 사무소 내부 매물 관리.

## 기술 스택

- Next.js 15 (App Router) + TypeScript
- PostgreSQL 16 + Prisma 5
- Tailwind CSS 4 + HUD 테마
- Vitest

## 개발 환경 설정

```bash
# 1. DB 컨테이너 기동
docker compose up -d

# 2. 의존성 설치
npm install

# 3. .env 확인 (없으면 .env.example 복사)
cp .env.example .env

# 4. Prisma 동기화
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
