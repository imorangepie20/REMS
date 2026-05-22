# REMS v1 — 설계 문서

- **작성일**: 2026-05-22
- **상태**: 승인됨 (brainstorming 완료, 구현 계획 대기)
- **범위**: REMS v1 (첫 동작 버전)

---

## 1. 개요

REMS(Real Estate Management System)는 부동산 중개사가 매물과 고객을 관리하는 멀티테넌트 SaaS 웹 애플리케이션이다. 여러 중개사무소가 각자 가입해 사용하며, 한 사무소는 소속 중개사·직원 여러 명이 함께 쓴다.

v1의 목표는 **핵심 관리 앱**을 동작 가능한 상태로 완성하는 것이다: 멀티테넌트 인증, 매물 CRUD, 고객 CRM, 고객↔매물 매칭, 카카오맵 표시. v1에서 데이터는 모두 수동 입력한다.

---

## 2. 배경 및 범위 결정

- 이전에 로컬 LLM(qwen3-14b)으로 생성한 설계 문서가 있었으나 환각·실행 불가 코드가 많아 폐기했다.
- 두 달 전 거의 완성된 별도 버전이 있었으나 사정상 폐기됐다. 네이버 매물·지도·공공데이터 연동 경험은 보유하고 있다.
- v1은 의도적으로 **데이터 수집 기능을 제외**한다. 적재할 매물 스키마와 관리 UI가 먼저 존재해야 수집이 의미를 갖기 때문이다.

### v1 포함 범위
- 멀티테넌트 인증 — 사무소 가입, 로그인, 세션
- 중개사(멤버) 관리
- 매물 CRUD + 사진
- 고객 CRM CRUD
- 고객↔매물 매칭
- 카카오맵 매물 위치 표시
- 대시보드 요약

### v1 제외 범위 (v2 이후)
- Python 수집 워커 — 네이버 매물, 공공데이터 실거래가
- 좌표 공간 인덱스 + 반경 검색
- 실거래가 시세 비교 화면
- 구독 결제/과금
- 실시간 알림, audit log, 즐겨찾기

### 데이터 수집(네이버)에 대한 제약
v2에서 네이버 매물을 수집할 때는 다음 전제를 따른다. v1 설계에는 영향이 없으나 기록해 둔다.
- 수집 데이터를 고객·외부에 노출하거나 재배포하지 않는다 (법적 경계).
- HTML 스크래핑이 아니라 내부 JSON API를 사용한다.
- 수집 로직은 Python 워커 안의 교체 가능한 격리 모듈로 둔다.

---

## 3. 기술 스택

| 영역 | 선택 | 비고 |
|------|------|------|
| 프론트엔드 | Vite + React 18 + TypeScript + Tailwind | hud-admin-template 기반 |
| API 서버 | Node.js + TypeScript + Express + zod | |
| DB | MariaDB | |
| DB 접근 | Prisma | 마이그레이션 내장, 타입 안전 |
| 인증 | httpOnly 세션 쿠키 + bcrypt + DB 세션 테이블 | |
| 지도 | 카카오맵 JS SDK | JS 키는 도메인 제한 |
| 데이터 페칭 | TanStack Query | 캐싱·로딩·리페치 |
| 공유 검증 | zod 스키마 (`packages/shared`) | web·api 공유 |
| 테스트 | Vitest | web·api 공용 |

- 멀티테넌시: **공유 스키마 + row-level**. 모든 테넌트 테이블에 `agency_id`, 서비스 계층에서 강제 필터.
- 좌표는 v1에서 `latitude`/`longitude` DECIMAL로 저장한다. 공간 타입(POINT)·반경 검색은 v2.
- v1에는 Python 워커, Redis, Elasticsearch, Docker/K8s, WebSocket이 없다.

---

## 4. 아키텍처

```
web/   Vite React SPA  ──REST/JSON (httpOnly 쿠키)──▶  api/  Express
                                                          │
                                                       MariaDB

packages/shared : zod 스키마·타입 (web·api 공유)
```

- `web`은 클라이언트 전용 SPA. 내부 관리자 도구라 SSR이 필요 없다.
- `api`는 인증·테넌시·비즈니스 로직을 담당한다.
- 모든 인증 요청은 세션 쿠키 → `agent{id, agency_id, role}` 해석 → 쿼리를 `agency_id`로 강제 필터한다.

