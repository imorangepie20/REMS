# Land Explorer — Phase 4: Internal Listings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사무소 내부 매물(InternalListing) 관리 시스템 — Prisma 모델 + 마이그레이션, CRUD API (멀티테넌시·권한·민감필드 마스킹), 사진/계약서 첨부, 별도 페이지(목록/상세/등록/수정) UI.

**Architecture:** Postgres에 InternalListing + ListingPhoto + ListingContract 모델 + 4개 enum 추가. API는 `requireAuth(req)` + `agencyId` 격리, write는 `본인 OR owner` 가드. 다른 멤버 매물 조회 시 `ownerName/Phone/Memo` 마스킹 + `privateMemo` 숨김 (server-side projection). 파일은 `public/uploads/listings/{id}/...` 로컬 디스크에 저장. UI는 REMS HUD 패턴의 별도 페이지 (`/listings`, `/listings/new`, `/listings/:id`, `/listings/:id/edit`) + 공유 `<ListingForm>` 컴포넌트.

**Tech Stack:** Prisma 5 + Postgres 16, Next.js 15 Route Handlers (multipart FormData), zod, bcrypt(unused), exceljs(deferred to Phase 5), KakaoMap (already integrated)

**Working directory:** `/Volumes/MacExtend 1/REMS`

---

## File Structure

```
prisma/
├── schema.prisma                              # 모델·enum 추가
└── migrations/<ts>_internal_listings/
    └── migration.sql

src/lib/
├── validators.ts                              # 기존 + listing schemas 추가
├── listing-helpers.ts                         # 권한·마스킹·projection
└── uploads.ts                                 # 파일 저장 헬퍼

src/app/api/listings/
├── route.ts                                   # GET (list), POST (create)
└── [id]/
    ├── route.ts                               # GET, PATCH, DELETE
    ├── photos/
    │   ├── route.ts                           # POST
    │   └── [pid]/route.ts                     # DELETE
    └── contracts/
        ├── route.ts                           # POST
        └── [cid]/route.ts                     # DELETE

src/app/(app)/listings/
├── page.tsx                                   # 목록
├── new/page.tsx                               # 등록 폼
└── [id]/
    ├── page.tsx                               # 상세
    └── edit/page.tsx                          # 수정 폼

src/components/listings/
├── ListingForm.tsx                            # 공유 폼 (new + edit)
├── ListingTable.tsx                           # 목록 테이블
├── ListingFilters.tsx                         # 필터바
├── PhotoUploader.tsx                          # 다중 사진 + 캡션
├── ContractUploader.tsx                       # 다중 계약서
└── PhotoGallery.tsx                           # 상세 페이지 사진 그리드

src/lib/api/
└── listings.ts                                # 프론트엔드 fetch wrapper

tests/
├── lib-listing-helpers.test.ts                # projection masking 단위 테스트
├── api-listings-create.test.ts
├── api-listings-list.test.ts                  # 마스킹·페이지네이션·필터
├── api-listings-get.test.ts                   # 마스킹·tenancy
├── api-listings-update.test.ts                # 본인/owner 가드
├── api-listings-delete.test.ts
├── api-listings-photos.test.ts
└── api-listings-contracts.test.ts

public/uploads/listings/                       # 파일 저장 (.gitignore)
```

**Modify:**
- `prisma/schema.prisma`: enum + 3개 model 추가
- `src/lib/validators.ts`: listing zod 스키마 추가
- `.gitignore`: `public/uploads/` 추가

---

## Tasks

### Task 1: Prisma 스키마 — 매물 enum + 모델

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 기존 스키마 끝에 추가**

기존 Phase 2 스키마(Agency, Agent, Session)는 그대로 두고 그 뒤에 추가한다. 또한 Agency, Agent 모델에 listings relation을 추가해야 한다.

`prisma/schema.prisma` 전체를 다음으로 교체:
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

enum DealType {
  sale
  jeonse
  wolse
}

enum PropertyType {
  apartment
  officetel
  villa
  house
  commercial
  land
}

enum ListingStatus {
  active
  contracted
  hidden
}

enum Direction {
  north
  east
  south
  west
  northeast
  southeast
  southwest
  northwest
}

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
  id           Int         @id @default(autoincrement())
  agencyId     Int
  agency       Agency      @relation(fields: [agencyId], references: [id])
  email        String      @unique
  passwordHash String
  name         String
  phone        String?
  role         Role        @default(member)
  status       AgentStatus @default(active)
  sessions     Session[]
  listings     InternalListing[] @relation("createdBy")
  createdAt    DateTime    @default(now())

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

model InternalListing {
  id          Int    @id @default(autoincrement())
  agencyId    Int
  agency      Agency @relation(fields: [agencyId], references: [id])
  createdById Int
  createdBy   Agent  @relation("createdBy", fields: [createdById], references: [id])

  title       String
  complexName String?
  dong        String?
  ho          String?
  floor       String?
  direction   Direction?
  pyeongType  String?

  dealType     DealType
  propertyType PropertyType
  salePrice    BigInt?
  deposit      BigInt?
  monthlyRent  BigInt?

  areaM2       Decimal  @db.Decimal(8, 2)
  supplyAreaM2 Decimal? @db.Decimal(8, 2)

  address       String
  roadAddress   String?
  addressDetail String?
  latitude      Float?
  longitude     Float?

  maintenanceFee      Int?
  availableMoveInDate DateTime?
  ownerName           String?
  ownerPhone          String?
  ownerMemo           String?
  commissionRate      Decimal? @db.Decimal(4, 2)
  description         String?
  privateMemo         String?

  status          ListingStatus @default(active)
  contractedAt    DateTime?
  contractedPrice BigInt?

  photos    ListingPhoto[]
  contracts ListingContract[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([agencyId])
  @@index([createdById])
  @@index([status])
}

model ListingPhoto {
  id        Int             @id @default(autoincrement())
  listingId Int
  listing   InternalListing @relation(fields: [listingId], references: [id], onDelete: Cascade)
  url       String
  caption   String?
  sortOrder Int             @default(0)
  createdAt DateTime        @default(now())

  @@index([listingId])
}

model ListingContract {
  id         Int             @id @default(autoincrement())
  listingId  Int
  listing    InternalListing @relation(fields: [listingId], references: [id], onDelete: Cascade)
  url        String
  filename   String
  uploadedAt DateTime        @default(now())

  @@index([listingId])
}
```

- [ ] **Step 2: prisma format**

```bash
npx prisma format
```

- [ ] **Step 3: 커밋**

```bash
git add prisma/schema.prisma
git commit -m "feat(prisma): InternalListing + ListingPhoto + ListingContract 모델 + DealType/PropertyType/ListingStatus/Direction enum"
```

### Task 2: 마이그레이션 (internal_listings)

**Files:**
- Create: `prisma/migrations/<ts>_internal_listings/migration.sql`

- [ ] **Step 1: 마이그레이션 생성 + 적용**

Node v26에서 `prisma migrate dev`가 비대화형 환경에서 실패하면 `expect`로 우회. Phase 2 Task 2에서 사용된 방법:

```bash
expect <<'EOF'
set timeout 60
spawn npx prisma migrate dev --name internal_listings
expect {
  -re "reset.*continue" { send "y\r"; exp_continue }
  eof
}
EOF
```

기대: `prisma/migrations/<ts>_internal_listings/migration.sql` 생성 + DB에 새 테이블·enum 적용.

- [ ] **Step 2: DB 검증**

```bash
docker compose exec -T db psql -U app -d land_explorer -c '\dt'
docker compose exec -T db psql -U app -d land_explorer -c "SELECT typname FROM pg_type WHERE typname IN ('DealType','PropertyType','ListingStatus','Direction');"
```
Expected: 새 테이블 `InternalListing`, `ListingPhoto`, `ListingContract` + 4개 enum 존재.

- [ ] **Step 3: 커밋**

```bash
git add prisma/migrations/
git commit -m "feat(db): internal_listings 마이그레이션"
```

### Task 3: validators.ts 확장 — listing 스키마

**Files:**
- Modify: `src/lib/validators.ts`

- [ ] **Step 1: 파일 끝에 listing 스키마 추가**

기존 validators.ts에 다음을 추가:

```typescript
// === Internal Listings ===

const dealTypeEnum = z.enum(['sale', 'jeonse', 'wolse'])
const propertyTypeEnum = z.enum(['apartment', 'officetel', 'villa', 'house', 'commercial', 'land'])
const listingStatusEnum = z.enum(['active', 'contracted', 'hidden'])
const directionEnum = z.enum(['north', 'east', 'south', 'west', 'northeast', 'southeast', 'southwest', 'northwest'])

const bigIntInput = z.union([z.bigint(), z.number().int().nonnegative(), z.string().regex(/^\d+$/)])
  .transform((v): bigint => typeof v === 'bigint' ? v : BigInt(v))

export const createListingSchema = z.object({
  title: z.string().min(1).max(200),
  complexName: z.string().max(100).nullable().optional(),
  dong: z.string().max(20).nullable().optional(),
  ho: z.string().max(20).nullable().optional(),
  floor: z.string().max(10).nullable().optional(),
  direction: directionEnum.nullable().optional(),
  pyeongType: z.string().max(20).nullable().optional(),

  dealType: dealTypeEnum,
  propertyType: propertyTypeEnum,
  salePrice: bigIntInput.nullable().optional(),
  deposit: bigIntInput.nullable().optional(),
  monthlyRent: bigIntInput.nullable().optional(),

  areaM2: z.number().positive(),
  supplyAreaM2: z.number().positive().nullable().optional(),

  address: z.string().min(1).max(300),
  roadAddress: z.string().max(300).nullable().optional(),
  addressDetail: z.string().max(200).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),

  maintenanceFee: z.number().int().nonnegative().nullable().optional(),
  availableMoveInDate: z.coerce.date().nullable().optional(),
  ownerName: z.string().max(50).nullable().optional(),
  ownerPhone: z.string().max(20).nullable().optional(),
  ownerMemo: z.string().max(1000).nullable().optional(),
  commissionRate: z.number().min(0).max(100).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  privateMemo: z.string().max(5000).nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.dealType === 'sale' && data.salePrice == null) {
    ctx.addIssue({ code: 'custom', path: ['salePrice'], message: '매매는 매매가가 필요합니다' })
  }
  if (data.dealType === 'jeonse' && data.deposit == null) {
    ctx.addIssue({ code: 'custom', path: ['deposit'], message: '전세는 보증금이 필요합니다' })
  }
  if (data.dealType === 'wolse' && (data.deposit == null || data.monthlyRent == null)) {
    ctx.addIssue({ code: 'custom', path: ['deposit'], message: '월세는 보증금과 월세가 필요합니다' })
  }
})
export type CreateListingInput = z.infer<typeof createListingSchema>

export const updateListingSchema = createListingSchema._def.schema.partial().extend({
  status: listingStatusEnum.optional(),
  contractedAt: z.coerce.date().nullable().optional(),
  contractedPrice: bigIntInput.nullable().optional(),
})
export type UpdateListingInput = z.infer<typeof updateListingSchema>

