# REMS

부동산 중개사용 멀티테넌트 매물·고객 관리 SaaS.

## 구조

- `web/` — Vite + React SPA
- `api/` — Express + Prisma API 서버
- `packages/shared/` — web·api 공유 zod 스키마·타입

## 개발

사전 준비: Node.js 20+, Docker.

```
docker compose up -d              # MariaDB (localhost:3306)
npm install
npm run prisma:migrate -w api     # DB 마이그레이션 (최초 1회 / 스키마 변경 시)
npm run dev                       # web :5173, api :3000
npm run test                      # api 테스트
```

설계 문서: `docs/superpowers/specs/2026-05-22-rems-v1-design.md`