---

## 5. 데이터 모델

MariaDB. 모든 PK는 `BIGINT AUTO_INCREMENT`(`session`만 예외). 금액은 전부 `BIGINT`(원 단위). 시각은 `DATETIME`.

### 5.1 agency — 중개사무소 (테넌트 최상위)

| 컬럼 | 타입 | 제약 | 비고 |
|------|------|------|------|
| id | BIGINT | PK | |
| name | VARCHAR(255) | NOT NULL | 상호 |
| business_number | VARCHAR(20) | NULL | 사업자등록번호 |
| phone | VARCHAR(20) | NULL | |
| address | VARCHAR(255) | NULL | |
| created_at | DATETIME | NOT NULL | |

### 5.2 agent — 사용자 (중개사·직원)

| 컬럼 | 타입 | 제약 | 비고 |
|------|------|------|------|
| id | BIGINT | PK | |
| agency_id | BIGINT | NOT NULL, FK→agency | 테넌트 키 |
| email | VARCHAR(255) | NOT NULL, UNIQUE | 로그인 ID (전역 고유) |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt |
| name | VARCHAR(100) | NOT NULL | |
| phone | VARCHAR(20) | NULL | |
| role | ENUM('owner','member') | NOT NULL | 가입 시 첫 사용자가 owner |
| status | ENUM('active','inactive') | NOT NULL, DEFAULT 'active' | |
| created_at | DATETIME | NOT NULL | |

인덱스: `(agency_id)`

### 5.3 session — 로그인 세션

| 컬럼 | 타입 | 제약 | 비고 |
|------|------|------|------|
| id | VARCHAR(64) | PK | 랜덤 토큰, httpOnly 쿠키에 저장 |
| agent_id | BIGINT | NOT NULL, FK→agent | |
| expires_at | DATETIME | NOT NULL | |
| created_at | DATETIME | NOT NULL | |

인덱스: `(agent_id)`

### 5.4 listing — 매물 (사무소 공용)

| 컬럼 | 타입 | 제약 | 비고 |
|------|------|------|------|
| id | BIGINT | PK | |
| agency_id | BIGINT | NOT NULL, FK→agency | 테넌트 키 |
| created_by | BIGINT | NOT NULL, FK→agent | 등록자 (참고용) |
| source | ENUM('manual','naver','public_data') | NOT NULL, DEFAULT 'manual' | v1은 모두 manual |
| source_id | VARCHAR(100) | NULL | 외부 식별자, 중복 제거용 |
| title | VARCHAR(255) | NOT NULL | 단지/매물명 |
| deal_type | ENUM('sale','jeonse','wolse') | NOT NULL | 매매/전세/월세 |
| property_type | ENUM('apartment','officetel','house','commercial','land') | NOT NULL | |
| sale_price | BIGINT | NULL | 매매가 (원) |
| deposit | BIGINT | NULL | 보증금 (원) — 전세/월세 |
| monthly_rent | BIGINT | NULL | 월세액 (원) |
| area_m2 | DECIMAL(10,2) | NOT NULL | 전용면적 ㎡ |
| address | VARCHAR(255) | NOT NULL | 지번/도로명 주소 |
| address_detail | VARCHAR(255) | NULL | 동·호수 등 |
| latitude | DECIMAL(10,7) | NULL | |
| longitude | DECIMAL(10,7) | NULL | |
| floor | INT | NULL | 해당 층 |
| total_floors | INT | NULL | 총 층수 |
| rooms | INT | NULL | 방 수 |
| bathrooms | INT | NULL | 욕실 수 |
| built_year | INT | NULL | 준공연도 |
| status | ENUM('active','completed','hidden') | NOT NULL, DEFAULT 'active' | 거래중/거래완료/숨김 |
| description | TEXT | NULL | |
| created_at | DATETIME | NOT NULL | |
| updated_at | DATETIME | NOT NULL | |

- 제약: `UNIQUE(agency_id, source, source_id)` — `source_id`가 NULL인 manual 매물은 다중 NULL 허용이라 충돌하지 않는다.
- 인덱스: `(agency_id, status)`
- 금액 규칙: `deal_type='sale'`→`sale_price`, `'jeonse'`→`deposit`, `'wolse'`→`deposit`+`monthly_rent`. 검증은 API 계층(zod)에서 강제한다.