export const listingQuerySchema = z.object({
  q: z.string().max(100).optional(),
  dealType: dealTypeEnum.optional(),
  status: listingStatusEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
export type ListingQueryInput = z.infer<typeof listingQuerySchema>
```

- [ ] **Step 2: TS 검증**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 커밋**

```bash
git add src/lib/validators.ts
git commit -m "feat(lib): listing zod 스키마 (create/update/query) + 거래유형별 가격 필수 검증"
```

### Task 4: listing-helpers.ts — 권한·민감필드 마스킹 — TDD

**Files:**
- Create: `src/lib/listing-helpers.ts`
- Create: `tests/lib-listing-helpers.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/lib-listing-helpers.test.ts`:
```typescript
import { describe, expect, it } from 'vitest'
import { projectListing, maskPhone, maskName, canWriteListing } from '@/lib/listing-helpers'
import type { SessionAgent } from '@/lib/session'

const owner: SessionAgent = { id: 1, agencyId: 100, email: 'o@x.com', name: 'Owner', role: 'owner', status: 'active' }
const member1: SessionAgent = { id: 2, agencyId: 100, email: 'm1@x.com', name: 'M1', role: 'member', status: 'active' }
const member2: SessionAgent = { id: 3, agencyId: 100, email: 'm2@x.com', name: 'M2', role: 'member', status: 'active' }

const baseListing = {
  id: 1, agencyId: 100, createdById: 2,
  title: '래미안', complexName: null, dong: null, ho: null,
  floor: null, direction: null, pyeongType: null,
  dealType: 'sale' as const, propertyType: 'apartment' as const,
  salePrice: 900_000_000n, deposit: null, monthlyRent: null,
  areaM2: { toNumber: () => 84.5 }, supplyAreaM2: null,
  address: '서울 강남구 역삼동', roadAddress: null, addressDetail: null,
  latitude: 37.5, longitude: 127.0,
  maintenanceFee: 200_000, availableMoveInDate: null,
  ownerName: '김철수', ownerPhone: '010-1234-5678', ownerMemo: '바쁨',
  commissionRate: null, description: '좋은 매물', privateMemo: '비밀',
  status: 'active' as const, contractedAt: null, contractedPrice: null,
  createdAt: new Date('2026-06-01'), updatedAt: new Date('2026-06-01'),
}

describe('maskPhone', () => {
  it('끝 4자리만 노출', () => {
    expect(maskPhone('010-1234-5678')).toBe('***-****-5678')
    expect(maskPhone('01012345678')).toBe('*******5678')
    expect(maskPhone(null)).toBeNull()
    expect(maskPhone('')).toBe('')
  })
})

describe('maskName', () => {
  it('첫글자 + ***', () => {
    expect(maskName('김철수')).toBe('김***')
    expect(maskName('이')).toBe('이***')
    expect(maskName(null)).toBeNull()
    expect(maskName('')).toBe('')
  })
})

describe('projectListing', () => {
  it('작성자 본인 — 모든 필드 평문', () => {
    const p = projectListing(baseListing, member1)
    expect(p.ownerName).toBe('김철수')
    expect(p.ownerPhone).toBe('010-1234-5678')
    expect(p.ownerMemo).toBe('바쁨')
    expect(p.privateMemo).toBe('비밀')
  })

  it('같은 사무소 다른 member — owner 정보 마스킹, privateMemo 숨김', () => {
    const p = projectListing(baseListing, member2)
    expect(p.ownerName).toBe('김***')
    expect(p.ownerPhone).toBe('***-****-5678')
    expect(p.ownerMemo).toBeNull()
    expect(p.privateMemo).toBeUndefined()
  })

  it('owner — 모든 필드 평문', () => {
    const p = projectListing(baseListing, owner)
    expect(p.ownerName).toBe('김철수')
    expect(p.privateMemo).toBe('비밀')
  })

  it('BigInt → string 직렬화 안전', () => {
    const p = projectListing(baseListing, owner)
    expect(typeof p.salePrice).toBe('string')
    expect(p.salePrice).toBe('900000000')
  })

  it('areaM2 Decimal → number', () => {
    const p = projectListing(baseListing, owner)
    expect(p.areaM2).toBe(84.5)
  })
})

describe('canWriteListing', () => {
  it('작성자 본인 → true', () => {
    expect(canWriteListing(baseListing, member1)).toBe(true)
  })
  it('owner → true', () => {
    expect(canWriteListing(baseListing, owner)).toBe(true)
  })
  it('다른 member → false', () => {
    expect(canWriteListing(baseListing, member2)).toBe(false)
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/lib-listing-helpers.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: 구현**

`src/lib/listing-helpers.ts`:
```typescript
import type { SessionAgent } from './session'

interface ListingLike {
  id: number
  agencyId: number
  createdById: number
  ownerName: string | null
  ownerPhone: string | null
  ownerMemo: string | null
  privateMemo: string | null
  salePrice: bigint | null
  deposit: bigint | null
  monthlyRent: bigint | null
  contractedPrice: bigint | null
  areaM2: { toNumber: () => number } | number
  supplyAreaM2: { toNumber: () => number } | number | null
  commissionRate: { toNumber: () => number } | number | null
  [key: string]: unknown
}

export function maskPhone(phone: string | null): string | null {
  if (phone == null) return null
  if (phone.length <= 4) return phone
  const tail = phone.slice(-4)
  const head = phone.slice(0, -4).replace(/[^-]/g, '*')
  return head + tail
}

export function maskName(name: string | null): string | null {
  if (name == null) return null
  if (name.length === 0) return ''
  return name[0] + '***'
}

function decToNum(v: { toNumber: () => number } | number | null | undefined): number | null {
  if (v == null) return null
  if (typeof v === 'number') return v
  return v.toNumber()
}

function bigToStr(v: bigint | null | undefined): string | null {
  return v == null ? null : v.toString()
}

export function canWriteListing(listing: { createdById: number }, agent: SessionAgent): boolean {
  if (agent.role === 'owner') return true
  return listing.createdById === agent.id
}

/**
 * 매물을 API 응답용으로 직렬화. 본인이 아닌 같은 사무소 member는
 * owner 정보를 마스킹하고 privateMemo는 응답에서 제외한다.
 */
export function projectListing(listing: ListingLike, viewer: SessionAgent): Record<string, unknown> {
  const isSelf = listing.createdById === viewer.id
  const isOwner = viewer.role === 'owner'
  const fullAccess = isSelf || isOwner

  const projected: Record<string, unknown> = {
    ...listing,
    salePrice: bigToStr(listing.salePrice),
    deposit: bigToStr(listing.deposit),
    monthlyRent: bigToStr(listing.monthlyRent),
    contractedPrice: bigToStr(listing.contractedPrice),
    areaM2: decToNum(listing.areaM2),
    supplyAreaM2: decToNum(listing.supplyAreaM2),
    commissionRate: decToNum(listing.commissionRate),
  }

  if (!fullAccess) {
    projected.ownerName = maskName(listing.ownerName)
    projected.ownerPhone = maskPhone(listing.ownerPhone)
    projected.ownerMemo = null
    delete projected.privateMemo
  }
  return projected
}
```

- [ ] **Step 4: 통과 확인**

```bash
npm test -- tests/lib-listing-helpers.test.ts
```
Expected: 10 passed (maskPhone 1 + maskName 1 + projectListing 5 + canWriteListing 3)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/listing-helpers.ts tests/lib-listing-helpers.test.ts
git commit -m "feat(lib): listing-helpers (projection + maskPhone + maskName + canWriteListing) + TDD"
```

### Task 5: uploads.ts — 파일 저장 헬퍼

**Files:**
- Create: `src/lib/uploads.ts`
- Create: `tests/lib-uploads.test.ts`
- Modify: `.gitignore`

- [ ] **Step 1: .gitignore에 업로드 디렉토리 추가**

`.gitignore` 끝에 추가:
```
# user uploads
public/uploads/
```

- [ ] **Step 2: 실패 테스트 작성**

`tests/lib-uploads.test.ts`:
```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { saveUpload, deleteUpload } from '@/lib/uploads'

let tmp: string
beforeEach(async () => {
  tmp = await mkdtemp(path.join(tmpdir(), 'le-uploads-'))
})
afterEach(async () => {
  await rm(tmp, { recursive: true, force: true })
})

describe('saveUpload', () => {
  it('파일 저장 + 안전한 파일명 + URL 반환', async () => {
    const buf = Buffer.from('hello world')
    const res = await saveUpload({
      baseDir: tmp,
      relativeDir: 'listings/123/photos',
      filename: 'photo.jpg',
      data: buf,
    })
    expect(res.url).toMatch(/^\/uploads\/listings\/123\/photos\/[a-f0-9]+\.jpg$/)
    expect(res.absolutePath.startsWith(tmp)).toBe(true)
    const written = await readFile(res.absolutePath)
    expect(written.equals(buf)).toBe(true)
  })

  it('확장자 보존', async () => {
    const r1 = await saveUpload({ baseDir: tmp, relativeDir: 'a', filename: 'x.PDF', data: Buffer.from('x') })
    expect(r1.url.endsWith('.pdf')).toBe(true)
    const r2 = await saveUpload({ baseDir: tmp, relativeDir: 'a', filename: 'x.webp', data: Buffer.from('x') })
    expect(r2.url.endsWith('.webp')).toBe(true)
  })

  it('확장자 없으면 .bin', async () => {
    const r = await saveUpload({ baseDir: tmp, relativeDir: 'a', filename: 'noext', data: Buffer.from('x') })
    expect(r.url.endsWith('.bin')).toBe(true)
  })
})

describe('deleteUpload', () => {
  it('URL로 파일 삭제', async () => {
    const saved = await saveUpload({ baseDir: tmp, relativeDir: 'a', filename: 'x.txt', data: Buffer.from('x') })
    await deleteUpload(tmp, saved.url)
    await expect(readFile(saved.absolutePath)).rejects.toThrow()
  })

  it('없는 파일은 조용히 무시', async () => {
    await expect(deleteUpload(tmp, '/uploads/a/nonexistent.txt')).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 3: 실패 확인**

```bash
npm test -- tests/lib-uploads.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 4: 구현**

`src/lib/uploads.ts`:
```typescript
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import path from 'node:path'

export const UPLOADS_ROOT = path.join(process.cwd(), 'public')
const PUBLIC_URL_PREFIX = '/uploads'

export interface SaveUploadInput {
  baseDir: string
  relativeDir: string  // 예: 'listings/123/photos'
  filename: string     // 원본 파일명 (확장자 추출용)
  data: Buffer | Uint8Array
}

export interface SaveUploadResult {
  url: string          // public URL (e.g. '/uploads/listings/123/photos/abc.jpg')
  absolutePath: string // 실제 파일 시스템 경로
}

function extOf(filename: string): string {
  const idx = filename.lastIndexOf('.')
  if (idx < 0 || idx === filename.length - 1) return '.bin'
  return '.' + filename.slice(idx + 1).toLowerCase()
}

export async function saveUpload(input: SaveUploadInput): Promise<SaveUploadResult> {
  const safeRel = input.relativeDir.replace(/\.\.|^\/+/g, '')
  const dirAbs = path.join(input.baseDir, 'uploads', safeRel)
  await mkdir(dirAbs, { recursive: true })
  const random = randomBytes(16).toString('hex')
  const ext = extOf(input.filename)
  const finalName = `${random}${ext}`
  const absolutePath = path.join(dirAbs, finalName)
  await writeFile(absolutePath, input.data)
  const url = `${PUBLIC_URL_PREFIX}/${safeRel}/${finalName}`
  return { url, absolutePath }
}

export async function deleteUpload(baseDir: string, url: string): Promise<void> {
  if (!url.startsWith(PUBLIC_URL_PREFIX + '/')) return
  const rel = url.slice(PUBLIC_URL_PREFIX.length + 1)  // 'listings/123/photos/abc.jpg'
  if (rel.includes('..')) return
  const absolutePath = path.join(baseDir, 'uploads', rel)
  try {
    await unlink(absolutePath)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
  }
}
```

- [ ] **Step 5: 통과 확인**

```bash
npm test -- tests/lib-uploads.test.ts
```
Expected: 5 passed

- [ ] **Step 6: 커밋**

```bash
git add src/lib/uploads.ts tests/lib-uploads.test.ts .gitignore
git commit -m "feat(lib): uploads 헬퍼 (saveUpload, deleteUpload) + .gitignore + TDD"
```

### Task 6: POST /api/listings — TDD (생성)

**Files:**
- Create: `src/app/api/listings/route.ts` (POST only for now; GET in Task 7)
- Create: `tests/api-listings-create.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/api-listings-create.test.ts`:
```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signupAgent } from './helpers'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { POST as createListing } from '@/app/api/listings/route'

beforeEach(async () => { await resetDb() })

async function authReq(cookie: string, body: object): Promise<Request> {
  return new Request('http://localhost/api/listings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(body),
  })
}

const baseBody = {
  title: '강남 래미안 30평',
  dealType: 'sale',
  propertyType: 'apartment',
  salePrice: '900000000',
  areaM2: 84.5,
  address: '서울 강남구 역삼동',
}

describe('POST /api/listings', () => {
  it('비로그인 → 401', async () => {
    const res = await createListing(new Request('http://localhost/api/listings', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(baseBody),
    }))
    expect(res.status).toBe(401)
  })

  it('정상 생성 → 200 + 생성자 본인이 createdById', async () => {
    const { agentId, agencyId, cookie } = await signupAgent(signupHandler)
    const res = await createListing(await authReq(cookie, baseBody))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toBe('강남 래미안 30평')
    expect(body.createdById).toBe(agentId)
    expect(body.agencyId).toBe(agencyId)
    expect(body.salePrice).toBe('900000000')
  })

  it('매매에 salePrice 없으면 400', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const { salePrice, ...rest } = baseBody
    void salePrice
    const res = await createListing(await authReq(cookie, rest))
    expect(res.status).toBe(400)
  })

  it('전세에 deposit 없으면 400', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const res = await createListing(await authReq(cookie, {
      ...baseBody, dealType: 'jeonse', salePrice: undefined,
    }))
    expect(res.status).toBe(400)
  })

  it('월세 — deposit + monthlyRent 둘 다 필수', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const res = await createListing(await authReq(cookie, {
      ...baseBody, dealType: 'wolse', salePrice: undefined, deposit: '50000000',
    }))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/api-listings-create.test.ts
```
Expected: FAIL

- [ ] **Step 3: 구현**

`src/app/api/listings/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, errorResponse } from '@/lib/auth-helpers'
import { createListingSchema } from '@/lib/validators'
import { projectListing } from '@/lib/listing-helpers'

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const me = await requireAuth(req)
    const input = createListingSchema.parse(await req.json())

    const created = await prisma.internalListing.create({
      data: {
        agencyId: me.agencyId,
        createdById: me.id,
        title: input.title,
        complexName: input.complexName ?? null,
        dong: input.dong ?? null,
        ho: input.ho ?? null,
        floor: input.floor ?? null,
        direction: input.direction ?? null,
        pyeongType: input.pyeongType ?? null,
        dealType: input.dealType,
        propertyType: input.propertyType,
        salePrice: input.salePrice ?? null,
        deposit: input.deposit ?? null,
        monthlyRent: input.monthlyRent ?? null,
        areaM2: input.areaM2,
        supplyAreaM2: input.supplyAreaM2 ?? null,
        address: input.address,
        roadAddress: input.roadAddress ?? null,
        addressDetail: input.addressDetail ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        maintenanceFee: input.maintenanceFee ?? null,
        availableMoveInDate: input.availableMoveInDate ?? null,
        ownerName: input.ownerName ?? null,
        ownerPhone: input.ownerPhone ?? null,
        ownerMemo: input.ownerMemo ?? null,
        commissionRate: input.commissionRate ?? null,
        description: input.description ?? null,
        privateMemo: input.privateMemo ?? null,
      },
    })
    return NextResponse.json(projectListing(created, me))
  } catch (err) {
    return errorResponse(err)
  }
}
```

- [ ] **Step 4: 통과 확인**

```bash
npm test -- tests/api-listings-create.test.ts
```
Expected: 5 passed

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/listings/route.ts tests/api-listings-create.test.ts
git commit -m "feat(api): POST /api/listings + 거래유형별 가격 필수 검증 + 테스트"
```

### Task 7: GET /api/listings (list) — TDD (페이지네이션, 필터, 마스킹)

**Files:**
- Modify: `src/app/api/listings/route.ts` (GET 추가)
- Create: `tests/api-listings-list.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/api-listings-list.test.ts`:
```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signupAgent, addMember } from './helpers'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { POST as loginHandler } from '@/app/api/auth/login/route'
import { POST as createListing, GET as listListings } from '@/app/api/listings/route'

beforeEach(async () => { await resetDb() })

async function loginCookie(email: string, password: string): Promise<string> {
  const r = await loginHandler(new Request('http://localhost/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }))
  return (r.headers.get('set-cookie') ?? '').match(/le_session=[^;]+/)?.[0] ?? ''
}

async function createOne(cookie: string, override: object = {}): Promise<number> {
  const r = await createListing(new Request('http://localhost/api/listings', {
    method: 'POST', headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      title: '매물',
      dealType: 'sale', propertyType: 'apartment',
      salePrice: '900000000', areaM2: 84.5, address: '주소',
      ownerName: '김철수', ownerPhone: '010-1234-5678', ownerMemo: '메모', privateMemo: '비공개',
      ...override,
    }),
  }))
  const body = await r.json()
  return body.id
}

describe('GET /api/listings', () => {
  it('비로그인 → 401', async () => {
    const r = await listListings(new Request('http://localhost/api/listings'))
    expect(r.status).toBe(401)
  })

  it('빈 목록 → []', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const r = await listListings(new Request('http://localhost/api/listings', { headers: { cookie } }))
    const body = await r.json()
    expect(body.data).toEqual([])
    expect(body.total).toBe(0)
  })

  it('내가 만든 매물 → 모든 필드 평문', async () => {
    const { cookie } = await signupAgent(signupHandler, { email: 'self@x.com', password: 'pw12345678' })
    await createOne(cookie)
    const r = await listListings(new Request('http://localhost/api/listings', { headers: { cookie } }))
    const body = await r.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].ownerName).toBe('김철수')
    expect(body.data[0].ownerPhone).toBe('010-1234-5678')
    expect(body.data[0].privateMemo).toBe('비공개')
  })

  it('다른 member의 매물 — owner 정보 마스킹, privateMemo 없음', async () => {
    const { agencyId, cookie: m1cookie } = await signupAgent(signupHandler, { email: 'm1@x.com', password: 'pw12345678' })
    await createOne(m1cookie)
    const m2email = `m2-${Date.now()}@x.com`
    const m2pw = 'pw12345678'
    await prisma.agent.create({
      data: { agencyId, name: 'M2', email: m2email, passwordHash: await hashPassword(m2pw), role: 'member' },
    })
    const m2cookie = await loginCookie(m2email, m2pw)
    const r = await listListings(new Request('http://localhost/api/listings', { headers: { cookie: m2cookie } }))
    const body = await r.json()
    expect(body.data[0].ownerName).toBe('김***')
    expect(body.data[0].ownerPhone).toMatch(/\*+5678$/)
    expect(body.data[0].ownerMemo).toBeNull()
    expect(body.data[0].privateMemo).toBeUndefined()
  })

  it('owner는 다른 멤버 매물도 평문', async () => {
    const { agencyId, cookie: ownerCookie } = await signupAgent(signupHandler, { email: 'owner@x.com', password: 'pw12345678' })
    const m = await addMember(agencyId)
    const mcookie = await loginCookie(m.email, m.password)
    await createOne(mcookie)
    const r = await listListings(new Request('http://localhost/api/listings', { headers: { cookie: ownerCookie } }))
    const body = await r.json()
    expect(body.data[0].ownerName).toBe('김철수')
    expect(body.data[0].privateMemo).toBe('비공개')
  })

  it('타사무소 매물은 보이지 않는다', async () => {
    const A = await signupAgent(signupHandler, { agencyName: 'A', email: 'a@x.com', password: 'pw12345678' })
    await createOne(A.cookie, { title: 'A매물' })
    const B = await signupAgent(signupHandler, { agencyName: 'B', email: 'b@x.com', password: 'pw12345678' })
    const r = await listListings(new Request('http://localhost/api/listings', { headers: { cookie: B.cookie } }))
    const body = await r.json()
    expect(body.data).toEqual([])
  })

  it('q 필터 — 제목·주소 부분일치', async () => {
    const { cookie } = await signupAgent(signupHandler, { email: 'q@x.com', password: 'pw12345678' })
    await createOne(cookie, { title: '강남 아파트' })
    await createOne(cookie, { title: '서초 빌라', address: '서울 서초구' })
    const r = await listListings(new Request('http://localhost/api/listings?q=강남', { headers: { cookie } }))
    const body = await r.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe('강남 아파트')
  })

  it('dealType 필터', async () => {
    const { cookie } = await signupAgent(signupHandler, { email: 'd@x.com', password: 'pw12345678' })
    await createOne(cookie)
    await createOne(cookie, { dealType: 'jeonse', salePrice: undefined, deposit: '500000000' })
    const r = await listListings(new Request('http://localhost/api/listings?dealType=jeonse', { headers: { cookie } }))
    const body = await r.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].dealType).toBe('jeonse')
  })

  it('페이지네이션 — limit=2, page=2', async () => {
    const { cookie } = await signupAgent(signupHandler, { email: 'p@x.com', password: 'pw12345678' })
    for (let i = 0; i < 5; i++) await createOne(cookie, { title: `t${i}` })
    const r = await listListings(new Request('http://localhost/api/listings?limit=2&page=2', { headers: { cookie } }))
    const body = await r.json()
    expect(body.data).toHaveLength(2)
    expect(body.total).toBe(5)
    expect(body.page).toBe(2)
    expect(body.limit).toBe(2)
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/api-listings-list.test.ts
```
Expected: FAIL

- [ ] **Step 3: 구현 — route.ts에 GET 추가**

`src/app/api/listings/route.ts`를 다음으로 전체 교체:
```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, errorResponse } from '@/lib/auth-helpers'
import { createListingSchema, listingQuerySchema } from '@/lib/validators'
import { projectListing } from '@/lib/listing-helpers'

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const me = await requireAuth(req)
    const input = createListingSchema.parse(await req.json())

    const created = await prisma.internalListing.create({
      data: {
        agencyId: me.agencyId,
        createdById: me.id,
        title: input.title,
        complexName: input.complexName ?? null,
        dong: input.dong ?? null,
        ho: input.ho ?? null,
        floor: input.floor ?? null,
        direction: input.direction ?? null,
        pyeongType: input.pyeongType ?? null,
        dealType: input.dealType,
        propertyType: input.propertyType,
        salePrice: input.salePrice ?? null,
        deposit: input.deposit ?? null,
        monthlyRent: input.monthlyRent ?? null,
        areaM2: input.areaM2,
        supplyAreaM2: input.supplyAreaM2 ?? null,
        address: input.address,
        roadAddress: input.roadAddress ?? null,
        addressDetail: input.addressDetail ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        maintenanceFee: input.maintenanceFee ?? null,
        availableMoveInDate: input.availableMoveInDate ?? null,
        ownerName: input.ownerName ?? null,
        ownerPhone: input.ownerPhone ?? null,
        ownerMemo: input.ownerMemo ?? null,
        commissionRate: input.commissionRate ?? null,
        description: input.description ?? null,
        privateMemo: input.privateMemo ?? null,
      },
    })
    return NextResponse.json(projectListing(created, me))
  } catch (err) {
    return errorResponse(err)
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const me = await requireAuth(req)
    const url = new URL(req.url)
    const query = listingQuerySchema.parse(Object.fromEntries(url.searchParams))

    const where = {
      agencyId: me.agencyId,
      ...(query.dealType && { dealType: query.dealType }),
      ...(query.status && { status: query.status }),
      ...(query.q && {
        OR: [
          { title: { contains: query.q } },
          { address: { contains: query.q } },
          { complexName: { contains: query.q } },
        ],
      }),
    }

    const [total, rows] = await Promise.all([
      prisma.internalListing.count({ where }),
      prisma.internalListing.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ])

    return NextResponse.json({
      data: rows.map((r) => projectListing(r, me)),
      total,
      page: query.page,
      limit: query.limit,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
```

- [ ] **Step 4: 통과 확인**

```bash
npm test -- tests/api-listings-list.test.ts
```
Expected: 9 passed

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/listings/route.ts tests/api-listings-list.test.ts
git commit -m "feat(api): GET /api/listings (목록·검색·필터·페이지네이션·마스킹) + 테스트"
```

### Task 8: GET /api/listings/[id] — TDD

**Files:**
- Create: `src/app/api/listings/[id]/route.ts` (GET only; PATCH/DELETE in next tasks)
- Create: `tests/api-listings-get.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/api-listings-get.test.ts`:
```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signupAgent } from './helpers'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { POST as createListing } from '@/app/api/listings/route'
import { GET as getListing } from '@/app/api/listings/[id]/route'

beforeEach(async () => { await resetDb() })

async function createOne(cookie: string, title = 'L'): Promise<number> {
  const r = await createListing(new Request('http://localhost/api/listings', {
    method: 'POST', headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      title, dealType: 'sale', propertyType: 'apartment',
      salePrice: '900000000', areaM2: 84.5, address: '주소', privateMemo: 'secret',
    }),
  }))
  return (await r.json()).id
}

describe('GET /api/listings/[id]', () => {
  it('정상 조회 — 본인이면 privateMemo 노출', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const id = await createOne(cookie)
    const r = await getListing(
      new Request(`http://localhost/api/listings/${id}`, { headers: { cookie } }),
      { params: Promise.resolve({ id: String(id) }) },
    )
    expect(r.status).toBe(200)
    const body = await r.json()
    expect(body.id).toBe(id)
    expect(body.privateMemo).toBe('secret')
  })

  it('비로그인 → 401', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const id = await createOne(cookie)
    const r = await getListing(
      new Request(`http://localhost/api/listings/${id}`),
      { params: Promise.resolve({ id: String(id) }) },
    )
    expect(r.status).toBe(401)
  })

  it('타사무소 매물 — 404', async () => {
    const A = await signupAgent(signupHandler, { agencyName: 'A', email: 'a@x.com', password: 'pw12345678' })
    const id = await createOne(A.cookie)
    const B = await signupAgent(signupHandler, { agencyName: 'B', email: 'b@x.com', password: 'pw12345678' })
    const r = await getListing(
      new Request(`http://localhost/api/listings/${id}`, { headers: { cookie: B.cookie } }),
      { params: Promise.resolve({ id: String(id) }) },
    )
    expect(r.status).toBe(404)
  })

  it('존재하지 않는 id → 404', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const r = await getListing(
      new Request(`http://localhost/api/listings/999999`, { headers: { cookie } }),
      { params: Promise.resolve({ id: '999999' }) },
    )
    expect(r.status).toBe(404)
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/api-listings-get.test.ts
```

- [ ] **Step 3: 구현**

`src/app/api/listings/[id]/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, errorResponse } from '@/lib/auth-helpers'
import { NotFoundError } from '@/lib/errors'
import { projectListing } from '@/lib/listing-helpers'

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const me = await requireAuth(req)
    const { id } = await ctx.params
    const targetId = Number(id)
    if (!Number.isFinite(targetId)) throw new NotFoundError('없는 매물입니다')

    const listing = await prisma.internalListing.findUnique({
      where: { id: targetId },
      include: { photos: { orderBy: { sortOrder: 'asc' } }, contracts: true },
    })
    if (!listing || listing.agencyId !== me.agencyId) {
      throw new NotFoundError('없는 매물입니다')
    }
    return NextResponse.json(projectListing(listing, me))
  } catch (err) {
    return errorResponse(err)
  }
}
```

- [ ] **Step 4: 통과 확인**

```bash
npm test -- tests/api-listings-get.test.ts
```
Expected: 4 passed

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/listings/\[id\]/route.ts tests/api-listings-get.test.ts
git commit -m "feat(api): GET /api/listings/[id] (사진·계약서 포함, 마스킹, tenancy) + 테스트"
```

