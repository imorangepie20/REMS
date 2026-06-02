# Land Explorer — 설계 문서

날짜: 2026-06-03
상태: 초안 (사용자 검토 대기)

## 0. 배경

REMS v1 (Express + Vite + MariaDB 기반의 multi-tenant 매물·고객 관리 SaaS)을 폐기하고
신규 프로젝트를 시작한다. 사용자 통찰:

- "세부 비즈니스 로직 없이 UI/API 직진은 안 된다" — REMS v1은 도메인 이해 부족.
- 실무 중개사는 매물을 수동 입력하지 않는다. **네이버 부동산이 거의 모든 매물의 소스**이다.
- 가져온 데이터를 표·차트·엑셀로 정리해 보는 도구가 1차 가치.
- 내부 매물 관리는 부수적이지만 필요.

## 1. 프로젝트 정체성

| 항목 | 값 |
|---|---|
| 작업명 | Land Explorer (최종명 미정) |
| 1차 목적 | 네이버 부동산 인터랙티브 탐색 |
| 2차 목적 | 사무소 내부 매물 관리 (네이버와 완전 분리) |
| 사용 형태 | 멀티테넌트 SaaS Web (Electron 패키징은 추후 단계) |
| 사용자 단위 | Agency(사무소) — Owner / Member |

## 2. 핵심 비기능 결정

- **Naver 데이터는 DB에 저장하지 않는다.** 매번 fetch + 세션 메모리 단기 캐시(LRU, 5분).
- **시계열·이력 차트는 범위 외.** (저장하지 않으므로)
- **단일 코드베이스 (Next.js full-stack)** — Vite/Express 분리 구조 폐기.
- **지도는 KakaoMap 재활용** (REMS의 `KakaoMap.tsx`).
- **Naver 호출은 서버(Route Handler)에서 프록시** — Referer 헤더 부착.

## 3. 시스템 경계

```
┌──────────────────────────────────────────────────────────┐
│  Next.js App (App Router) — 단일 코드베이스              │
│                                                          │
│  ┌────────────────────┐    ┌─────────────────────────┐  │
│  │  Explore 영역      │    │  Internal 영역          │  │
│  │  (네이버 탐색)     │    │  (사무소 자체 매물)     │  │
│  │  • DB 영속화 X     │    │  • DB 영속화 O          │  │
│  │  • 멀티테넌시 X    │    │  • 멀티테넌시 O         │  │
│  │  • 세션 캐시만     │    │  • Owner/Member 격리    │  │
│  └────────────────────┘    └─────────────────────────┘  │
│                                                          │
│  공통: 인증 (가입/로그인/세션 쿠키)                       │
└──────────────────────────────────────────────────────────┘
```

이 분리가 가장 중요한 원칙이다. 두 영역은 같은 앱 안에 있지만 데이터 흐름은
독립적이다. 같은 매물을 양쪽에서 "동기화"하지 않는다. 사용자가 네이버에서 본 매물을
내부로 가져오고 싶으면 별도로 (수기로) 입력한다 — 이게 의도된 분리이다.

## 4. 기술 스택

| 레이어 | 선택 |
|---|---|
| Frontend / Backend | Next.js (App Router) — 단일 코드베이스 |
| 언어 | TypeScript |
| DB | PostgreSQL 16 |
| ORM | Prisma |
| Auth | 자체 구현 (httpOnly 쿠키 + Session 테이블, REMS와 동일 방식) |
| Map | Kakao Maps JavaScript SDK (REMS `KakaoMap.tsx` 차용) |
| Chart | chart.js + react-chartjs-2 (REMS 차용) |
| Excel | `exceljs` (멀티 시트 + 스타일 지원) |
| File upload | multer 또는 Next.js native FormData |
| Validation | zod (REMS 차용) |
| Styling | Tailwind CSS + HUD 테마 (REMS 차용 — `hud-*` 클래스) |
| Container | Docker (Postgres + Next app) |
| Tests | Vitest + Playwright (필요 시) |