### 5.5 listing_photo — 매물 사진

| 컬럼 | 타입 | 제약 | 비고 |
|------|------|------|------|
| id | BIGINT | PK | |
| listing_id | BIGINT | NOT NULL, FK→listing | |
| url | VARCHAR(500) | NOT NULL | 서버 `uploads/` 경로 |
| sort_order | INT | NOT NULL, DEFAULT 0 | |
| created_at | DATETIME | NOT NULL | |

인덱스: `(listing_id)`

### 5.6 customer — 고객 (담당 중개사 개인 소속)

| 컬럼 | 타입 | 제약 | 비고 |
|------|------|------|------|
| id | BIGINT | PK | |
| agency_id | BIGINT | NOT NULL, FK→agency | 테넌트 키 |
| owner_agent_id | BIGINT | NOT NULL, FK→agent | 담당 중개사 |
| name | VARCHAR(100) | NOT NULL | |
| phone | VARCHAR(20) | NULL | |
| customer_type | ENUM('buyer','seller','tenant','landlord') | NOT NULL | 매수/매도/임차/임대 |
| budget_min | BIGINT | NULL | 원 |
| budget_max | BIGINT | NULL | 원 |
| desired_area | VARCHAR(255) | NULL | 희망 지역 |
| memo | TEXT | NULL | |
| created_at | DATETIME | NOT NULL | |
| updated_at | DATETIME | NOT NULL | |

인덱스: `(agency_id, owner_agent_id)`

### 5.7 customer_listing — 고객↔매물 매칭 (CRM 핵심)

| 컬럼 | 타입 | 제약 | 비고 |
|------|------|------|------|
| id | BIGINT | PK | |
| customer_id | BIGINT | NOT NULL, FK→customer | |
| listing_id | BIGINT | NOT NULL, FK→listing | |
| status | ENUM('suggested','interested','visited','contracted','rejected') | NOT NULL, DEFAULT 'suggested' | 추천/관심/임장/계약/보류 |
| memo | TEXT | NULL | |
| created_at | DATETIME | NOT NULL | |
| updated_at | DATETIME | NOT NULL | |

제약: `UNIQUE(customer_id, listing_id)`

### 5.8 핵심 결정

1. **테넌트 격리**: `listing`·`customer`에 `agency_id` 직결. `customer_listing`은 양쪽이 같은 사무소라 간접. 모든 쿼리를 세션의 `agency_id`로 강제 필터한다.
2. **금액은 전부 `BIGINT`(원)** — INT, 만원/억 혼용 금지.
3. 매물은 `agency_id`로 사무소 공용, 고객은 `owner_agent_id`로 개인 소속. `member`는 자기 고객만, `owner`는 사무소 전체 고객 조회 가능.
4. `source`/`source_id`는 v1에서 미사용이나, v2 수집 데이터가 마이그레이션 없이 들어오도록 미리 둔다.

---

## 6. API 설계

전부 `/api` 아래. httpOnly 세션 쿠키 인증. 모든 인증 요청은 세션 → `agent{id, agency_id, role}` 해석 후 쿼리를 `agency_id`로 강제 필터.

### 6.1 인증
- `POST /api/auth/signup` — 사무소 가입: `agency` + 첫 `agent`(owner) 생성, 세션 발급
- `POST /api/auth/login` — 이메일+비번 → 세션 쿠키
- `POST /api/auth/logout` — 세션 파기
- `GET /api/auth/me` — 현재 agent + agency 정보

### 6.2 중개사 관리 (owner만 멤버 추가/수정)
- `GET /api/agents` — 우리 사무소 중개사 목록
- `POST /api/agents` — owner가 멤버 계정 생성 (임시 비밀번호)
- `PATCH /api/agents/:id` — 본인 프로필 / owner는 멤버 수정·비활성화

### 6.3 매물 (사무소 공용 — 모든 멤버 접근)
- `GET /api/listings` — 목록: 필터(거래유형·매물종류·상태·가격·면적·키워드) + 페이지네이션
- `POST /api/listings` — 등록
- `GET /api/listings/:id` — 상세 (+사진)
- `PATCH /api/listings/:id` — 수정
- `DELETE /api/listings/:id` — 삭제
- `POST /api/listings/:id/photos` — 사진 업로드 (multipart → 서버 `uploads/`)
- `DELETE /api/listings/:id/photos/:photoId` — 사진 삭제