### Task 9: PATCH /api/listings/[id] — TDD

**Files:**
- Modify: `src/app/api/listings/[id]/route.ts` (PATCH 추가)
- Create: `tests/api-listings-update.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/api-listings-update.test.ts`:
```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signupAgent, addMember } from './helpers'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { POST as loginHandler } from '@/app/api/auth/login/route'
import { POST as createListing } from '@/app/api/listings/route'
import { PATCH as updateListing } from '@/app/api/listings/[id]/route'

beforeEach(async () => { await resetDb() })

async function loginCookie(email: string, password: string): Promise<string> {
  const r = await loginHandler(new Request('http://localhost/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }))
  return (r.headers.get('set-cookie') ?? '').match(/le_session=[^;]+/)?.[0] ?? ''
}

async function createOne(cookie: string): Promise<number> {
  const r = await createListing(new Request('http://localhost/api/listings', {
    method: 'POST', headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      title: '초기', dealType: 'sale', propertyType: 'apartment',
      salePrice: '900000000', areaM2: 84.5, address: '주소',
    }),
  }))
  return (await r.json()).id
}

function patchReq(id: number, cookie: string, body: object): { req: Request; ctx: { params: Promise<{ id: string }> } } {
  return {
    req: new Request(`http://localhost/api/listings/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    }),
    ctx: { params: Promise.resolve({ id: String(id) }) },
  }
}