## 5. 페이지 구조

| 경로 | 화면 |
|---|---|
| `/login`, `/signup` | 공용 (REMS 폼 디자인 차용) |
| `/` | 대시보드 (내부 매물 통계 + 최근 매물 / 탐색 영역은 별도) |
| `/explore` | 네이버 탐색 메인 (지도 + 단지 리스트 + 매물 패널) |
| `/explore/chart` | 평형별 평균가 차트 (현재 탐색 결과 기반) |
| `/explore/download` | 엑셀 다운로드 (컬럼 선택) |
| `/listings` | 내부 매물 목록 |
| `/listings/new` | 내부 매물 등록 |
| `/listings/:id` | 내부 매물 상세 |
| `/listings/:id/edit` | 내부 매물 수정 |
| `/settings` | 사이드바 5섹션 (사무소·계정·비밀번호·중개사·외관) |

내부 매물은 풍부한 필드 + 첨부가 있어 **별도 페이지 분리** 패턴. 단지/매물 같은
인라인 row expand는 사용하지 않는다 (메모리 `inline-expand-vs-separate-pages.md` 적용).

## 6. 도메인 모델

### 6.1 DB 스키마 (Prisma)

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum Role { owner member }
enum AgentStatus { active suspended }
enum DealType { sale jeonse wolse }
enum PropertyType { apartment officetel villa house commercial land }
enum ListingStatus { active contracted hidden }
enum Direction { north east south west northeast southeast southwest northwest }

model Agency {
  id             Int      @id @default(autoincrement())
  name           String
  businessNumber String?
  phone          String?
  address        String?
  agents         Agent[]
  listings       InternalListing[]
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
  listings     InternalListing[] @relation("createdBy")
  createdAt    DateTime     @default(now())
}