### 6.4 고객 (개인 소속 — member는 본인 고객만, owner는 사무소 전체)
- `GET /api/customers` — 목록: 필터 + 페이지네이션
- `POST /api/customers` — 등록
- `GET /api/customers/:id` — 상세
- `PATCH /api/customers/:id` — 수정
- `DELETE /api/customers/:id` — 삭제

### 6.5 고객↔매물 매칭
- `GET /api/customers/:id/listings` — 이 고객에 매칭된 매물 목록
- `POST /api/customers/:id/listings` — 매칭 추가 (listing_id, status, memo)
- `PATCH /api/customers/:id/listings/:matchId` — 매칭 상태·메모 수정
- `DELETE /api/customers/:id/listings/:matchId` — 매칭 해제

### 6.6 대시보드
- `GET /api/dashboard/summary` — 거래중 매물 수, 내 고객 수, 최근 매칭 등

### 6.7 횡단 관심사
- **인증 미들웨어**: 세션 쿠키 → `req.agent` 주입. 세션 없음/만료 → 401.
- **테넌트 강제**: 모든 매물·고객 쿼리에 `agency_id` 필터. 고객은 `member`면 `owner_agent_id = 본인`을 추가. 라우터가 빠뜨릴 수 없도록 **서비스 계층에서 중앙 강제**한다.
- **타 사무소 리소스 요청 → 404** (403 아님, 존재 여부 노출 방지).
- **검증**: zod 스키마를 `packages/shared`에 두고 API 요청 검증 + React 폼이 같은 스키마 재사용.
- **에러 응답 형태**: `{ error: { code, message, details? } }`.
- **페이지네이션**: `?page=&limit=`, 응답 `{ data, total, page, limit }`.
- **지도·지오코딩은 클라이언트**: 카카오맵 JS SDK `services` 라이브러리로 주소↔좌표 변환. 별도 지오코딩 엔드포인트 없음.

---

## 7. 프론트엔드 페이지 구조

hud-admin-template를 기반으로 한다.

### 7.1 유지 (템플릿 셸)
MainLayout · Header · Sidebar · ThemeContext(테마 시스템) · 공통 컴포넌트(HudCard·StatCard·Button).

### 7.2 제거 (부동산과 무관한 데모)
POS · 이메일 · AI챗 · 스크럼보드 · 갤러리 · Products · Pricing · Calendar · Widgets · Tidal 플레이어, 그리고 `ui/`·`forms/`·`tables/`·`charts/` 데모 페이지, `dashboard/Analytics`. 폼·테이블·차트 패턴은 REMS 페이지에서 재사용하고 데모 페이지 자체만 삭제한다.

### 7.3 v1 REMS 페이지
| 경로 | 페이지 | 비고 |
|------|--------|------|
| `/login` | 로그인 | auth/Login 개조 |
| `/signup` | 사무소 가입 | auth/Register 개조 → agency + owner 생성 |
| `/` | 대시보드 | dashboard/Dashboard 개조, StatCard 활용 |
| `/listings` | 매물 목록 | 표/카드 + 필터 + 지도 보기 토글 |
| `/listings/:id` | 매물 상세 | 사진·위치 지도·관심 고객 |
| `/listings/new`, `/listings/:id/edit` | 매물 등록/수정 | 주소→카카오 지오코딩→지도 위치 확인, 사진 업로드 |
| `/customers` | 고객 목록 | 표 + 필터 |
| `/customers/:id` | 고객 상세 | + 매칭 매물 관리 (CRM 핵심 화면) |
| `/customers/new`, `/customers/:id/edit` | 고객 등록/수정 | |
| `/settings` | 설정 | 사무소 정보 · 중개사 관리(owner) · 내 계정/비번 · 테마 |

### 7.4 재사용 컴포넌트
- `<KakaoMap>` — 카카오 SDK 래퍼. 목록(마커 클러스터)·상세(단일 마커)·등록(위치 선택)에서 공용.