describe('PATCH /api/listings/[id]', () => {
  it('본인 → 200', async () => {
    const { cookie } = await signupAgent(signupHandler, { email: 'self@x.com', password: 'pw12345678' })
    const id = await createOne(cookie)
    const { req, ctx } = patchReq(id, cookie, { title: '변경됨' })
    const r = await updateListing(req, ctx)
    expect(r.status).toBe(200)
    const body = await r.json()
    expect(body.title).toBe('변경됨')
  })

  it('owner → 200 (다른 멤버 매물)', async () => {
    const { agencyId, cookie: ownerCookie } = await signupAgent(signupHandler, { email: 'o@x.com', password: 'pw12345678' })
    const m = await addMember(agencyId)
    const mcookie = await loginCookie(m.email, m.password)
    const id = await createOne(mcookie)
    const { req, ctx } = patchReq(id, ownerCookie, { title: 'owner수정' })
    const r = await updateListing(req, ctx)
    expect(r.status).toBe(200)
  })

  it('다른 member → 403', async () => {
    const { agencyId, cookie: m1cookie } = await signupAgent(signupHandler, { email: 'm1@x.com', password: 'pw12345678' })
    const id = await createOne(m1cookie)
    const m2 = await addMember(agencyId)
    const m2cookie = await loginCookie(m2.email, m2.password)
    const { req, ctx } = patchReq(id, m2cookie, { title: 'x' })
    const r = await updateListing(req, ctx)
    expect(r.status).toBe(403)
  })

  it('타사무소 → 404', async () => {
    const A = await signupAgent(signupHandler, { agencyName: 'A', email: 'a@x.com', password: 'pw12345678' })
    const id = await createOne(A.cookie)
    const B = await signupAgent(signupHandler, { agencyName: 'B', email: 'b@x.com', password: 'pw12345678' })
    const { req, ctx } = patchReq(id, B.cookie, { title: 'x' })
    const r = await updateListing(req, ctx)
    expect(r.status).toBe(404)
  })

  it('status=contracted + contractedPrice 갱신', async () => {
    const { cookie } = await signupAgent(signupHandler, { email: 'c@x.com', password: 'pw12345678' })
    const id = await createOne(cookie)
    const { req, ctx } = patchReq(id, cookie, { status: 'contracted', contractedPrice: '850000000' })
    const r = await updateListing(req, ctx)
    expect(r.status).toBe(200)
    const body = await r.json()
    expect(body.status).toBe('contracted')
    expect(body.contractedPrice).toBe('850000000')
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/api-listings-update.test.ts
```

- [ ] **Step 3: 구현 — route.ts에 PATCH 추가**

`src/app/api/listings/[id]/route.ts`를 다음으로 전체 교체:
```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, errorResponse } from '@/lib/auth-helpers'
import { NotFoundError, ForbiddenError } from '@/lib/errors'
import { projectListing, canWriteListing } from '@/lib/listing-helpers'
import { updateListingSchema } from '@/lib/validators'

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const me = await requireAuth(req)
    const { id } = await ctx.params
    const targetId = Number(id)
    if (!Number.isFinite(targetId)) throw new NotFoundError('없는 매물입니다')

    const listing = await prisma.internalListing.findUnique({
      where: { id: targetId },
      include: { photos: { orderBy: { sortOrder: 'asc' } }, contracts: true },
    })
    if (!listing || listing.agencyId !== me.agencyId) {
      throw new NotFoundError('없는 매물입니다')
    }
    return NextResponse.json(projectListing(listing, me))
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const me = await requireAuth(req)
    const { id } = await ctx.params
    const targetId = Number(id)
    if (!Number.isFinite(targetId)) throw new NotFoundError('없는 매물입니다')

    const existing = await prisma.internalListing.findUnique({ where: { id: targetId } })
    if (!existing || existing.agencyId !== me.agencyId) {
      throw new NotFoundError('없는 매물입니다')
    }
    if (!canWriteListing(existing, me)) {
      throw new ForbiddenError('본인 매물 또는 owner만 수정할 수 있습니다')
    }

    const input = updateListingSchema.parse(await req.json())

    const updated = await prisma.internalListing.update({
      where: { id: targetId },
      data: {
        title: input.title,
        complexName: input.complexName ?? undefined,
        dong: input.dong ?? undefined,
        ho: input.ho ?? undefined,
        floor: input.floor ?? undefined,
        direction: input.direction ?? undefined,
        pyeongType: input.pyeongType ?? undefined,
        dealType: input.dealType,
        propertyType: input.propertyType,
        salePrice: input.salePrice ?? undefined,
        deposit: input.deposit ?? undefined,
        monthlyRent: input.monthlyRent ?? undefined,
        areaM2: input.areaM2,
        supplyAreaM2: input.supplyAreaM2 ?? undefined,
        address: input.address,
        roadAddress: input.roadAddress ?? undefined,
        addressDetail: input.addressDetail ?? undefined,
        latitude: input.latitude ?? undefined,
        longitude: input.longitude ?? undefined,
        maintenanceFee: input.maintenanceFee ?? undefined,
        availableMoveInDate: input.availableMoveInDate ?? undefined,
        ownerName: input.ownerName ?? undefined,
        ownerPhone: input.ownerPhone ?? undefined,
        ownerMemo: input.ownerMemo ?? undefined,
        commissionRate: input.commissionRate ?? undefined,
        description: input.description ?? undefined,
        privateMemo: input.privateMemo ?? undefined,
        status: input.status,
        contractedAt: input.contractedAt ?? undefined,
        contractedPrice: input.contractedPrice ?? undefined,
      },
    })
    return NextResponse.json(projectListing(updated, me))
  } catch (err) {
    return errorResponse(err)
  }
}
```

- [ ] **Step 4: 통과 확인**

```bash
npm test -- tests/api-listings-update.test.ts
```
Expected: 5 passed

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/listings/\[id\]/route.ts tests/api-listings-update.test.ts
git commit -m "feat(api): PATCH /api/listings/[id] (본인/owner 가드) + 테스트"
```

### Task 10: DELETE /api/listings/[id] — TDD

**Files:**
- Modify: `src/app/api/listings/[id]/route.ts` (DELETE 추가)
- Create: `tests/api-listings-delete.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/api-listings-delete.test.ts`:
```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signupAgent, addMember } from './helpers'
import { prisma } from '@/lib/db'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { POST as loginHandler } from '@/app/api/auth/login/route'
import { POST as createListing } from '@/app/api/listings/route'
import { DELETE as deleteListing } from '@/app/api/listings/[id]/route'

beforeEach(async () => { await resetDb() })

async function loginCookie(email: string, password: string): Promise<string> {
  const r = await loginHandler(new Request('http://localhost/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }))
  return (r.headers.get('set-cookie') ?? '').match(/le_session=[^;]+/)?.[0] ?? ''
}

async function createOne(cookie: string): Promise<number> {
  const r = await createListing(new Request('http://localhost/api/listings', {
    method: 'POST', headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      title: 'L', dealType: 'sale', propertyType: 'apartment',
      salePrice: '900000000', areaM2: 84.5, address: '주소',
    }),
  }))
  return (await r.json()).id
}

function delReq(id: number, cookie: string) {
  return {
    req: new Request(`http://localhost/api/listings/${id}`, {
      method: 'DELETE', headers: { cookie },
    }),
    ctx: { params: Promise.resolve({ id: String(id) }) },
  }
}

describe('DELETE /api/listings/[id]', () => {
  it('본인 → 200, DB에서 삭제됨', async () => {
    const { cookie } = await signupAgent(signupHandler, { email: 'self@x.com', password: 'pw12345678' })
    const id = await createOne(cookie)
    const { req, ctx } = delReq(id, cookie)
    const r = await deleteListing(req, ctx)
    expect(r.status).toBe(200)
    const exists = await prisma.internalListing.findUnique({ where: { id } })
    expect(exists).toBeNull()
  })

  it('owner → 200 (다른 멤버 매물)', async () => {
    const { agencyId, cookie: ownerCookie } = await signupAgent(signupHandler, { email: 'o@x.com', password: 'pw12345678' })
    const m = await addMember(agencyId)
    const mcookie = await loginCookie(m.email, m.password)
    const id = await createOne(mcookie)
    const { req, ctx } = delReq(id, ownerCookie)
    const r = await deleteListing(req, ctx)
    expect(r.status).toBe(200)
  })

  it('다른 member → 403', async () => {
    const { agencyId, cookie: m1cookie } = await signupAgent(signupHandler, { email: 'm1@x.com', password: 'pw12345678' })
    const id = await createOne(m1cookie)
    const m2 = await addMember(agencyId)
    const m2cookie = await loginCookie(m2.email, m2.password)
    const { req, ctx } = delReq(id, m2cookie)
    const r = await deleteListing(req, ctx)
    expect(r.status).toBe(403)
  })

  it('타사무소 → 404', async () => {
    const A = await signupAgent(signupHandler, { agencyName: 'A', email: 'a@x.com', password: 'pw12345678' })
    const id = await createOne(A.cookie)
    const B = await signupAgent(signupHandler, { agencyName: 'B', email: 'b@x.com', password: 'pw12345678' })
    const { req, ctx } = delReq(id, B.cookie)
    const r = await deleteListing(req, ctx)
    expect(r.status).toBe(404)
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/api-listings-delete.test.ts
```

- [ ] **Step 3: 구현 — route.ts에 DELETE 추가**

`src/app/api/listings/[id]/route.ts`의 PATCH 함수 뒤에 다음을 추가:
```typescript

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const me = await requireAuth(req)
    const { id } = await ctx.params
    const targetId = Number(id)
    if (!Number.isFinite(targetId)) throw new NotFoundError('없는 매물입니다')

    const existing = await prisma.internalListing.findUnique({ where: { id: targetId } })
    if (!existing || existing.agencyId !== me.agencyId) {
      throw new NotFoundError('없는 매물입니다')
    }
    if (!canWriteListing(existing, me)) {
      throw new ForbiddenError('본인 매물 또는 owner만 삭제할 수 있습니다')
    }

    await prisma.internalListing.delete({ where: { id: targetId } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
```

- [ ] **Step 4: 통과 확인**

```bash
npm test -- tests/api-listings-delete.test.ts
```
Expected: 4 passed

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/listings/\[id\]/route.ts tests/api-listings-delete.test.ts
git commit -m "feat(api): DELETE /api/listings/[id] (본인/owner 가드) + 테스트"
```

### Task 11: POST + DELETE /api/listings/[id]/photos — TDD

**Files:**
- Create: `src/app/api/listings/[id]/photos/route.ts`
- Create: `src/app/api/listings/[id]/photos/[pid]/route.ts`
- Create: `tests/api-listings-photos.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/api-listings-photos.test.ts`:
```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { resetDb, signupAgent } from './helpers'
import { prisma } from '@/lib/db'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { POST as createListing } from '@/app/api/listings/route'
import { POST as uploadPhoto } from '@/app/api/listings/[id]/photos/route'
import { DELETE as deletePhoto } from '@/app/api/listings/[id]/photos/[pid]/route'

let baseDir: string
beforeEach(async () => {
  await resetDb()
  baseDir = await mkdtemp(path.join(tmpdir(), 'le-photos-'))
  process.env.UPLOADS_BASE_DIR = baseDir
})
afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true }).catch(() => {})
})

async function createOne(cookie: string): Promise<number> {
  const r = await createListing(new Request('http://localhost/api/listings', {
    method: 'POST', headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      title: 'L', dealType: 'sale', propertyType: 'apartment',
      salePrice: '900000000', areaM2: 84.5, address: '주소',
    }),
  }))
  return (await r.json()).id
}

function photoFormData(filename: string, caption?: string): FormData {
  const fd = new FormData()
  const blob = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10])], { type: 'image/png' })  // PNG magic bytes
  fd.append('file', blob, filename)
  if (caption) fd.append('caption', caption)
  return fd
}

describe('POST /api/listings/[id]/photos', () => {
  it('정상 업로드 → 200 + ListingPhoto row', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const id = await createOne(cookie)
    const fd = photoFormData('living.png', '거실')
    const r = await uploadPhoto(
      new Request(`http://localhost/api/listings/${id}/photos`, {
        method: 'POST', headers: { cookie }, body: fd,
      }),
      { params: Promise.resolve({ id: String(id) }) },
    )
    expect(r.status).toBe(200)
    const body = await r.json()
    expect(body.url).toMatch(/^\/uploads\/listings\/\d+\/photos\/.+\.png$/)
    expect(body.caption).toBe('거실')
    const rows = await prisma.listingPhoto.findMany({ where: { listingId: id } })
    expect(rows).toHaveLength(1)
  })

  it('5MB 초과 → 413', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const id = await createOne(cookie)
    const big = new Uint8Array(6 * 1024 * 1024)
    const fd = new FormData()
    fd.append('file', new Blob([big], { type: 'image/png' }), 'big.png')
    const r = await uploadPhoto(
      new Request(`http://localhost/api/listings/${id}/photos`, {
        method: 'POST', headers: { cookie }, body: fd,
      }),
      { params: Promise.resolve({ id: String(id) }) },
    )
    expect(r.status).toBe(413)
  })

  it('허용 안 되는 mime → 415', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const id = await createOne(cookie)
    const fd = new FormData()
    fd.append('file', new Blob(['x'], { type: 'application/pdf' }), 'a.pdf')
    const r = await uploadPhoto(
      new Request(`http://localhost/api/listings/${id}/photos`, {
        method: 'POST', headers: { cookie }, body: fd,
      }),
      { params: Promise.resolve({ id: String(id) }) },
    )
    expect(r.status).toBe(415)
  })

  it('타사무소 매물 → 404', async () => {
    const A = await signupAgent(signupHandler, { agencyName: 'A', email: 'a@x.com', password: 'pw12345678' })
    const id = await createOne(A.cookie)
    const B = await signupAgent(signupHandler, { agencyName: 'B', email: 'b@x.com', password: 'pw12345678' })
    const r = await uploadPhoto(
      new Request(`http://localhost/api/listings/${id}/photos`, {
        method: 'POST', headers: { cookie: B.cookie }, body: photoFormData('a.png'),
      }),
      { params: Promise.resolve({ id: String(id) }) },
    )
    expect(r.status).toBe(404)
  })
})