model Session {
  id        Int      @id @default(autoincrement())
  agentId   Int
  agent     Agent    @relation(fields: [agentId], references: [id])
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model InternalListing {
  id           Int      @id @default(autoincrement())
  agencyId     Int
  agency       Agency   @relation(fields: [agencyId], references: [id])
  createdById  Int
  createdBy    Agent    @relation("createdBy", fields: [createdById], references: [id])

  // 식별 / 단지·호실 정보
  title        String
  complexName  String?
  dong         String?
  ho           String?
  floor        String?
  direction    Direction?
  pyeongType   String?     // "84A", "59B"

  // 거래
  dealType     DealType
  propertyType PropertyType
  salePrice    BigInt?
  deposit      BigInt?
  monthlyRent  BigInt?

  // 면적
  areaM2       Decimal     @db.Decimal(8,2)
  supplyAreaM2 Decimal?    @db.Decimal(8,2)

  // 위치
  address       String
  roadAddress   String?
  addressDetail String?
  latitude      Float?
  longitude     Float?

  // 메타
  maintenanceFee      Int?
  availableMoveInDate DateTime?
  ownerName           String?
  ownerPhone          String?
  ownerMemo           String?
  commissionRate      Decimal?  @db.Decimal(4,2)
  description         String?
  privateMemo         String?

  // 상태
  status          ListingStatus @default(active)
  contractedAt    DateTime?
  contractedPrice BigInt?

  photos    ListingPhoto[]
  contracts ListingContract[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ListingPhoto {
  id        Int      @id @default(autoincrement())
  listingId Int
  listing   InternalListing @relation(fields: [listingId], references: [id], onDelete: Cascade)
  url       String
  caption   String?   // "거실", "도면", "외관" 등 분류
  sortOrder Int       @default(0)
  createdAt DateTime  @default(now())
}

model ListingContract {
  id         Int      @id @default(autoincrement())
  listingId  Int
  listing    InternalListing @relation(fields: [listingId], references: [id], onDelete: Cascade)
  url        String
  filename   String
  uploadedAt DateTime @default(now())
}
```

### 6.2 멀티테넌시·권한 규칙

- 모든 internal_* 라우트는 `agencyId` 격리.
- Member는 자기가 만든 매물만 수정/삭제. 같은 사무소 다른 매물은 **읽기 가능** (사무소 공동 자산).
- Owner는 자기 사무소의 모든 매물 접근.
- 사무소 간 데이터 누출 없도록 모든 쿼리는 `agencyId` 가드.

#### 민감 필드 가시성 (Member 다른 멤버 매물 조회 시)

| 필드 | 본인(작성자) | 같은 사무소 Member | Owner |
|---|---|---|---|
| `ownerName`, `ownerPhone`, `ownerMemo` | 평문 | **마스킹** (이름 첫글자 + ***, 전화 끝 4자리) | 평문 |
| `privateMemo` | 평문 | **숨김** (응답에서 제외) | 평문 |
| 그 외 모든 필드 | 평문 | 평문 | 평문 |

API 응답에서 위 규칙을 일관 적용 (server-side projection).

### 6.3 Naver 코드 ↔ 내부 enum 매핑

이 매핑이 두 영역의 어휘 차이를 해결한다. 입력단(Naver fetch)에서 변환.

| Naver 코드 | 의미 | 내부 enum |
|---|---|---|
| **tradeTypes** |  | `DealType` |
| `A1` | 매매 | `sale` |
| `B1` | 전세 | `jeonse` |
| `B2` | 월세 | `wolse` |
| `B3` | 단기임대 | (지원 안 함) |
| **realEstateTypes** |  | `PropertyType` |
| `A01` | 아파트 | `apartment` |
| `A02` | 오피스텔 | `officetel` |
| `A03` | 빌라/연립 | `villa` |
| `B03` | 단독/다가구 | `house` |
| `C01` | 상가 | `commercial` |
| `D01` | 토지 | `land` |
| 그 외 | (재건축·전원주택 등) | 지원 안 함 (필요 시 추가) |

평형명: Naver의 `pyeongName` (예 "84A")과 내부 `pyeongType`은 같은 개념의 다른 표기.
DB 컬럼 `pyeongType`은 Naver pyeongName을 그대로 저장한다.

### 6.4 Naver 데이터 타입 (DB 미저장)

```typescript
// src/lib/naver-types.ts
export type Region = {
  legalDivisionNumber: string  // 10자리 (예: "4111113000")
  name: string                 // 동/구/시 이름
  level: 'sido' | 'sigungu' | 'eup'
  parent?: Region
}

export type NaverComplex = {
  complexNumber: string
  complexName: string
  address: string
  latitude: number
  longitude: number
  householdCount: number
  builtYear: number
  complexType: string          // 'APT', 'OFT', ...
  pyeongTypes: NaverPyeongType[]
  totalArticleCount?: number
}

export type NaverPyeongType = {
  pyeongName: string           // "84A"
  exclusiveArea: number        // 전용 m²
  supplyArea: number           // 공급 m²
  priceMin: number | null
  priceMax: number | null
}

export type NaverArticle = {
  articleNo: string
  tradeType: 'A1' | 'B1' | 'B2'
  price: number | null          // 매매가 또는 보증금
  monthlyRent: number | null
  pyeongName: string
  exclusiveArea: number
  floor: string                 // "15", "고", "중", "저"
  direction: string             // "남", "남동" ...
  registeredAt: string          // ISO date
  brokerName: string | null
}
```

## 7. API 라우트

### 7.1 인증

| 메서드 | 경로 | 권한 |
|---|---|---|
| POST | `/api/auth/signup` | 공용. body: `{agency:{name}, owner:{name,email,password,phone?}}` |
| POST | `/api/auth/login` | 공용. body: `{email,password}` |
| POST | `/api/auth/logout` | 로그인 |
| GET | `/api/auth/me` | 로그인 |
| PATCH | `/api/auth/password` | 로그인. body: `{current,new}` |

### 7.2 Naver 탐색 (멀티테넌시 무관, 로그인만 가드)

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/naver/regions?q=...` | 법정동 검색 (시도·시군구·읍면동) |
| GET | `/api/naver/complexes?eup=...&tradeTypes=...&realEstateTypes=...` | 단지 리스트 (proxy → `/front-api/v1/complex/region`) |
| POST | `/api/naver/articles` | 단지 매물 리스트 (proxy → `/front-api/v1/complex/article/list`) |
| POST | `/api/naver/export` | 엑셀 생성 — body: `{columns: string[], data: NaverComplex[] or NaverArticle[]}` |

세션 메모리에 5분 TTL LRU 캐시 (key = 정규화된 쿼리 문자열). 5분 내 동일 키 재호출 시 캐시 적중.
"새로고침" 버튼은 해당 키의 캐시 엔트리를 무효화한 뒤 재fetch.

### 7.3 내부 매물

| 메서드 | 경로 | 권한 |
|---|---|---|
| GET | `/api/listings?q=&dealType=&status=&page=` | 같은 사무소 매물 (member도 조회 가능) |
| POST | `/api/listings` | 로그인. createdById = 본인 |
| GET | `/api/listings/:id` | 같은 사무소 |
| PATCH | `/api/listings/:id` | 본인 매물 OR owner |
| DELETE | `/api/listings/:id` | 본인 매물 OR owner |
| POST | `/api/listings/:id/photos` | 본인 매물 OR owner |
| DELETE | `/api/listings/:id/photos/:pid` | 본인 매물 OR owner |
| POST | `/api/listings/:id/contracts` | 본인 매물 OR owner |
| DELETE | `/api/listings/:id/contracts/:cid` | 본인 매물 OR owner |

### 7.4 사무소·중개사

| 메서드 | 경로 | 권한 |
|---|---|---|
| GET | `/api/agents` | 로그인. 같은 사무소 멤버 목록 |
| POST | `/api/agents` | Owner. 멤버 추가 |
| PATCH | `/api/agents/:id` | 본인 (profile) 또는 owner (role/status) |
| PATCH | `/api/agency` | Owner. 사무소 정보 수정 |

## 8. /explore 화면 상세

```
┌─────────────────────────────────────────────────────────────┐
│  [지역▼ 경기 > 수원 > 정자동]  [거래▼ 매매] [종류▼ 아파트] │
│  [엑셀 다운로드] [차트 보기]                                │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────────────────────────┐│
│ │ 단지 (12)       │ │                                     ││
│ │ ───────────────│ │                                     ││
│ │ ● 래미안ABC     │ │         KakaoMap                    ││
│ │   1234세대      │ │       (단지 마커들)                 ││
│ │   2015년 준공   │ │                                     ││
│ │   매물 12       │ │                                     ││
│ │ ● 푸르지오XYZ   │ │                                     ││
│ │   ...           │ │                                     ││
│ └─────────────────┘ └─────────────────────────────────────┘│
│ ┌─────────────────────────────────────────────────────────┐│
│ │ 매물 (선택한 단지 — 래미안ABC, 12건)                   ││
│ │ ───────────────────────────────────────────────────── ││
│ │ 매물번호 평형  가격   면적  층 향 등록일  중개사       ││
│ │ 1234567  84A   9억    84    15 남 5/20    한국공인     ││
│ │ ...                                                    ││
│ └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

- 지역 선택: 시도 → 시군구 → 읍면동 3단 드롭다운 (네이버 검색 API)
- 거래유형: 매매(A1) / 전세(B1) / 월세(B2) 토글 (복수 선택 가능)
- 매물종류: 아파트(A01) / 오피스텔(A02) / 빌라(A03) ... (복수 선택 가능)
- 단지 클릭 → 지도 중심 이동 + 매물 패널 갱신
- 지도 마커 클릭 → 좌측 패널 동기화
- 정렬: 단지명 / 매물수 / 준공년도 / 세대수

세션 캐시 키는 `(eup, tradeTypes, realEstateTypes, sortType)`. 새로고침 버튼은 세션 캐시
무효화 후 재fetch.

## 9. /explore/chart — 평형별 평균가

- 현재 세션의 매물 결과(단지 N개 × 매물 N건)를 입력.
- x축: 평형명 (예: "59A", "59B", "84A", "84B")
- y축: 평균가 (단위: 원, 자동 스케일)
- 거래유형이 매매면 매매가, 전세면 보증금, 월세면 보증금+월세×100 환산식 (옵션)
- chart.js 막대그래프

## 10. /explore/download — 엑셀 다운로드

- 사용자 흐름: 다운로드 페이지 진입 → 시트별(단지/매물) 컬럼 체크박스 → 다운로드 클릭
- 컬럼 마스터 (단지 시트):
  - 단지번호, 단지명, 주소, 위도, 경도, 세대수, 준공년도, 매물수
- 컬럼 마스터 (매물 시트):
  - 매물번호, 단지명, 거래유형, 평형명, 가격, 보증금, 월세, 전용면적, 공급면적, 층, 향, 등록일, 중개사
- 시트명·컬럼 헤더·enum 값은 모두 **한국어** (매매/전세/월세, 매물번호 등). 한국 중개사가 받아서 그대로 사용.
- 거래유형 셀: 매매/전세/월세 (DB enum이 아니라 한국어 표시값).
- 가격 셀: 원 단위 정수, 엑셀 숫자 형식 + 쉼표 구분.
- 서버에서 exceljs로 생성, 다운로드 응답.
- 파일명: `land-explorer_{지역}_{거래유형}_{YYYYMMDD}.xlsx`

## 11. /listings — 내부 매물

- **목록**: 테이블 + 검색·필터 + 페이지네이션 (REMS HUD 패턴 차용)
- **등록 / 수정**: 별도 폼 페이지 (`/listings/new`, `/listings/:id/edit`)
  - 섹션별 그룹: 식별 / 거래 / 면적 / 위치 / 메타 / 첨부
  - 사진 다중 업로드 (드래그 앤 드롭 + 캡션 입력)
  - 계약서 첨부 다중
  - 카카오맵 picker (주소 입력 시 좌표 자동 채움)
- **상세**: 모든 필드 + 사진 갤러리 + 첨부 다운로드 + 수정/삭제 액션
- 권한 가드: PATCH/DELETE는 본인 매물 OR owner

## 12. /settings — 5섹션 (REMS 차용)

```
┌─ 사이드바 ─────────┬─────────────────────────────────┐
│ 사무소 정보        │ (선택된 섹션 내용)              │
│ 내 계정            │                                 │
│ 비밀번호           │                                 │
│ 중개사 관리 (Owner)│                                 │
│ 외관               │                                 │
└────────────────────┴─────────────────────────────────┘
```

REMS의 Settings.tsx 디자인 그대로 적용.

## 13. 디렉토리 구조

```
nextapp/
  prisma/
    schema.prisma
    seed.ts
  public/
    favicon.ico
  src/
    app/
      (auth)/
        login/page.tsx
        signup/page.tsx
      (app)/
        layout.tsx              # 인증 가드 + 사이드바
        page.tsx                # 대시보드
        explore/
          page.tsx              # 탐색 메인
          chart/page.tsx
          download/page.tsx
        listings/
          page.tsx
          new/page.tsx
          [id]/
            page.tsx
            edit/page.tsx
        settings/page.tsx
      api/
        auth/
          signup/route.ts
          login/route.ts
          logout/route.ts
          me/route.ts
          password/route.ts
        naver/
          regions/route.ts
          complexes/route.ts
          articles/route.ts
          export/route.ts
        listings/
          route.ts              # GET, POST
          [id]/
            route.ts            # GET, PATCH, DELETE
            photos/route.ts
            photos/[pid]/route.ts
            contracts/route.ts
            contracts/[cid]/route.ts
        agents/
          route.ts
          [id]/route.ts
        agency/route.ts
    lib/
      auth.ts                   # 세션 + 가드
      db.ts                     # prisma client
      naver.ts                  # Naver API client + cache
      excel.ts                  # exceljs 시트 생성
      naver-types.ts            # transient 타입
      validators.ts             # zod schemas
    components/
      KakaoMap.tsx              # REMS 차용
      common/
        Button.tsx
        StatCard.tsx
      explore/
        RegionPicker.tsx
        FilterBar.tsx
        ComplexList.tsx
        ArticleTable.tsx
        ColumnPicker.tsx
      listings/
        ListingForm.tsx
        PhotoUploader.tsx
        ContractUploader.tsx
      layout/
        Sidebar.tsx
        TopBar.tsx
    auth/
      AuthContext.tsx
      RequireAuth.tsx
  docker-compose.yml             # postgres 컨테이너
  .env
  package.json
  next.config.ts
  tsconfig.json
  tailwind.config.ts
```

## 14. 마이그레이션 / REMS 폐기 방침

- 현재 REMS 코드는 `legacy/rems-v1/` 로 이동하거나 별도 git tag로 보존.
- 신규 코드는 `nextapp/` (또는 repo 최상단 재구성)에 작성.
- 재활용 자산: `KakaoMap.tsx`, HUD 테마 Tailwind 설정, Settings 페이지 디자인, 인증 패턴.
- 폐기: Express 서버, 기존 customers/matches 도메인, REMS의 Listing 스키마.

세부 마이그레이션 전략은 implementation plan에서 결정.

## 15. 명시적 비범위 (Out of Scope)

- 네이버 데이터 시계열 추적·이력 차트
- 시도·시군구 단위 광역 탐색 (동 단위 가정)
- 공동중개망(KAR/텐컴/한방) 송출
- 카카오톡 캡쳐 OCR 자동 매물 입력
- 매물 추천/매칭 알고리즘
- 결제·구독
- 모바일 네이티브 앱

이 항목들은 별도 사이클로 다룬다.

## 16. 검증 / 테스트 전략

- API 라우트별 통합 테스트 (Vitest + supertest 또는 Next.js test runner)
- 멀티테넌시 격리 테스트 (사무소 A의 매물을 사무소 B가 접근 불가)
- Member 권한 가드 테스트
- Naver 프록시: mock 응답으로 캐시 동작 / 에러 변환 검증
- 엑셀 출력: 시트 구조·컬럼 헤더 검증

## 17. 열린 결정 사항 (다음 단계로 미룸)

- 프로젝트 최종명
- Postgres 호스팅 (로컬 Docker / 클라우드 RDS / Supabase)
- 파일 저장소 (로컬 디스크 / S3-호환)
- Naver SDK 버전·Referer 정책의 안정성
- Rate limit 모니터링 도구

이상 항목은 구현 계획(writing-plans)에서 다룬다.

## 18. 구현 단계 (제안)

이 스펙은 단일 구현 플랜으로 다루기엔 큼. writing-plans 단계에서 다음 5개 phase로
분할 권장:

| Phase | 범위 |
|---|---|
| 1. Foundation | Next.js scaffold, Postgres+Prisma, 기본 레이아웃, Tailwind+HUD 테마, Docker compose |
| 2. Auth & Multi-tenancy | signup/login/me/password, session middleware, agency·agent 모델, role 가드, settings 5섹션 |
| 3. Naver Explore | RegionPicker, FilterBar, /api/naver/* proxy + 세션 캐시, KakaoMap 통합, ComplexList + ArticleTable |
| 4. Internal Listings | InternalListing CRUD, 사진·계약서 업로드, 별도 폼 페이지, 민감 필드 마스킹 |
| 5. Export & Chart | 컬럼 picker UI, exceljs 시트 생성, 평형별 평균가 차트, 대시보드 통계 |

각 phase는 독립 구현 플랜으로 분리 — 한 phase 완료 후 사용자 검증·머지·다음 진행.