### 7.5 구조 추가
- 라우팅: react-router-dom(템플릿 기존) + 인증 가드 — 세션 없으면 `/login`으로 리다이렉트.
- 데이터 계층: TanStack Query.
- `web/src/api/` — 타입 지정 API 클라이언트, `packages/shared` zod 타입 사용.
- 인증 상태: 가벼운 AuthContext. Zustand·Redux 불필요.

---

## 8. 에러 처리 및 검증

- **입력 검증**: 모든 요청의 body·params·query를 zod로 검증. 실패 → 400 + `{ error: { code:'VALIDATION', message, details } }`.
- **중앙 에러 핸들러** (Express 미들웨어): 알려진 에러 클래스를 HTTP 코드로 매핑 — `ValidationError`(400) · `UnauthorizedError`(401) · `ForbiddenError`(403) · `NotFoundError`(404) · `ConflictError`(409, 이메일 중복 등). 알 수 없는 에러 → 500, 서버에 로그를 남기고 클라이언트에는 일반 메시지(내부 노출 금지).
- **타 사무소 접근**: `NotFoundError`(404)로 응답한다.
- **프론트**: TanStack Query가 쿼리·뮤테이션별 에러 상태를 노출 → 공용 토스트 알림. 폼 에러는 zod 결과를 인라인 표시. API가 401을 주면 인증 상태를 비우고 `/login`으로 이동.

---

## 9. 테스트 전략

- **도구**: Vitest (web·api 공용).
- **API 통합 테스트 — 최우선** (테스트 DB 대상):
  - **테넌트 격리 테스트(가장 중요)**: 사무소 A 세션으로 사무소 B의 매물·고객 접근 시 404 확인.
  - 인증 흐름 — 가입·로그인·로그아웃·세션 만료.
  - CRUD 정상 경로 + 검증 실패 — 매물·고객·매칭.
  - 고객 소유권 — `member`는 본인 고객만, `owner`는 사무소 전체.
- **웹 테스트 — 가볍게**: 핵심 폼(매물·고객) 컴포넌트 테스트(React Testing Library) + 주요 페이지 스모크 테스트. UI 과잉 테스트 금지.
- 커버리지 숫자는 실제 측정값만 기록한다. 추정·가짜 수치 금지.
- E2E(Playwright)는 v2로 미룬다.

---

## 10. 프로젝트 구조

```
REMS/                       npm workspaces 루트, 단일 git 저장소
├── web/                    hud-admin-template 이동·개조 (Vite React SPA)
│   └── src/{api,pages,components,layouts,context,themes}
├── api/                    Node + TypeScript (Express)
│   ├── src/{routes,services,middleware,db}
│   ├── prisma/schema.prisma
│   └── uploads/            매물 사진 (gitignore)
├── packages/shared/        zod 스키마 + 타입 (web·api 공유)
└── docs/superpowers/specs/ 설계 문서
```

- 개발: `npm run dev` → web(Vite :5173) + api(:3000) 동시 실행, Vite가 `/api`를 :3000으로 프록시.
- git: `REMS/`를 단일 저장소로 한다. 템플릿 내용을 `web/`로 옮기며 기존 `hud-admin-template/.git`은 제거한다. 테마 작업 코드는 그대로 남고 세부 커밋 이력만 정리된다.

---

## 11. 보안 / 비기능 요구

- **비밀번호**: bcrypt 해시 저장.
- **세션**: httpOnly + Secure + SameSite 쿠키, DB 세션 테이블, 만료 시각 적용.
- **테넌트 격리**: 서비스 계층에서 중앙 강제. 타 사무소 리소스 접근은 404.
- **파일 업로드**: 매물 사진만 허용. 확장자·크기 제한, `uploads/` 디렉터리에 저장.
- **CORS**: web 오리진만 허용. 와일드카드(`*`) 금지.
- **시크릿**: DB 접속 정보·카카오 키 등은 환경 변수로 관리. 하드코딩 금지.

---

## 12. v1 → v2 경계

v2 이후로 미룬 항목:
- Python 수집 워커 — 네이버 매물(JSON API, 격리 모듈), 공공데이터포털 실거래가 API.
- 좌표 POINT 공간 타입 + 반경 검색.
- 실거래가 시세 비교 화면.
- 구독 결제/과금 흐름.
- 실시간 알림, audit log, 즐겨찾기.