describe('DELETE /api/listings/[id]/photos/[pid]', () => {
  it('정상 삭제 → 200 + row 사라짐', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const id = await createOne(cookie)
    const up = await uploadPhoto(
      new Request(`http://localhost/api/listings/${id}/photos`, {
        method: 'POST', headers: { cookie }, body: photoFormData('a.png'),
      }),
      { params: Promise.resolve({ id: String(id) }) },
    )
    const upBody = await up.json()
    const pid = upBody.id

    const r = await deletePhoto(
      new Request(`http://localhost/api/listings/${id}/photos/${pid}`, {
        method: 'DELETE', headers: { cookie },
      }),
      { params: Promise.resolve({ id: String(id), pid: String(pid) }) },
    )
    expect(r.status).toBe(200)
    const remaining = await prisma.listingPhoto.findMany({ where: { listingId: id } })
    expect(remaining).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/api-listings-photos.test.ts
```

- [ ] **Step 3: photos POST 라우트 구현**

`src/app/api/listings/[id]/photos/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import path from 'node:path'
import { prisma } from '@/lib/db'
import { requireAuth, errorResponse } from '@/lib/auth-helpers'
import { NotFoundError, ForbiddenError } from '@/lib/errors'
import { canWriteListing } from '@/lib/listing-helpers'
import { saveUpload, UPLOADS_ROOT } from '@/lib/uploads'

const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

function uploadsBaseDir(): string {
  return process.env.UPLOADS_BASE_DIR ?? UPLOADS_ROOT
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const me = await requireAuth(req)
    const { id } = await ctx.params
    const targetId = Number(id)
    if (!Number.isFinite(targetId)) throw new NotFoundError('없는 매물입니다')

    const existing = await prisma.internalListing.findUnique({ where: { id: targetId } })
    if (!existing || existing.agencyId !== me.agencyId) {
      throw new NotFoundError('없는 매물입니다')
    }
    if (!canWriteListing(existing, me)) {
      throw new ForbiddenError('본인 매물 또는 owner만 사진을 추가할 수 있습니다')
    }

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: { code: 'VALIDATION', message: 'file 필드가 필요합니다' } }, { status: 400 })
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: { code: 'UNSUPPORTED_TYPE', message: 'jpg/png/webp만 허용됩니다' } }, { status: 415 })
    }
    const buf = Buffer.from(await file.arrayBuffer())
    if (buf.byteLength > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: { code: 'TOO_LARGE', message: '5MB 이하만 허용됩니다' } }, { status: 413 })
    }
    const caption = String(form.get('caption') ?? '')
    const originalName = file instanceof File ? file.name : 'photo.bin'

    const saved = await saveUpload({
      baseDir: uploadsBaseDir(),
      relativeDir: path.posix.join('listings', String(targetId), 'photos'),
      filename: originalName,
      data: buf,
    })

    const lastOrder = await prisma.listingPhoto.aggregate({
      where: { listingId: targetId },
      _max: { sortOrder: true },
    })
    const created = await prisma.listingPhoto.create({
      data: {
        listingId: targetId,
        url: saved.url,
        caption: caption || null,
        sortOrder: (lastOrder._max.sortOrder ?? -1) + 1,
      },
    })
    return NextResponse.json(created)
  } catch (err) {
    return errorResponse(err)
  }
}
```

- [ ] **Step 4: photos DELETE 라우트 구현**

`src/app/api/listings/[id]/photos/[pid]/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, errorResponse } from '@/lib/auth-helpers'
import { NotFoundError, ForbiddenError } from '@/lib/errors'
import { canWriteListing } from '@/lib/listing-helpers'
import { deleteUpload, UPLOADS_ROOT } from '@/lib/uploads'

function uploadsBaseDir(): string {
  return process.env.UPLOADS_BASE_DIR ?? UPLOADS_ROOT
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; pid: string }> },
): Promise<NextResponse> {
  try {
    const me = await requireAuth(req)
    const { id, pid } = await ctx.params
    const listingId = Number(id)
    const photoId = Number(pid)
    if (!Number.isFinite(listingId) || !Number.isFinite(photoId)) {
      throw new NotFoundError('없는 사진입니다')
    }

    const photo = await prisma.listingPhoto.findUnique({
      where: { id: photoId },
      include: { listing: true },
    })
    if (!photo || photo.listingId !== listingId || photo.listing.agencyId !== me.agencyId) {
      throw new NotFoundError('없는 사진입니다')
    }
    if (!canWriteListing(photo.listing, me)) {
      throw new ForbiddenError('본인 매물 또는 owner만 사진을 삭제할 수 있습니다')
    }

    await prisma.listingPhoto.delete({ where: { id: photoId } })
    await deleteUpload(uploadsBaseDir(), photo.url)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
```

- [ ] **Step 5: 통과 확인**

```bash
npm test -- tests/api-listings-photos.test.ts
```
Expected: 5 passed

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/listings/\[id\]/photos/ tests/api-listings-photos.test.ts
git commit -m "feat(api): 사진 POST/DELETE (5MB·image/* 제한, FormData) + 테스트"
```

### Task 12: POST + DELETE /api/listings/[id]/contracts — TDD

**Files:**
- Create: `src/app/api/listings/[id]/contracts/route.ts`
- Create: `src/app/api/listings/[id]/contracts/[cid]/route.ts`
- Create: `tests/api-listings-contracts.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/api-listings-contracts.test.ts`:
```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { resetDb, signupAgent } from './helpers'
import { prisma } from '@/lib/db'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { POST as createListing } from '@/app/api/listings/route'
import { POST as uploadContract } from '@/app/api/listings/[id]/contracts/route'
import { DELETE as deleteContract } from '@/app/api/listings/[id]/contracts/[cid]/route'

let baseDir: string
beforeEach(async () => {
  await resetDb()
  baseDir = await mkdtemp(path.join(tmpdir(), 'le-contracts-'))
  process.env.UPLOADS_BASE_DIR = baseDir
})
afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true }).catch(() => {})
})

async function createOne(cookie: string): Promise<number> {
  const r = await createListing(new Request('http://localhost/api/listings', {
    method: 'POST', headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      title: 'L', dealType: 'sale', propertyType: 'apartment',
      salePrice: '900000000', areaM2: 84.5, address: '주소',
    }),
  }))
  return (await r.json()).id
}

function contractForm(filename: string, mime: string, bytes = 100): FormData {
  const fd = new FormData()
  fd.append('file', new Blob([new Uint8Array(bytes)], { type: mime }), filename)
  return fd
}

describe('POST /api/listings/[id]/contracts', () => {
  it('PDF 업로드 → 200', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const id = await createOne(cookie)
    const r = await uploadContract(
      new Request(`http://localhost/api/listings/${id}/contracts`, {
        method: 'POST', headers: { cookie }, body: contractForm('계약서.pdf', 'application/pdf'),
      }),
      { params: Promise.resolve({ id: String(id) }) },
    )
    expect(r.status).toBe(200)
    const body = await r.json()
    expect(body.filename).toBe('계약서.pdf')
    expect(body.url).toMatch(/\.pdf$/)
    const rows = await prisma.listingContract.findMany({ where: { listingId: id } })
    expect(rows).toHaveLength(1)
  })

  it('10MB 초과 → 413', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const id = await createOne(cookie)
    const r = await uploadContract(
      new Request(`http://localhost/api/listings/${id}/contracts`, {
        method: 'POST', headers: { cookie }, body: contractForm('big.pdf', 'application/pdf', 11 * 1024 * 1024),
      }),
      { params: Promise.resolve({ id: String(id) }) },
    )
    expect(r.status).toBe(413)
  })

  it('exe 같은 위험한 mime → 415', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const id = await createOne(cookie)
    const r = await uploadContract(
      new Request(`http://localhost/api/listings/${id}/contracts`, {
        method: 'POST', headers: { cookie }, body: contractForm('mal.exe', 'application/x-msdownload'),
      }),
      { params: Promise.resolve({ id: String(id) }) },
    )
    expect(r.status).toBe(415)
  })
})

describe('DELETE /api/listings/[id]/contracts/[cid]', () => {
  it('정상 삭제', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const id = await createOne(cookie)
    const up = await uploadContract(
      new Request(`http://localhost/api/listings/${id}/contracts`, {
        method: 'POST', headers: { cookie }, body: contractForm('a.pdf', 'application/pdf'),
      }),
      { params: Promise.resolve({ id: String(id) }) },
    )
    const cid = (await up.json()).id

    const r = await deleteContract(
      new Request(`http://localhost/api/listings/${id}/contracts/${cid}`, {
        method: 'DELETE', headers: { cookie },
      }),
      { params: Promise.resolve({ id: String(id), cid: String(cid) }) },
    )
    expect(r.status).toBe(200)
    const remaining = await prisma.listingContract.findMany({ where: { listingId: id } })
    expect(remaining).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/api-listings-contracts.test.ts
```

- [ ] **Step 3: contracts POST 구현**

`src/app/api/listings/[id]/contracts/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import path from 'node:path'
import { prisma } from '@/lib/db'
import { requireAuth, errorResponse } from '@/lib/auth-helpers'
import { NotFoundError, ForbiddenError } from '@/lib/errors'
import { canWriteListing } from '@/lib/listing-helpers'
import { saveUpload, UPLOADS_ROOT } from '@/lib/uploads'

const MAX_CONTRACT_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

function uploadsBaseDir(): string {
  return process.env.UPLOADS_BASE_DIR ?? UPLOADS_ROOT
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const me = await requireAuth(req)
    const { id } = await ctx.params
    const targetId = Number(id)
    if (!Number.isFinite(targetId)) throw new NotFoundError('없는 매물입니다')

    const existing = await prisma.internalListing.findUnique({ where: { id: targetId } })
    if (!existing || existing.agencyId !== me.agencyId) {
      throw new NotFoundError('없는 매물입니다')
    }
    if (!canWriteListing(existing, me)) {
      throw new ForbiddenError('본인 매물 또는 owner만 계약서를 추가할 수 있습니다')
    }

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: { code: 'VALIDATION', message: 'file 필드가 필요합니다' } }, { status: 400 })
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: { code: 'UNSUPPORTED_TYPE', message: 'pdf/jpg/png/webp만 허용됩니다' } }, { status: 415 })
    }
    const buf = Buffer.from(await file.arrayBuffer())
    if (buf.byteLength > MAX_CONTRACT_BYTES) {
      return NextResponse.json({ error: { code: 'TOO_LARGE', message: '10MB 이하만 허용됩니다' } }, { status: 413 })
    }
    const originalName = file instanceof File ? file.name : 'contract.bin'

    const saved = await saveUpload({
      baseDir: uploadsBaseDir(),
      relativeDir: path.posix.join('listings', String(targetId), 'contracts'),
      filename: originalName,
      data: buf,
    })

    const created = await prisma.listingContract.create({
      data: {
        listingId: targetId,
        url: saved.url,
        filename: originalName,
      },
    })
    return NextResponse.json(created)
  } catch (err) {
    return errorResponse(err)
  }
}
```

- [ ] **Step 4: contracts DELETE 구현**

`src/app/api/listings/[id]/contracts/[cid]/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, errorResponse } from '@/lib/auth-helpers'
import { NotFoundError, ForbiddenError } from '@/lib/errors'
import { canWriteListing } from '@/lib/listing-helpers'
import { deleteUpload, UPLOADS_ROOT } from '@/lib/uploads'

function uploadsBaseDir(): string {
  return process.env.UPLOADS_BASE_DIR ?? UPLOADS_ROOT
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; cid: string }> },
): Promise<NextResponse> {
  try {
    const me = await requireAuth(req)
    const { id, cid } = await ctx.params
    const listingId = Number(id)
    const contractId = Number(cid)
    if (!Number.isFinite(listingId) || !Number.isFinite(contractId)) {
      throw new NotFoundError('없는 계약서입니다')
    }

    const contract = await prisma.listingContract.findUnique({
      where: { id: contractId },
      include: { listing: true },
    })
    if (!contract || contract.listingId !== listingId || contract.listing.agencyId !== me.agencyId) {
      throw new NotFoundError('없는 계약서입니다')
    }
    if (!canWriteListing(contract.listing, me)) {
      throw new ForbiddenError('본인 매물 또는 owner만 계약서를 삭제할 수 있습니다')
    }

    await prisma.listingContract.delete({ where: { id: contractId } })
    await deleteUpload(uploadsBaseDir(), contract.url)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
```

- [ ] **Step 5: 통과 확인**

```bash
npm test -- tests/api-listings-contracts.test.ts
```
Expected: 4 passed

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/listings/\[id\]/contracts/ tests/api-listings-contracts.test.ts
git commit -m "feat(api): 계약서 POST/DELETE (10MB·pdf/img 제한, FormData) + 테스트"
```

### Task 13: 프론트엔드 API 클라이언트 (listings)

**Files:**
- Create: `src/lib/api/listings.ts`

- [ ] **Step 1: 작성**

`src/lib/api/listings.ts`:
```typescript
import { apiFetch } from '@/lib/api-client'

export interface ListingSummary {
  id: number
  agencyId: number
  createdById: number
  title: string
  complexName: string | null
  address: string
  dealType: 'sale' | 'jeonse' | 'wolse'
  propertyType: 'apartment' | 'officetel' | 'villa' | 'house' | 'commercial' | 'land'
  status: 'active' | 'contracted' | 'hidden'
  salePrice: string | null
  deposit: string | null
  monthlyRent: string | null
  areaM2: number
  createdAt: string
}

export interface ListingPhoto {
  id: number
  url: string
  caption: string | null
  sortOrder: number
}
export interface ListingContract {
  id: number
  url: string
  filename: string
  uploadedAt: string
}

export interface ListingDetail extends ListingSummary {
  dong: string | null
  ho: string | null
  floor: string | null
  direction: string | null
  pyeongType: string | null
  supplyAreaM2: number | null
  roadAddress: string | null
  addressDetail: string | null
  latitude: number | null
  longitude: number | null
  maintenanceFee: number | null
  availableMoveInDate: string | null
  ownerName: string | null
  ownerPhone: string | null
  ownerMemo: string | null
  commissionRate: number | null
  description: string | null
  privateMemo?: string  // 본인/owner에게만 노출
  contractedAt: string | null
  contractedPrice: string | null
  photos: ListingPhoto[]
  contracts: ListingContract[]
  updatedAt: string
}

export interface ListingsQuery {
  q?: string
  dealType?: 'sale' | 'jeonse' | 'wolse'
  status?: 'active' | 'contracted' | 'hidden'
  page?: number
  limit?: number
}

export interface ListingsResponse {
  data: ListingSummary[]
  total: number
  page: number
  limit: number
}

export function listListings(query: ListingsQuery = {}): Promise<ListingsResponse> {
  const sp = new URLSearchParams()
  if (query.q) sp.set('q', query.q)
  if (query.dealType) sp.set('dealType', query.dealType)
  if (query.status) sp.set('status', query.status)
  if (query.page) sp.set('page', String(query.page))
  if (query.limit) sp.set('limit', String(query.limit))
  const qs = sp.toString()
  return apiFetch<ListingsResponse>(`/listings${qs ? `?${qs}` : ''}`)
}

export function getListing(id: number): Promise<ListingDetail> {
  return apiFetch<ListingDetail>(`/listings/${id}`)
}

export function createListing(body: Record<string, unknown>): Promise<ListingDetail> {
  return apiFetch<ListingDetail>('/listings', { method: 'POST', body: JSON.stringify(body) })
}

export function updateListing(id: number, body: Record<string, unknown>): Promise<ListingDetail> {
  return apiFetch<ListingDetail>(`/listings/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteListing(id: number): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/listings/${id}`, { method: 'DELETE' })
}

export async function uploadPhoto(id: number, file: File, caption?: string): Promise<ListingPhoto> {
  const fd = new FormData()
  fd.append('file', file)
  if (caption) fd.append('caption', caption)
  const res = await fetch(`/api/listings/${id}/photos`, { method: 'POST', credentials: 'include', body: fd })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? '사진 업로드 실패')
  }
  return res.json()
}

export function deletePhoto(listingId: number, photoId: number): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/listings/${listingId}/photos/${photoId}`, { method: 'DELETE' })
}

export async function uploadContract(id: number, file: File): Promise<ListingContract> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`/api/listings/${id}/contracts`, { method: 'POST', credentials: 'include', body: fd })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? '계약서 업로드 실패')
  }
  return res.json()
}

export function deleteContract(listingId: number, contractId: number): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/listings/${listingId}/contracts/${contractId}`, { method: 'DELETE' })
}
```

- [ ] **Step 2: TS 검증**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 커밋**

```bash
git add src/lib/api/listings.ts
git commit -m "feat(lib): listings API 클라이언트"
```

### Task 14: /listings 목록 페이지

**Files:**
- Create: `src/app/(app)/listings/page.tsx`
- Create: `src/components/listings/ListingFilters.tsx`
- Create: `src/components/listings/ListingTable.tsx`

- [ ] **Step 1: ListingFilters**

`src/components/listings/ListingFilters.tsx`:
```typescript
'use client'

import { Search } from 'lucide-react'
import type { ListingsQuery } from '@/lib/api/listings'

interface Props {
  query: ListingsQuery
  onChange: (next: Partial<ListingsQuery>) => void
}

const input = 'px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'

export function ListingFilters({ query, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-text-muted" />
        <input
          className={`${input} pl-9 w-64`}
          placeholder="제목·주소·단지명 검색"
          value={query.q ?? ''}
          onChange={(e) => onChange({ q: e.target.value || undefined, page: 1 })}
        />
      </div>
      <select
        className={input}
        value={query.dealType ?? ''}
        onChange={(e) => onChange({ dealType: (e.target.value || undefined) as ListingsQuery['dealType'], page: 1 })}
      >
        <option value="">거래유형 전체</option>
        <option value="sale">매매</option>
        <option value="jeonse">전세</option>
        <option value="wolse">월세</option>
      </select>
      <select
        className={input}
        value={query.status ?? ''}
        onChange={(e) => onChange({ status: (e.target.value || undefined) as ListingsQuery['status'], page: 1 })}
      >
        <option value="">상태 전체</option>
        <option value="active">거래중</option>
        <option value="contracted">거래완료</option>
        <option value="hidden">숨김</option>
      </select>
    </div>
  )
}
```

- [ ] **Step 2: ListingTable**

`src/components/listings/ListingTable.tsx`:
```typescript
'use client'

import Link from 'next/link'
import type { ListingSummary } from '@/lib/api/listings'

const dealLabels: Record<string, string> = { sale: '매매', jeonse: '전세', wolse: '월세' }
const dealColors: Record<string, string> = {
  sale: 'bg-hud-accent-primary/20 text-hud-accent-primary',
  jeonse: 'bg-hud-accent-info/20 text-hud-accent-info',
  wolse: 'bg-hud-accent-warning/20 text-hud-accent-warning',
}
const statusLabels: Record<string, string> = { active: '거래중', contracted: '거래완료', hidden: '숨김' }
const statusColors: Record<string, string> = {
  active: 'bg-hud-accent-success/20 text-hud-accent-success',
  contracted: 'bg-hud-bg-secondary text-hud-text-muted',
  hidden: 'bg-hud-bg-secondary text-hud-text-muted',
}

function formatPrice(won: string | null): string {
  if (won == null) return '-'
  const n = BigInt(won)
  if (n < 10_000n) return `${n.toString()}원`
  if (n < 100_000_000n) return `${(n / 10_000n).toString()}만`
  const eok = n / 100_000_000n
  const man = (n % 100_000_000n) / 10_000n
  return man > 0n ? `${eok.toString()}억 ${man.toString()}만` : `${eok.toString()}억`
}

interface Props {
  rows: ListingSummary[]
  loading: boolean
}

export function ListingTable({ rows, loading }: Props) {
  if (loading) return <p className="p-6 text-hud-text-muted">불러오는 중...</p>
  if (rows.length === 0) return <p className="p-6 text-hud-text-muted">매물이 없습니다.</p>
  return (
    <table className="w-full text-sm">
      <thead className="bg-hud-bg-secondary border-b border-hud-border-secondary text-left text-hud-text-secondary">
        <tr>
          <th className="px-4 py-3 font-medium">제목</th>
          <th className="px-4 py-3 font-medium">거래</th>
          <th className="px-4 py-3 font-medium">가격</th>
          <th className="px-4 py-3 font-medium">면적</th>
          <th className="px-4 py-3 font-medium">상태</th>
          <th className="px-4 py-3 font-medium">주소</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-hud-border-secondary">
        {rows.map((r) => (
          <tr key={r.id} className="hover:bg-hud-bg-hover transition-hud">
            <td className="px-4 py-3">
              <Link href={`/listings/${r.id}`} className="text-hud-accent-primary hover:underline">
                {r.title}
              </Link>
              {r.complexName && <div className="text-xs text-hud-text-muted">{r.complexName}</div>}
            </td>
            <td className="px-4 py-3">
              <span className={`text-xs px-2 py-0.5 rounded ${dealColors[r.dealType]}`}>
                {dealLabels[r.dealType]}
              </span>
            </td>
            <td className="px-4 py-3 font-mono text-hud-text-primary">
              {r.dealType === 'sale' && formatPrice(r.salePrice)}
              {r.dealType === 'jeonse' && formatPrice(r.deposit)}
              {r.dealType === 'wolse' && `${formatPrice(r.deposit)} / 월 ${formatPrice(r.monthlyRent)}`}
            </td>
            <td className="px-4 py-3 text-hud-text-secondary">{r.areaM2}㎡</td>
            <td className="px-4 py-3">
              <span className={`text-xs px-2 py-0.5 rounded ${statusColors[r.status]}`}>
                {statusLabels[r.status]}
              </span>
            </td>
            <td className="px-4 py-3 text-hud-text-secondary truncate max-w-xs">{r.address}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 3: 페이지**

`src/app/(app)/listings/page.tsx`:
```typescript
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building, Plus } from 'lucide-react'
import Button from '@/components/common/Button'
import { ListingFilters } from '@/components/listings/ListingFilters'
import { ListingTable } from '@/components/listings/ListingTable'
import { listListings, type ListingsQuery, type ListingsResponse } from '@/lib/api/listings'

export default function ListingsPage() {
  const [query, setQuery] = useState<ListingsQuery>({ page: 1, limit: 20 })
  const [data, setData] = useState<ListingsResponse>({ data: [], total: 0, page: 1, limit: 20 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    listListings(query)
      .then((r) => { if (!cancelled) setData(r) })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [query])

  const change = (next: Partial<ListingsQuery>) => setQuery((q) => ({ ...q, ...next }))
  const totalPages = Math.max(1, Math.ceil(data.total / (query.limit ?? 20)))

  return (
    <div className="p-6 text-hud-text-primary">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building size={24} className="text-hud-accent-primary" />
          <h1 className="text-2xl font-bold">내부 매물</h1>
          <span className="text-hud-text-muted text-sm">{data.total}건</span>
        </div>
        <Link href="/listings/new">
          <Button variant="primary" glow leftIcon={<Plus size={16} />}>매물 등록</Button>
        </Link>
      </div>

      <div className="mb-4">
        <ListingFilters query={query} onChange={change} />
      </div>

      {error && <p className="text-sm text-hud-accent-danger mb-4">{error}</p>}

      <div className="hud-card rounded-lg overflow-hidden">
        <ListingTable rows={data.data} loading={loading} />
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            className="px-3 py-1 text-sm text-hud-text-secondary disabled:opacity-30"
            disabled={(query.page ?? 1) <= 1}
            onClick={() => change({ page: (query.page ?? 1) - 1 })}
          >이전</button>
          <span className="text-sm text-hud-text-muted">{query.page ?? 1} / {totalPages}</span>
          <button
            className="px-3 py-1 text-sm text-hud-text-secondary disabled:opacity-30"
            disabled={(query.page ?? 1) >= totalPages}
            onClick={() => change({ page: (query.page ?? 1) + 1 })}
          >다음</button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 빌드**

```bash
npm run build
```

- [ ] **Step 5: 커밋**

```bash
git add src/app/\(app\)/listings/page.tsx src/components/listings/
git commit -m "feat(ui): /listings 목록 페이지 + ListingFilters + ListingTable"
```

### Task 15: ListingForm 공유 컴포넌트

**Files:**
- Create: `src/components/listings/ListingForm.tsx`

- [ ] **Step 1: 작성**

`src/components/listings/ListingForm.tsx`:
```typescript
'use client'

import { useState, type FormEvent } from 'react'
import Button from '@/components/common/Button'

export interface ListingFormValue {
  title: string
  complexName: string
  dong: string
  ho: string
  floor: string
  direction: string
  pyeongType: string
  dealType: 'sale' | 'jeonse' | 'wolse'
  propertyType: 'apartment' | 'officetel' | 'villa' | 'house' | 'commercial' | 'land'
  salePrice: string
  deposit: string
  monthlyRent: string
  areaM2: string
  supplyAreaM2: string
  address: string
  addressDetail: string
  maintenanceFee: string
  ownerName: string
  ownerPhone: string
  ownerMemo: string
  commissionRate: string
  description: string
  privateMemo: string
  status: 'active' | 'contracted' | 'hidden'
}

export const emptyForm: ListingFormValue = {
  title: '', complexName: '', dong: '', ho: '', floor: '', direction: '', pyeongType: '',
  dealType: 'sale', propertyType: 'apartment',
  salePrice: '', deposit: '', monthlyRent: '',
  areaM2: '', supplyAreaM2: '',
  address: '', addressDetail: '',
  maintenanceFee: '', ownerName: '', ownerPhone: '', ownerMemo: '',
  commissionRate: '', description: '', privateMemo: '', status: 'active',
}

const input = 'w-full px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'

interface Props {
  initial: ListingFormValue
  showStatus?: boolean
  submitLabel: string
  onSubmit: (payload: Record<string, unknown>) => Promise<void>
}

function num(v: string): number | undefined {
  if (v.trim() === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
function bigStr(v: string): string | undefined {
  if (v.trim() === '') return undefined
  if (!/^\d+$/.test(v.trim())) return undefined
  return v.trim()
}

function toPayload(f: ListingFormValue): Record<string, unknown> {
  return {
    title: f.title,
    complexName: f.complexName || undefined,
    dong: f.dong || undefined,
    ho: f.ho || undefined,
    floor: f.floor || undefined,
    direction: f.direction || undefined,
    pyeongType: f.pyeongType || undefined,
    dealType: f.dealType,
    propertyType: f.propertyType,
    salePrice: bigStr(f.salePrice),
    deposit: bigStr(f.deposit),
    monthlyRent: bigStr(f.monthlyRent),
    areaM2: num(f.areaM2),
    supplyAreaM2: num(f.supplyAreaM2),
    address: f.address,
    addressDetail: f.addressDetail || undefined,
    maintenanceFee: num(f.maintenanceFee),
    ownerName: f.ownerName || undefined,
    ownerPhone: f.ownerPhone || undefined,
    ownerMemo: f.ownerMemo || undefined,
    commissionRate: num(f.commissionRate),
    description: f.description || undefined,
    privateMemo: f.privateMemo || undefined,
    status: f.status,
  }
}

export default function ListingForm({ initial, showStatus = false, submitLabel, onSubmit }: Props) {
  const [form, setForm] = useState<ListingFormValue>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof ListingFormValue, v: string) => setForm((f) => ({ ...f, [k]: v } as ListingFormValue))

  const handle = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      await onSubmit(toPayload(form))
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handle} className="space-y-6">
      <Section title="식별">
        <Field label="제목 *"><input required className={input} value={form.title} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="단지명"><input className={input} value={form.complexName} onChange={(e) => set('complexName', e.target.value)} /></Field>
        <Field label="동"><input className={input} value={form.dong} onChange={(e) => set('dong', e.target.value)} /></Field>
        <Field label="호"><input className={input} value={form.ho} onChange={(e) => set('ho', e.target.value)} /></Field>
        <Field label="층"><input className={input} value={form.floor} onChange={(e) => set('floor', e.target.value)} /></Field>
        <Field label="평형명"><input className={input} value={form.pyeongType} onChange={(e) => set('pyeongType', e.target.value)} placeholder="예: 84A" /></Field>
        <Field label="향">
          <select className={input} value={form.direction} onChange={(e) => set('direction', e.target.value)}>
            <option value="">선택</option>
            <option value="north">북</option><option value="east">동</option>
            <option value="south">남</option><option value="west">서</option>
            <option value="northeast">북동</option><option value="southeast">남동</option>
            <option value="southwest">남서</option><option value="northwest">북서</option>
          </select>
        </Field>
      </Section>

      <Section title="거래">
        <Field label="거래유형 *">
          <select className={input} value={form.dealType} onChange={(e) => set('dealType', e.target.value)}>
            <option value="sale">매매</option><option value="jeonse">전세</option><option value="wolse">월세</option>
          </select>
        </Field>
        <Field label="매물종류 *">
          <select className={input} value={form.propertyType} onChange={(e) => set('propertyType', e.target.value)}>
            <option value="apartment">아파트</option><option value="officetel">오피스텔</option>
            <option value="villa">빌라/연립</option><option value="house">단독/다가구</option>
            <option value="commercial">상가</option><option value="land">토지</option>
          </select>
        </Field>
        {form.dealType === 'sale' && (
          <Field label="매매가 (원) *"><input type="number" className={input} value={form.salePrice} onChange={(e) => set('salePrice', e.target.value)} /></Field>
        )}
        {(form.dealType === 'jeonse' || form.dealType === 'wolse') && (
          <Field label="보증금 (원) *"><input type="number" className={input} value={form.deposit} onChange={(e) => set('deposit', e.target.value)} /></Field>
        )}
        {form.dealType === 'wolse' && (
          <Field label="월세 (원) *"><input type="number" className={input} value={form.monthlyRent} onChange={(e) => set('monthlyRent', e.target.value)} /></Field>
        )}
      </Section>

      <Section title="면적">
        <Field label="전용면적 (㎡) *"><input type="number" step="0.01" required className={input} value={form.areaM2} onChange={(e) => set('areaM2', e.target.value)} /></Field>
        <Field label="공급면적 (㎡)"><input type="number" step="0.01" className={input} value={form.supplyAreaM2} onChange={(e) => set('supplyAreaM2', e.target.value)} /></Field>
      </Section>

      <Section title="위치">
        <Field label="주소 *" wide><input required className={input} value={form.address} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label="상세주소" wide><input className={input} value={form.addressDetail} onChange={(e) => set('addressDetail', e.target.value)} /></Field>
      </Section>

      <Section title="메타">
        <Field label="관리비 (월, 원)"><input type="number" className={input} value={form.maintenanceFee} onChange={(e) => set('maintenanceFee', e.target.value)} /></Field>
        <Field label="중개수수료율 (%)"><input type="number" step="0.01" className={input} value={form.commissionRate} onChange={(e) => set('commissionRate', e.target.value)} /></Field>
        <Field label="소유자 이름"><input className={input} value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} /></Field>
        <Field label="소유자 전화"><input className={input} value={form.ownerPhone} onChange={(e) => set('ownerPhone', e.target.value)} placeholder="010-0000-0000" /></Field>
        <Field label="소유자 메모" wide><textarea className={input} rows={2} value={form.ownerMemo} onChange={(e) => set('ownerMemo', e.target.value)} /></Field>
        <Field label="설명 (공개)" wide><textarea className={input} rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label="비공개 메모 (작성자·owner만)" wide><textarea className={input} rows={2} value={form.privateMemo} onChange={(e) => set('privateMemo', e.target.value)} /></Field>
      </Section>

      {showStatus && (
        <Section title="상태">
          <Field label="거래 상태">
            <select className={input} value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="active">거래중</option>
              <option value="contracted">거래완료</option>
              <option value="hidden">숨김</option>
            </select>
          </Field>
        </Section>
      )}

      {error && <p className="text-sm text-hud-accent-danger">{error}</p>}

      <Button variant="primary" type="submit" disabled={saving} fullWidth glow>
        {saving ? '저장 중...' : submitLabel}
      </Button>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="hud-card rounded-lg p-4">
      <h2 className="text-sm font-semibold text-hud-text-primary mb-3">{title}</h2>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <label className="block text-xs text-hud-text-muted mb-1">{label}</label>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: 빌드**

```bash
npm run build
```

- [ ] **Step 3: 커밋**

```bash
git add src/components/listings/ListingForm.tsx
git commit -m "feat(ui): 공유 ListingForm 컴포넌트 (식별/거래/면적/위치/메타/상태 섹션)"
```

### Task 16: /listings/new 페이지

**Files:**
- Create: `src/app/(app)/listings/new/page.tsx`

- [ ] **Step 1: 작성**

`src/app/(app)/listings/new/page.tsx`:
```typescript
'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building, ArrowLeft } from 'lucide-react'
import ListingForm, { emptyForm } from '@/components/listings/ListingForm'
import { createListing } from '@/lib/api/listings'

export default function NewListingPage() {
  const router = useRouter()

  const onSubmit = async (payload: Record<string, unknown>) => {
    const created = await createListing(payload)
    router.replace(`/listings/${created.id}`)
  }

  return (
    <div className="p-6 text-hud-text-primary max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/listings" className="text-hud-text-muted hover:text-hud-text-primary">
          <ArrowLeft size={20} />
        </Link>
        <Building size={24} className="text-hud-accent-primary" />
        <h1 className="text-2xl font-bold">매물 등록</h1>
      </div>
      <ListingForm initial={emptyForm} submitLabel="등록" onSubmit={onSubmit} />
    </div>
  )
}
```

- [ ] **Step 2: 빌드**

```bash
npm run build
```

- [ ] **Step 3: 커밋**

```bash
git add src/app/\(app\)/listings/new/
git commit -m "feat(ui): /listings/new 페이지"
```

### Task 17: /listings/[id] 상세 페이지 + 사진 그리드

**Files:**
- Create: `src/app/(app)/listings/[id]/page.tsx`
- Create: `src/components/listings/PhotoGallery.tsx`

- [ ] **Step 1: PhotoGallery**

`src/components/listings/PhotoGallery.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import type { ListingPhoto } from '@/lib/api/listings'

interface Props {
  photos: ListingPhoto[]
  canEdit: boolean
  onDelete?: (photoId: number) => Promise<void>
}

export function PhotoGallery({ photos, canEdit, onDelete }: Props) {
  const [zoom, setZoom] = useState<ListingPhoto | null>(null)
  if (photos.length === 0) return <p className="text-sm text-hud-text-muted">사진 없음</p>
  return (
    <>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p) => (
          <div key={p.id} className="hud-card rounded-lg overflow-hidden aspect-[4/3] relative group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt={p.caption ?? ''}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setZoom(p)}
            />
            {p.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-2 py-1">
                {p.caption}
              </div>
            )}
            {canEdit && onDelete && (
              <button
                onClick={() => { if (confirm('이 사진을 삭제할까요?')) onDelete(p.id) }}
                className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="사진 삭제"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
      {zoom && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoom(null)}
        >
          <button className="absolute top-4 right-4 text-white" onClick={() => setZoom(null)}>
            <X size={24} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom.url} alt={zoom.caption ?? ''} className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: 상세 페이지**

`src/app/(app)/listings/[id]/page.tsx`:
```typescript
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building, ArrowLeft, Edit3, Trash2, FileText, Upload, X } from 'lucide-react'
import Button from '@/components/common/Button'
import { PhotoGallery } from '@/components/listings/PhotoGallery'
import { useAuth } from '@/auth/AuthContext'
import {
  getListing, deleteListing, uploadPhoto, deletePhoto,
  uploadContract, deleteContract,
  type ListingDetail,
} from '@/lib/api/listings'

const dealLabels: Record<string, string> = { sale: '매매', jeonse: '전세', wolse: '월세' }
const statusLabels: Record<string, string> = { active: '거래중', contracted: '거래완료', hidden: '숨김' }

function fmt(won: string | null): string {
  if (!won) return '-'
  const n = BigInt(won)
  if (n < 100_000_000n) return `${(n / 10_000n).toString()}만원`
  const eok = n / 100_000_000n
  const man = (n % 100_000_000n) / 10_000n
  return man > 0n ? `${eok.toString()}억 ${man.toString()}만원` : `${eok.toString()}억원`
}

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { me } = useAuth()
  const id = Number(params.id)
  const [data, setData] = useState<ListingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = async () => {
    try {
      setLoading(true)
      setData(await getListing(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { reload() }, [id])

  if (loading) return <p className="p-12 text-hud-text-muted">불러오는 중...</p>
  if (error) return <p className="p-12 text-hud-accent-danger">{error}</p>
  if (!data) return <p className="p-12 text-hud-text-muted">없음</p>

  const canEdit = me?.agent.id === data.createdById || me?.agent.role === 'owner'

  const onDelete = async () => {
    if (!confirm('이 매물을 삭제할까요?')) return
    await deleteListing(id)
    router.replace('/listings')
  }

  const onPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    for (const f of Array.from(files)) {
      await uploadPhoto(id, f)
    }
    e.target.value = ''
    await reload()
  }

  const onPhotoDelete = async (pid: number) => {
    await deletePhoto(id, pid)
    await reload()
  }

  const onContractUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    for (const f of Array.from(files)) {
      await uploadContract(id, f)
    }
    e.target.value = ''
    await reload()
  }

  const onContractDelete = async (cid: number) => {
    if (!confirm('이 계약서를 삭제할까요?')) return
    await deleteContract(id, cid)
    await reload()
  }

  return (
    <div className="p-6 text-hud-text-primary space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/listings" className="text-hud-text-muted hover:text-hud-text-primary">
          <ArrowLeft size={20} />
        </Link>
        <Building size={24} className="text-hud-accent-primary" />
        <h1 className="text-2xl font-bold">{data.title}</h1>
        <span className="px-2 py-0.5 rounded text-xs bg-hud-accent-primary/20 text-hud-accent-primary">
          {dealLabels[data.dealType]}
        </span>
        <span className="px-2 py-0.5 rounded text-xs bg-hud-bg-secondary text-hud-text-muted">
          {statusLabels[data.status]}
        </span>
        {canEdit && (
          <div className="ml-auto flex gap-2">
            <Link href={`/listings/${id}/edit`}>
              <Button variant="outline" leftIcon={<Edit3 size={16} />}>수정</Button>
            </Link>
            <Button variant="outline" leftIcon={<Trash2 size={16} />} onClick={onDelete}>삭제</Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="hud-card rounded-lg p-6 space-y-3">
          <h2 className="text-lg font-semibold mb-2">기본 정보</h2>
          <Row label="단지">{data.complexName ?? '-'}</Row>
          <Row label="동/호/층">{[data.dong, data.ho, data.floor].filter(Boolean).join(' / ') || '-'}</Row>
          <Row label="평형">{data.pyeongType ?? '-'}</Row>
          <Row label="향">{data.direction ?? '-'}</Row>
          <Row label="전용/공급">{data.areaM2}㎡{data.supplyAreaM2 ? ` / ${data.supplyAreaM2}㎡` : ''}</Row>
          <Row label="주소">{data.address}{data.addressDetail ? ` ${data.addressDetail}` : ''}</Row>
        </div>

        <div className="hud-card rounded-lg p-6 space-y-3">
          <h2 className="text-lg font-semibold mb-2">거래 정보</h2>
          {data.dealType === 'sale' && <Row label="매매가">{fmt(data.salePrice)}</Row>}
          {data.dealType === 'jeonse' && <Row label="보증금">{fmt(data.deposit)}</Row>}
          {data.dealType === 'wolse' && (
            <>
              <Row label="보증금">{fmt(data.deposit)}</Row>
              <Row label="월세">{fmt(data.monthlyRent)}</Row>
            </>
          )}
          <Row label="관리비">{data.maintenanceFee != null ? `${data.maintenanceFee.toLocaleString()}원/월` : '-'}</Row>
          <Row label="수수료율">{data.commissionRate != null ? `${data.commissionRate}%` : '-'}</Row>
          <Row label="입주가능일">{data.availableMoveInDate ? new Date(data.availableMoveInDate).toLocaleDateString() : '-'}</Row>
        </div>
      </div>

      <div className="hud-card rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-semibold mb-2">소유자 / 메모</h2>
        <Row label="소유자">{data.ownerName ?? '-'}</Row>
        <Row label="소유자 전화">{data.ownerPhone ?? '-'}</Row>
        {data.ownerMemo != null && <Row label="소유자 메모">{data.ownerMemo}</Row>}
        {data.description && (
          <div>
            <div className="text-xs text-hud-text-muted mb-1">설명</div>
            <p className="text-sm whitespace-pre-wrap">{data.description}</p>
          </div>
        )}
        {data.privateMemo != null && (
          <div>
            <div className="text-xs text-hud-text-muted mb-1">비공개 메모</div>
            <p className="text-sm whitespace-pre-wrap">{data.privateMemo}</p>
          </div>
        )}
      </div>

      <div className="hud-card rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">사진 ({data.photos.length})</h2>
          {canEdit && (
            <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-hud-accent-primary/20 text-hud-accent-primary rounded text-sm hover:bg-hud-accent-primary/30 transition-hud">
              <Upload size={14} />
              사진 추가
              <input type="file" multiple accept="image/*" className="hidden" onChange={onPhotoUpload} />
            </label>
          )}
        </div>
        <PhotoGallery photos={data.photos} canEdit={canEdit} onDelete={onPhotoDelete} />
      </div>

      <div className="hud-card rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">계약서 ({data.contracts.length})</h2>
          {canEdit && (
            <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-hud-accent-primary/20 text-hud-accent-primary rounded text-sm hover:bg-hud-accent-primary/30 transition-hud">
              <Upload size={14} />
              계약서 추가
              <input type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={onContractUpload} />
            </label>
          )}
        </div>
        {data.contracts.length === 0 ? (
          <p className="text-sm text-hud-text-muted">계약서 없음</p>
        ) : (
          <ul className="space-y-2">
            {data.contracts.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-sm">
                <FileText size={14} className="text-hud-accent-primary" />
                <a href={c.url} target="_blank" rel="noreferrer" className="text-hud-accent-primary hover:underline flex-1">{c.filename}</a>
                <span className="text-xs text-hud-text-muted">{new Date(c.uploadedAt).toLocaleDateString()}</span>
                {canEdit && (
                  <button onClick={() => onContractDelete(c.id)} className="text-hud-text-muted hover:text-hud-accent-danger">
                    <X size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 text-sm">
      <div className="text-hud-text-muted col-span-1">{label}</div>
      <div className="col-span-2">{children}</div>
    </div>
  )
}
```

- [ ] **Step 3: 빌드**

```bash
npm run build
```

- [ ] **Step 4: 커밋**

```bash
git add src/app/\(app\)/listings/\[id\]/page.tsx src/components/listings/PhotoGallery.tsx
git commit -m "feat(ui): /listings/[id] 상세 페이지 + PhotoGallery + 사진·계약서 업로더"
```

### Task 18: /listings/[id]/edit 페이지

**Files:**
- Create: `src/app/(app)/listings/[id]/edit/page.tsx`

- [ ] **Step 1: 작성**

`src/app/(app)/listings/[id]/edit/page.tsx`:
```typescript
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building, ArrowLeft } from 'lucide-react'
import ListingForm, { emptyForm, type ListingFormValue } from '@/components/listings/ListingForm'
import { getListing, updateListing } from '@/lib/api/listings'

function detailToForm(d: Awaited<ReturnType<typeof getListing>>): ListingFormValue {
  return {
    title: d.title,
    complexName: d.complexName ?? '',
    dong: d.dong ?? '',
    ho: d.ho ?? '',
    floor: d.floor ?? '',
    direction: d.direction ?? '',
    pyeongType: d.pyeongType ?? '',
    dealType: d.dealType,
    propertyType: d.propertyType,
    salePrice: d.salePrice ?? '',
    deposit: d.deposit ?? '',
    monthlyRent: d.monthlyRent ?? '',
    areaM2: String(d.areaM2),
    supplyAreaM2: d.supplyAreaM2 != null ? String(d.supplyAreaM2) : '',
    address: d.address,
    addressDetail: d.addressDetail ?? '',
    maintenanceFee: d.maintenanceFee != null ? String(d.maintenanceFee) : '',
    ownerName: d.ownerName ?? '',
    ownerPhone: d.ownerPhone ?? '',
    ownerMemo: d.ownerMemo ?? '',
    commissionRate: d.commissionRate != null ? String(d.commissionRate) : '',
    description: d.description ?? '',
    privateMemo: d.privateMemo ?? '',
    status: d.status,
  }
}

export default function EditListingPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = Number(params.id)
  const [form, setForm] = useState<ListingFormValue | null>(null)

  useEffect(() => {
    getListing(id).then((d) => setForm(detailToForm(d))).catch(() => setForm(emptyForm))
  }, [id])

  if (!form) return <p className="p-12 text-hud-text-muted">불러오는 중...</p>

  const onSubmit = async (payload: Record<string, unknown>) => {
    await updateListing(id, payload)
    router.replace(`/listings/${id}`)
  }

  return (
    <div className="p-6 text-hud-text-primary max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/listings/${id}`} className="text-hud-text-muted hover:text-hud-text-primary">
          <ArrowLeft size={20} />
        </Link>
        <Building size={24} className="text-hud-accent-primary" />
        <h1 className="text-2xl font-bold">매물 수정</h1>
      </div>
      <ListingForm initial={form} showStatus submitLabel="저장" onSubmit={onSubmit} />
    </div>
  )
}
```

- [ ] **Step 2: 빌드**

```bash
npm run build
```

- [ ] **Step 3: 커밋**

```bash
git add src/app/\(app\)/listings/\[id\]/edit/
git commit -m "feat(ui): /listings/[id]/edit 페이지"
```

### Task 19: Phase 4 통합 검증

**Files:** 없음 — 검증만

- [ ] **Step 1: 전체 테스트**

```bash
npm test 2>&1 | tail -15
```
Expected: 모든 테스트 통과. 누적: Phase 1+2+3 (75) + Phase 4 (lib-listing-helpers 10 + lib-uploads 5 + create 5 + list 9 + get 4 + update 5 + delete 4 + photos 5 + contracts 4 = 51) = **126 passed**.

- [ ] **Step 2: 빌드**

```bash
npm run build 2>&1 | tail -10
```
Expected: 통과. `/listings`, `/listings/new`, `/listings/[id]`, `/listings/[id]/edit` 라우트가 산출물에 포함.

- [ ] **Step 3: dev 라운드트립 (수동)**

```bash
# DB + dev 서버 가동 가정. .next 정리 권장.
rm -rf .next && npm run dev > /tmp/le-dev.log 2>&1 &
DEV_PID=$!
until /usr/bin/curl -sf http://localhost:3000/api/health >/dev/null 2>&1; do sleep 1; done

# 가입 + 토큰 받기
/usr/bin/curl -s -c /tmp/le-c.txt -X POST http://localhost:3000/api/auth/signup \
  -H 'content-type: application/json' \
  -d '{"agency":{"name":"P4"},"owner":{"name":"E","email":"p4@x.com","password":"pw12345678"}}' > /dev/null

# 매물 생성
/usr/bin/curl -s -b /tmp/le-c.txt -X POST http://localhost:3000/api/listings \
  -H 'content-type: application/json' \
  -d '{"title":"강남 래미안 30평","dealType":"sale","propertyType":"apartment","salePrice":"900000000","areaM2":84.5,"address":"서울 강남구 역삼동"}' | head -c 300
echo
# 목록
/usr/bin/curl -s -b /tmp/le-c.txt 'http://localhost:3000/api/listings?dealType=sale' | head -c 300
echo

# 페이지 라우팅
for p in /listings /listings/new; do
  /usr/bin/curl -s -o /dev/null -w "$p %{http_code}\n" http://localhost:3000$p
done

kill $DEV_PID 2>/dev/null
```
Expected:
- 매물 생성 200 + JSON
- 목록 `{"data":[...],"total":1,...}`
- 페이지: `/listings 200`, `/listings/new 200`

- [ ] **Step 4: 푸시**

```bash
git push origin feat/le-04-internal-listings
```

---

## Notes

- **사진 저장 위치**: `public/uploads/listings/{id}/photos/...`. `.gitignore` 적용. 프로덕션 단일 노드 가정. 멀티 노드 배포 시 S3-호환 스토리지로 교체.
- **파일 검증**: MIME 타입 + 크기. 매직 바이트 검증은 후속.
- **민감 필드 마스킹**: 서버에서 일관 projection (projectListing). 클라이언트에서 추가 마스킹 안 함.
- **BigInt 직렬화**: 가격은 string으로 JSON 변환 (JSON.stringify 시 bigint 에러 방지).
- **Decimal 직렬화**: Prisma Decimal → number (정밀도 손실 없는 범위, 면적·수수료율).
- **상태 갱신**: status=contracted 시 contractedAt, contractedPrice를 같이 갱신할 수 있게 PATCH 스키마에 포함.
- **dev 서버 stale chunk**: 새 라우트가 많아져 발생 빈도 높음. `rm -rf .next && npm run dev` 권장.

## Out of Scope (Phase 5)

- 엑셀 다운로드 (`/explore/download`)
- 평형별 평균가 차트 (`/explore/chart`)
- 대시보드의 통계·차트
- 매물 좌표 KakaoMap picker (주소 → 좌표 자동)
- 사진 캡션 인라인 수정
- 사진 sortOrder 드래그 reorder
- 계약서 다운로드 시 원본 파일명으로
- 매물 사진의 lightbox는 단순 zoom만 (slide 없음)
- 페이지네이션 표시는 이전/다음만 (페이지 번호 점프 없음)
- 매물 내보내기 (CSV)
