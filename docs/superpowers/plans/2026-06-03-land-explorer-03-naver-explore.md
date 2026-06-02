# Land Explorer — Phase 3: Naver Explore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 네이버 부동산(`fin.land.naver.com`)의 단지·매물 데이터를 서버에서 프록시하여 인터랙티브 탐색 UI(`/explore`)를 제공한다. 사용자가 지역·거래유형·매물종류를 선택하면 단지 리스트와 KakaoMap, 선택한 단지의 매물 표가 나타난다.

**Architecture:** Next.js Route Handler가 `fin.land.naver.com/front-api/v1/...` 엔드포인트를 Referer 헤더 부착해 프록시. 세션 메모리 LRU+TTL 캐시(5분)로 직전 동일 쿼리 재호출만 절약. DB 영속화 없음. 탐색 페이지는 URL 쿼리로 상태 직렬화 (지역코드/거래유형/매물종류/선택된 단지). KakaoMap은 Phase 1에서 차용한 컴포넌트 활용.

**Tech Stack:** Next.js 15 Route Handlers, Kakao Maps SDK, Vitest 1.x (fetch mocking), 큐레이트된 법정동 JSON(우리가 작성)

**Working directory:** `/Volumes/MacExtend 1/REMS`

---

## File Structure

```
src/
├── lib/
│   ├── naver-types.ts            # TypeScript types for Naver entities
│   ├── naver-codes.ts            # code ↔ label maps (A1=매매, A01=아파트, ...)
│   ├── naver-cache.ts            # in-memory LRU+TTL cache
│   ├── naver-client.ts           # upstream fetch wrapper (Referer, error mapping)
│   └── regions-data.ts           # 큐레이트된 법정동 JSON (시도/시군구/읍면동 ~50개)
├── app/api/naver/
│   ├── regions/route.ts          # GET ?q=강남 → matching regions
│   ├── complexes/route.ts        # GET ?eupCode=...&trade=...&realEstate=... → 단지 리스트
│   └── articles/route.ts         # POST {complexNumber, tradeTypes, ...} → 매물 리스트
├── app/(app)/explore/
│   └── page.tsx                  # 탐색 페이지 (URL state, composition)
├── components/explore/
│   ├── RegionPicker.tsx          # 자동완성 + 수동 코드 입력
│   ├── FilterBar.tsx             # 거래유형/매물종류 토글
│   ├── ComplexList.tsx           # 단지 카드 리스트
│   └── ArticleTable.tsx          # 매물 표 (선택된 단지)
tests/
├── naver-cache.test.ts
├── naver-codes.test.ts
├── naver-client.test.ts          # mocked fetch
├── api-naver-regions.test.ts
├── api-naver-complexes.test.ts
└── api-naver-articles.test.ts
```

---

## Tasks

### Task 1: Naver 타입 + 코드 매핑 + 코드 테스트

**Files:**
- Create: `src/lib/naver-types.ts`
- Create: `src/lib/naver-codes.ts`
- Create: `tests/naver-codes.test.ts`

- [ ] **Step 1: naver-types.ts 작성**

`src/lib/naver-types.ts`:
```typescript
export type TradeTypeCode = 'A1' | 'B1' | 'B2'
export type RealEstateTypeCode = 'A01' | 'A02' | 'A03' | 'B03' | 'C01' | 'D01'

export interface RegionEntry {
  legalDivisionNumber: string  // 10자리 법정동 코드
  sido: string                 // 시도명 (예: "경기도")
  sigungu: string              // 시군구명 (예: "수원시 장안구")
  eup: string                  // 읍면동명 (예: "정자동")
  centerLat: number            // 지도 중심 위도
  centerLng: number            // 지도 중심 경도
}

export interface NaverComplex {
  complexNumber: string
  complexName: string
  address: string
  latitude: number | null
  longitude: number | null
  householdCount: number | null
  builtYear: number | null
  complexType: string | null
  totalArticleCount: number | null
}

export interface NaverArticle {
  articleNo: string
  tradeType: TradeTypeCode
  price: number | null         // 매매가 또는 보증금 (원)
  monthlyRent: number | null   // 월세 (원, A1/B1이면 null)
  pyeongName: string | null    // 평형명 "84A" 등
  exclusiveArea: number | null // 전용면적 m²
  floor: string | null         // "15" / "고" / "중" / "저"
  direction: string | null     // "남" 등
  registeredAt: string | null  // ISO date
  brokerName: string | null
}

export interface ComplexesResponse {
  complexes: NaverComplex[]
  total: number
}

export interface ArticlesResponse {
  articles: NaverArticle[]
  total: number
  hasMore: boolean
}
```

- [ ] **Step 2: 테스트 작성 (코드 매핑)**

`tests/naver-codes.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import {
  tradeTypeLabel, tradeTypeCodes,
  realEstateTypeLabel, realEstateTypeCodes,
  formatPrice,
} from '@/lib/naver-codes'

describe('tradeType', () => {
  it('A1 → 매매', () => { expect(tradeTypeLabel('A1')).toBe('매매') })
  it('B1 → 전세', () => { expect(tradeTypeLabel('B1')).toBe('전세') })
  it('B2 → 월세', () => { expect(tradeTypeLabel('B2')).toBe('월세') })
  it('codes contains all three', () => {
    expect(tradeTypeCodes).toEqual(['A1', 'B1', 'B2'])
  })
})

describe('realEstateType', () => {
  it('A01 → 아파트', () => { expect(realEstateTypeLabel('A01')).toBe('아파트') })
  it('A02 → 오피스텔', () => { expect(realEstateTypeLabel('A02')).toBe('오피스텔') })
  it('A03 → 빌라/연립', () => { expect(realEstateTypeLabel('A03')).toBe('빌라/연립') })
  it('B03 → 단독/다가구', () => { expect(realEstateTypeLabel('B03')).toBe('단독/다가구') })
  it('C01 → 상가', () => { expect(realEstateTypeLabel('C01')).toBe('상가') })
  it('D01 → 토지', () => { expect(realEstateTypeLabel('D01')).toBe('토지') })
  it('codes 모두 포함', () => {
    expect(realEstateTypeCodes).toEqual(['A01', 'A02', 'A03', 'B03', 'C01', 'D01'])
  })
})

describe('formatPrice', () => {
  it('1억 5천만', () => { expect(formatPrice(150_000_000)).toBe('1억 5,000만') })
  it('5억', () => { expect(formatPrice(500_000_000)).toBe('5억') })
  it('3,500만 (1억 미만)', () => { expect(formatPrice(35_000_000)).toBe('3,500만') })
  it('null → "-"', () => { expect(formatPrice(null)).toBe('-') })
  it('5천 미만은 그냥 원 단위', () => { expect(formatPrice(8000)).toBe('8,000원') })
})
```

- [ ] **Step 3: 실패 확인**

```bash
npm test -- tests/naver-codes.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 4: 구현**

`src/lib/naver-codes.ts`:
```typescript
import type { TradeTypeCode, RealEstateTypeCode } from './naver-types'

export const tradeTypeCodes: TradeTypeCode[] = ['A1', 'B1', 'B2']

const TRADE_TYPE_LABELS: Record<TradeTypeCode, string> = {
  A1: '매매',
  B1: '전세',
  B2: '월세',
}

export function tradeTypeLabel(code: TradeTypeCode): string {
  return TRADE_TYPE_LABELS[code]
}

export const realEstateTypeCodes: RealEstateTypeCode[] = ['A01', 'A02', 'A03', 'B03', 'C01', 'D01']

const REAL_ESTATE_TYPE_LABELS: Record<RealEstateTypeCode, string> = {
  A01: '아파트',
  A02: '오피스텔',
  A03: '빌라/연립',
  B03: '단독/다가구',
  C01: '상가',
  D01: '토지',
}

export function realEstateTypeLabel(code: RealEstateTypeCode): string {
  return REAL_ESTATE_TYPE_LABELS[code]
}

/**
 * 가격(원)을 한국식 표기로. 1억 5,000만 / 5억 / 3,500만 / 8,000원.
 */
export function formatPrice(won: number | null): string {
  if (won == null) return '-'
  if (won < 10_000) return `${won.toLocaleString()}원`
  if (won < 100_000_000) return `${Math.floor(won / 10_000).toLocaleString()}만`
  const eok = Math.floor(won / 100_000_000)
  const man = Math.floor((won % 100_000_000) / 10_000)
  return man > 0 ? `${eok}억 ${man.toLocaleString()}만` : `${eok}억`
}
```

- [ ] **Step 5: 통과 확인**

```bash
npm test -- tests/naver-codes.test.ts
```
Expected: 14 passed

- [ ] **Step 6: 커밋**

```bash
git add src/lib/naver-types.ts src/lib/naver-codes.ts tests/naver-codes.test.ts
git commit -m "feat(naver): 타입 + 코드 매핑(매매/전세/월세, 아파트/오피스텔/...) + formatPrice"
```

### Task 2: Naver 캐시 (LRU + TTL) — TDD

**Files:**
- Create: `src/lib/naver-cache.ts`
- Create: `tests/naver-cache.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/naver-cache.test.ts`:
```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCache } from '@/lib/naver-cache'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('naver-cache', () => {
  it('miss → set → hit', () => {
    const c = createCache<string>({ maxEntries: 10, ttlMs: 60_000 })
    expect(c.get('k')).toBeUndefined()
    c.set('k', 'v')
    expect(c.get('k')).toBe('v')
  })

  it('TTL 만료 후 hit 안 됨', () => {
    const c = createCache<string>({ maxEntries: 10, ttlMs: 60_000 })
    c.set('k', 'v')
    vi.advanceTimersByTime(60_001)
    expect(c.get('k')).toBeUndefined()
  })

  it('LRU 초과 시 가장 오래된 항목 삭제', () => {
    const c = createCache<number>({ maxEntries: 3, ttlMs: 60_000 })
    c.set('a', 1); c.set('b', 2); c.set('c', 3)
    c.set('d', 4)  // a 축출
    expect(c.get('a')).toBeUndefined()
    expect(c.get('b')).toBe(2)
    expect(c.get('c')).toBe(3)
    expect(c.get('d')).toBe(4)
  })

  it('hit 시 LRU 순서 갱신', () => {
    const c = createCache<number>({ maxEntries: 3, ttlMs: 60_000 })
    c.set('a', 1); c.set('b', 2); c.set('c', 3)
    c.get('a')   // a를 최신으로
    c.set('d', 4)  // b 축출
    expect(c.get('a')).toBe(1)
    expect(c.get('b')).toBeUndefined()
  })

  it('invalidate(key) — 강제 무효화', () => {
    const c = createCache<string>({ maxEntries: 10, ttlMs: 60_000 })
    c.set('k', 'v')
    c.invalidate('k')
    expect(c.get('k')).toBeUndefined()
  })

  it('clear() — 전체 비움', () => {
    const c = createCache<string>({ maxEntries: 10, ttlMs: 60_000 })
    c.set('a', '1'); c.set('b', '2')
    c.clear()
    expect(c.get('a')).toBeUndefined()
    expect(c.get('b')).toBeUndefined()
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/naver-cache.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: 구현**

`src/lib/naver-cache.ts`:
```typescript
export interface CacheOptions {
  maxEntries: number
  ttlMs: number
}

export interface Cache<T> {
  get(key: string): T | undefined
  set(key: string, value: T): void
  invalidate(key: string): void
  clear(): void
}

interface Entry<T> {
  value: T
  expiresAt: number
}

/**
 * LRU + TTL 캐시. Map의 삽입 순서 보존 특성을 이용.
 */
export function createCache<T>({ maxEntries, ttlMs }: CacheOptions): Cache<T> {
  const map = new Map<string, Entry<T>>()

  function isExpired(entry: Entry<T>): boolean {
    return entry.expiresAt <= Date.now()
  }

  return {
    get(key) {
      const entry = map.get(key)
      if (!entry) return undefined
      if (isExpired(entry)) {
        map.delete(key)
        return undefined
      }
      // LRU 갱신: 삭제 후 재삽입으로 가장 최신으로
      map.delete(key)
      map.set(key, entry)
      return entry.value
    },
    set(key, value) {
      if (map.has(key)) map.delete(key)
      map.set(key, { value, expiresAt: Date.now() + ttlMs })
      while (map.size > maxEntries) {
        const oldestKey = map.keys().next().value
        if (oldestKey === undefined) break
        map.delete(oldestKey)
      }
    },
    invalidate(key) {
      map.delete(key)
    },
    clear() {
      map.clear()
    },
  }
}
```

- [ ] **Step 4: 통과 확인**

```bash
npm test -- tests/naver-cache.test.ts
```
Expected: 6 passed

- [ ] **Step 5: 커밋**

```bash
git add src/lib/naver-cache.ts tests/naver-cache.test.ts
git commit -m "feat(naver): in-memory LRU+TTL cache + TDD"
```

### Task 3: Naver upstream client — mocked fetch 테스트

**Files:**
- Create: `src/lib/naver-client.ts`
- Create: `tests/naver-client.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/naver-client.test.ts`:
```typescript
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchComplexes, fetchArticles, NaverUpstreamError } from '@/lib/naver-client'

afterEach(() => vi.restoreAllMocks())

function mockJsonOnce(status: number, body: unknown) {
  vi.spyOn(global, 'fetch').mockImplementationOnce(async () =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  )
}

describe('fetchComplexes', () => {
  it('정상 응답 → 정규화된 객체 반환', async () => {
    mockJsonOnce(200, {
      data: {
        complexList: [{
          complexNumber: '102614',
          complexName: '테스트단지',
          totalAddress: '경기도 수원시 장안구 정자동',
          latitude: 37.30,
          longitude: 126.97,
          totalHouseholdCount: 1234,
          completionYear: 2015,
          complexTypeCode: 'APT',
          articleCount: 12,
        }],
        totalCount: 1,
      },
    })
    const res = await fetchComplexes({ eupCode: '4111113000', tradeTypes: ['A1'], realEstateTypes: ['A01'] })
    expect(res.complexes).toHaveLength(1)
    expect(res.complexes[0].complexNumber).toBe('102614')
    expect(res.complexes[0].complexName).toBe('테스트단지')
    expect(res.complexes[0].latitude).toBe(37.30)
    expect(res.complexes[0].householdCount).toBe(1234)
    expect(res.total).toBe(1)
  })

  it('Referer 헤더 부착', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementationOnce(async () =>
      new Response(JSON.stringify({ data: { complexList: [], totalCount: 0 } }), { status: 200 }))
    await fetchComplexes({ eupCode: '4111113000', tradeTypes: ['A1'], realEstateTypes: ['A01'] })
    const init = spy.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers.referer).toMatch(/^https:\/\/fin\.land\.naver\.com\//)
  })

  it('429 → NaverUpstreamError("RATE_LIMITED")', async () => {
    mockJsonOnce(429, { message: 'Rate limit' })
    await expect(
      fetchComplexes({ eupCode: '4111113000', tradeTypes: ['A1'], realEstateTypes: ['A01'] }),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED', name: 'NaverUpstreamError' })
  })

  it('500 → NaverUpstreamError("UPSTREAM_ERROR")', async () => {
    mockJsonOnce(500, { message: 'oops' })
    await expect(
      fetchComplexes({ eupCode: '4111113000', tradeTypes: ['A1'], realEstateTypes: ['A01'] }),
    ).rejects.toMatchObject({ code: 'UPSTREAM_ERROR' })
  })
})

describe('fetchArticles', () => {
  it('정상 응답 → 정규화', async () => {
    mockJsonOnce(200, {
      data: {
        articleList: [{
          articleNo: '12345',
          tradeTypeCode: 'A1',
          dealPrice: 900_000_000,
          monthlyRent: 0,
          pyeongName: '84A',
          exclusiveSpace: 84.5,
          floorInfo: '15/22',
          direction: '남',
          articleConfirmYmd: '20260520',
          realtorName: '한국공인',
        }],
        totalCount: 1,
        hasMore: false,
      },
    })
    const res = await fetchArticles({ complexNumber: '102614', tradeTypes: ['A1'] })
    expect(res.articles).toHaveLength(1)
    expect(res.articles[0].articleNo).toBe('12345')
    expect(res.articles[0].price).toBe(900_000_000)
    expect(res.articles[0].pyeongName).toBe('84A')
    expect(res.articles[0].floor).toBe('15/22')
  })

  it('네트워크 에러 → NaverUpstreamError("NETWORK")', async () => {
    vi.spyOn(global, 'fetch').mockImplementationOnce(async () => {
      throw new Error('econnreset')
    })
    await expect(
      fetchArticles({ complexNumber: '102614', tradeTypes: ['A1'] }),
    ).rejects.toMatchObject({ code: 'NETWORK' })
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/naver-client.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: 구현**

`src/lib/naver-client.ts`:
```typescript
import type {
  ComplexesResponse, ArticlesResponse, TradeTypeCode, RealEstateTypeCode,
} from './naver-types'

const BASE = 'https://fin.land.naver.com/front-api/v1'
const REFERER = 'https://fin.land.naver.com/'
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

export type NaverErrorCode = 'RATE_LIMITED' | 'UPSTREAM_ERROR' | 'NETWORK' | 'NOT_FOUND'

export class NaverUpstreamError extends Error {
  code: NaverErrorCode
  status?: number
  constructor(code: NaverErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'NaverUpstreamError'
    this.code = code
    this.status = status
  }
}

function commonHeaders(): Record<string, string> {
  return {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8',
    referer: REFERER,
    'user-agent': USER_AGENT,
  }
}

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: { ...commonHeaders(), ...(init.headers ?? {}) },
    })
  } catch (e) {
    throw new NaverUpstreamError('NETWORK', e instanceof Error ? e.message : 'network error')
  }
  if (res.status === 429) {
    throw new NaverUpstreamError('RATE_LIMITED', '네이버 호출 한도 초과 — 잠시 후 다시 시도', 429)
  }
  if (res.status === 404) {
    throw new NaverUpstreamError('NOT_FOUND', '없는 리소스', 404)
  }
  if (res.status >= 500 || res.status >= 400) {
    throw new NaverUpstreamError('UPSTREAM_ERROR', `네이버 응답 ${res.status}`, res.status)
  }
  return (await res.json()) as T
}

export interface FetchComplexesInput {
  eupCode: string
  tradeTypes: TradeTypeCode[]
  realEstateTypes: RealEstateTypeCode[]
  page?: number
  size?: number
}

interface UpstreamComplexesBody {
  data?: {
    complexList?: Array<{
      complexNumber: string
      complexName: string
      totalAddress?: string | null
      latitude?: number | null
      longitude?: number | null
      totalHouseholdCount?: number | null
      completionYear?: number | null
      complexTypeCode?: string | null
      articleCount?: number | null
    }>
    totalCount?: number
  }
}

export async function fetchComplexes(input: FetchComplexesInput): Promise<ComplexesResponse> {
  const params = new URLSearchParams({
    eupLegalDivisionNumber: input.eupCode,
    size: String(input.size ?? 30),
    page: String(input.page ?? 0),
    sortType: 'HOUSEHOLD',
  })
  if (input.tradeTypes.length) params.set('tradeTypes', input.tradeTypes.join(':'))
  if (input.realEstateTypes.length) params.set('realEstateTypes', input.realEstateTypes.join(':'))
  const body = await call<UpstreamComplexesBody>(`${BASE}/complex/region?${params.toString()}`)
  const list = body.data?.complexList ?? []
  return {
    complexes: list.map((c) => ({
      complexNumber: c.complexNumber,
      complexName: c.complexName,
      address: c.totalAddress ?? '',
      latitude: c.latitude ?? null,
      longitude: c.longitude ?? null,
      householdCount: c.totalHouseholdCount ?? null,
      builtYear: c.completionYear ?? null,
      complexType: c.complexTypeCode ?? null,
      totalArticleCount: c.articleCount ?? null,
    })),
    total: body.data?.totalCount ?? list.length,
  }
}

export interface FetchArticlesInput {
  complexNumber: string
  tradeTypes: TradeTypeCode[]
  pyeongTypes?: string[]
  dongNumbers?: string[]
  size?: number
  lastInfo?: unknown[]
}

interface UpstreamArticlesBody {
  data?: {
    articleList?: Array<{
      articleNo: string
      tradeTypeCode: string
      dealPrice?: number | null
      warrantPrice?: number | null
      monthlyRent?: number | null
      pyeongName?: string | null
      exclusiveSpace?: number | null
      floorInfo?: string | null
      direction?: string | null
      articleConfirmYmd?: string | null
      realtorName?: string | null
    }>
    totalCount?: number
    hasMore?: boolean
  }
}

function toIsoDate(ymd: string | null | undefined): string | null {
  if (!ymd || ymd.length !== 8) return null
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`
}

export async function fetchArticles(input: FetchArticlesInput): Promise<ArticlesResponse> {
  const body = await call<UpstreamArticlesBody>(`${BASE}/complex/article/list`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      size: input.size ?? 30,
      complexNumber: input.complexNumber,
      tradeTypes: input.tradeTypes,
      pyeongTypes: input.pyeongTypes ?? [],
      dongNumbers: input.dongNumbers ?? [],
      userChannelType: 'PC',
      articleSortType: 'RANKING_DESC',
      lastInfo: input.lastInfo ?? [],
    }),
  })
  const list = body.data?.articleList ?? []
  return {
    articles: list.map((a) => ({
      articleNo: a.articleNo,
      tradeType: a.tradeTypeCode as TradeTypeCode,
      price: a.dealPrice ?? a.warrantPrice ?? null,
      monthlyRent: a.monthlyRent ?? null,
      pyeongName: a.pyeongName ?? null,
      exclusiveArea: a.exclusiveSpace ?? null,
      floor: a.floorInfo ?? null,
      direction: a.direction ?? null,
      registeredAt: toIsoDate(a.articleConfirmYmd),
      brokerName: a.realtorName ?? null,
    })),
    total: body.data?.totalCount ?? list.length,
    hasMore: Boolean(body.data?.hasMore),
  }
}
```

- [ ] **Step 4: 통과 확인**

```bash
npm test -- tests/naver-client.test.ts
```
Expected: 6 passed

- [ ] **Step 5: 커밋**

```bash
git add src/lib/naver-client.ts tests/naver-client.test.ts
git commit -m "feat(naver): upstream client (Referer 부착, 응답 정규화, 에러 분류) + 테스트"
```

### Task 4: 큐레이트된 법정동 데이터 + GET /api/naver/regions

**Files:**
- Create: `src/lib/regions-data.ts`
- Create: `src/app/api/naver/regions/route.ts`
- Create: `tests/api-naver-regions.test.ts`

- [ ] **Step 1: regions-data.ts 작성**

`src/lib/regions-data.ts`:
```typescript
import type { RegionEntry } from './naver-types'

/**
 * MVP용 큐레이트된 법정동 데이터.
 * 향후 전체 법정동 데이터셋으로 교체 가능 (행정자치부 공개 데이터).
 */
export const REGIONS: RegionEntry[] = [
  // 서울 강남구
  { legalDivisionNumber: '1168010100', sido: '서울특별시', sigungu: '강남구', eup: '역삼동', centerLat: 37.5004, centerLng: 127.0367 },
  { legalDivisionNumber: '1168010300', sido: '서울특별시', sigungu: '강남구', eup: '개포동', centerLat: 37.4781, centerLng: 127.0445 },
  { legalDivisionNumber: '1168010400', sido: '서울특별시', sigungu: '강남구', eup: '청담동', centerLat: 37.5230, centerLng: 127.0476 },
  { legalDivisionNumber: '1168010500', sido: '서울특별시', sigungu: '강남구', eup: '삼성동', centerLat: 37.5114, centerLng: 127.0631 },
  { legalDivisionNumber: '1168010600', sido: '서울특별시', sigungu: '강남구', eup: '대치동', centerLat: 37.4995, centerLng: 127.0577 },
  { legalDivisionNumber: '1168010700', sido: '서울특별시', sigungu: '강남구', eup: '신사동', centerLat: 37.5202, centerLng: 127.0220 },
  { legalDivisionNumber: '1168010800', sido: '서울특별시', sigungu: '강남구', eup: '논현동', centerLat: 37.5113, centerLng: 127.0282 },
  // 서울 서초구
  { legalDivisionNumber: '1165010100', sido: '서울특별시', sigungu: '서초구', eup: '서초동', centerLat: 37.4836, centerLng: 127.0327 },
  { legalDivisionNumber: '1165010200', sido: '서울특별시', sigungu: '서초구', eup: '잠원동', centerLat: 37.5118, centerLng: 127.0156 },
  { legalDivisionNumber: '1165010800', sido: '서울특별시', sigungu: '서초구', eup: '반포동', centerLat: 37.5073, centerLng: 127.0011 },
  // 서울 송파구
  { legalDivisionNumber: '1171010100', sido: '서울특별시', sigungu: '송파구', eup: '잠실동', centerLat: 37.5114, centerLng: 127.0817 },
  { legalDivisionNumber: '1171010200', sido: '서울특별시', sigungu: '송파구', eup: '신천동', centerLat: 37.5174, centerLng: 127.0817 },
  { legalDivisionNumber: '1171010800', sido: '서울특별시', sigungu: '송파구', eup: '문정동', centerLat: 37.4866, centerLng: 127.1248 },
  // 서울 마포구
  { legalDivisionNumber: '1144012700', sido: '서울특별시', sigungu: '마포구', eup: '합정동', centerLat: 37.5497, centerLng: 126.9134 },
  { legalDivisionNumber: '1144013100', sido: '서울특별시', sigungu: '마포구', eup: '망원동', centerLat: 37.5557, centerLng: 126.9038 },
  // 경기 수원시 장안구
  { legalDivisionNumber: '4111113000', sido: '경기도', sigungu: '수원시 장안구', eup: '정자동', centerLat: 37.2983, centerLng: 127.0078 },
  { legalDivisionNumber: '4111110100', sido: '경기도', sigungu: '수원시 장안구', eup: '파장동', centerLat: 37.2962, centerLng: 127.0078 },
  // 경기 성남시 분당구
  { legalDivisionNumber: '4113510700', sido: '경기도', sigungu: '성남시 분당구', eup: '서현동', centerLat: 37.3858, centerLng: 127.1234 },
  { legalDivisionNumber: '4113510900', sido: '경기도', sigungu: '성남시 분당구', eup: '정자동', centerLat: 37.3680, centerLng: 127.1075 },
  { legalDivisionNumber: '4113511000', sido: '경기도', sigungu: '성남시 분당구', eup: '미금동', centerLat: 37.3504, centerLng: 127.1112 },
  // 경기 용인시 수지구
  { legalDivisionNumber: '4146510100', sido: '경기도', sigungu: '용인시 수지구', eup: '풍덕천동', centerLat: 37.3287, centerLng: 127.0964 },
  { legalDivisionNumber: '4146510200', sido: '경기도', sigungu: '용인시 수지구', eup: '죽전동', centerLat: 37.3225, centerLng: 127.1059 },
]

export function searchRegions(query: string, limit = 20): RegionEntry[] {
  const q = query.trim()
  if (!q) return REGIONS.slice(0, limit)
  const lc = q.toLowerCase()
  return REGIONS.filter((r) =>
    r.sido.includes(q) ||
    r.sigungu.includes(q) ||
    r.eup.includes(q) ||
    `${r.sigungu} ${r.eup}`.toLowerCase().includes(lc),
  ).slice(0, limit)
}

export function getRegionByCode(code: string): RegionEntry | undefined {
  return REGIONS.find((r) => r.legalDivisionNumber === code)
}
```

- [ ] **Step 2: 실패 테스트 작성**

`tests/api-naver-regions.test.ts`:
```typescript
import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/naver/regions/route'

function req(url: string): Request {
  return new Request(url)
}

describe('GET /api/naver/regions', () => {
  it('빈 쿼리 → 기본 리스트 반환', async () => {
    const res = await GET(req('http://localhost/api/naver/regions'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.regions)).toBe(true)
    expect(body.regions.length).toBeGreaterThan(0)
  })

  it('q=정자 → 매칭 반환', async () => {
    const res = await GET(req('http://localhost/api/naver/regions?q=정자'))
    const body = await res.json()
    const eups = body.regions.map((r: { eup: string }) => r.eup)
    expect(eups).toContain('정자동')
  })

  it('q=강남 → 강남구 항목들 반환', async () => {
    const res = await GET(req('http://localhost/api/naver/regions?q=강남'))
    const body = await res.json()
    expect(body.regions.length).toBeGreaterThan(0)
    expect(body.regions.every((r: { sigungu: string }) => r.sigungu.includes('강남'))).toBe(true)
  })

  it('q=zzzzzz → 빈 배열', async () => {
    const res = await GET(req('http://localhost/api/naver/regions?q=zzzzzz'))
    const body = await res.json()
    expect(body.regions).toEqual([])
  })
})
```

- [ ] **Step 3: 실패 확인**

```bash
npm test -- tests/api-naver-regions.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 4: 라우트 구현**

`src/app/api/naver/regions/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { searchRegions } from '@/lib/regions-data'
import { errorResponse } from '@/lib/auth-helpers'

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const url = new URL(req.url)
    const q = url.searchParams.get('q') ?? ''
    const regions = searchRegions(q)
    return NextResponse.json({ regions })
  } catch (err) {
    return errorResponse(err)
  }
}
```

- [ ] **Step 5: 통과 확인**

```bash
npm test -- tests/api-naver-regions.test.ts
```
Expected: 4 passed

- [ ] **Step 6: 커밋**

```bash
git add src/lib/regions-data.ts src/app/api/naver/regions/route.ts tests/api-naver-regions.test.ts
git commit -m "feat(naver): 큐레이트된 법정동 데이터 + GET /api/naver/regions 검색"
```

### Task 5: GET /api/naver/complexes 프록시 + 캐시 통합 — TDD

**Files:**
- Create: `src/app/api/naver/complexes/route.ts`
- Create: `tests/api-naver-complexes.test.ts`

- [ ] **Step 1: 실패 테스트 작성 (fetch mock)**

`tests/api-naver-complexes.test.ts`:
```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/naver/complexes/route'
import { _complexesCache } from '@/app/api/naver/complexes/route'

beforeEach(() => {
  _complexesCache.clear()
})
afterEach(() => vi.restoreAllMocks())

function mockComplexFetchOnce(complexes: Array<{ complexNumber: string; complexName: string }>) {
  vi.spyOn(global, 'fetch').mockImplementationOnce(async () =>
    new Response(JSON.stringify({
      data: {
        complexList: complexes.map((c) => ({ ...c, totalAddress: '주소' })),
        totalCount: complexes.length,
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
}

describe('GET /api/naver/complexes', () => {
  it('eupCode + tradeTypes + realEstateTypes로 fetch 호출', async () => {
    mockComplexFetchOnce([{ complexNumber: '102614', complexName: '테스트단지' }])
    const res = await GET(new Request('http://localhost/api/naver/complexes?eupCode=4111113000&trade=A1&realEstate=A01'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.complexes).toHaveLength(1)
    expect(body.complexes[0].complexNumber).toBe('102614')
  })

  it('같은 쿼리 두 번 호출 → 두 번째는 캐시', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({
        data: { complexList: [{ complexNumber: '1', complexName: 'A' }], totalCount: 1 },
      }), { status: 200 }))
    const url = 'http://localhost/api/naver/complexes?eupCode=4111113000&trade=A1&realEstate=A01'
    await GET(new Request(url))
    await GET(new Request(url))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('eupCode 없으면 400', async () => {
    const res = await GET(new Request('http://localhost/api/naver/complexes?trade=A1&realEstate=A01'))
    expect(res.status).toBe(400)
  })

  it('네이버 429 → 502 + RATE_LIMITED 코드', async () => {
    vi.spyOn(global, 'fetch').mockImplementationOnce(async () =>
      new Response('{}', { status: 429 }))
    const res = await GET(new Request('http://localhost/api/naver/complexes?eupCode=4111113000&trade=A1&realEstate=A01'))
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/api-naver-complexes.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: 라우트 구현**

`src/app/api/naver/complexes/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { fetchComplexes, NaverUpstreamError } from '@/lib/naver-client'
import { createCache } from '@/lib/naver-cache'
import { errorResponse } from '@/lib/auth-helpers'
import type { ComplexesResponse, TradeTypeCode, RealEstateTypeCode } from '@/lib/naver-types'

/** 테스트에서 invalidate 가능하도록 export. 운영 시에는 직접 접근 안 함. */
export const _complexesCache = createCache<ComplexesResponse>({
  maxEntries: 200,
  ttlMs: 5 * 60_000,
})

function naverErrorResponse(err: NaverUpstreamError): NextResponse {
  return NextResponse.json(
    { error: { code: err.code, message: err.message } },
    { status: 502 },
  )
}

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const url = new URL(req.url)
    const eupCode = url.searchParams.get('eupCode')
    if (!eupCode) {
      return NextResponse.json(
        { error: { code: 'VALIDATION', message: 'eupCode가 필요합니다' } },
        { status: 400 },
      )
    }
    const tradeTypes = (url.searchParams.get('trade') ?? '').split(',').filter(Boolean) as TradeTypeCode[]
    const realEstateTypes = (url.searchParams.get('realEstate') ?? '').split(',').filter(Boolean) as RealEstateTypeCode[]
    const cacheKey = `${eupCode}|${tradeTypes.join(':')}|${realEstateTypes.join(':')}`

    const cached = _complexesCache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached, { headers: { 'x-cache': 'hit' } })
    }

    try {
      const result = await fetchComplexes({ eupCode, tradeTypes, realEstateTypes })
      _complexesCache.set(cacheKey, result)
      return NextResponse.json(result, { headers: { 'x-cache': 'miss' } })
    } catch (e) {
      if (e instanceof NaverUpstreamError) return naverErrorResponse(e)
      throw e
    }
  } catch (err) {
    return errorResponse(err)
  }
}
```

- [ ] **Step 4: 통과 확인**

```bash
npm test -- tests/api-naver-complexes.test.ts
```
Expected: 4 passed

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/naver/complexes/route.ts tests/api-naver-complexes.test.ts
git commit -m "feat(api): GET /api/naver/complexes 프록시 + 세션 캐시 통합 + 테스트"
```

### Task 6: POST /api/naver/articles 프록시 + 캐시 — TDD

**Files:**
- Create: `src/app/api/naver/articles/route.ts`
- Create: `tests/api-naver-articles.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/api-naver-articles.test.ts`:
```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST, _articlesCache } from '@/app/api/naver/articles/route'

beforeEach(() => {
  _articlesCache.clear()
})
afterEach(() => vi.restoreAllMocks())

function mockArticleFetchOnce(articles: Array<{ articleNo: string; tradeTypeCode: string }>) {
  vi.spyOn(global, 'fetch').mockImplementationOnce(async () =>
    new Response(JSON.stringify({
      data: {
        articleList: articles,
        totalCount: articles.length,
        hasMore: false,
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
}

describe('POST /api/naver/articles', () => {
  it('complexNumber + tradeTypes → fetch + 정규화', async () => {
    mockArticleFetchOnce([{ articleNo: '999', tradeTypeCode: 'A1' }])
    const res = await POST(new Request('http://localhost/api/naver/articles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ complexNumber: '102614', tradeTypes: ['A1'] }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.articles).toHaveLength(1)
    expect(body.articles[0].articleNo).toBe('999')
  })

  it('같은 body 두 번 → 두 번째는 캐시', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({
        data: { articleList: [{ articleNo: 'x', tradeTypeCode: 'A1' }], totalCount: 1, hasMore: false },
      }), { status: 200 }))
    const payload = JSON.stringify({ complexNumber: '102614', tradeTypes: ['A1'] })
    await POST(new Request('http://localhost/api/naver/articles', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: payload,
    }))
    await POST(new Request('http://localhost/api/naver/articles', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: payload,
    }))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('complexNumber 없으면 400', async () => {
    const res = await POST(new Request('http://localhost/api/naver/articles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tradeTypes: ['A1'] }),
    }))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/api-naver-articles.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: 라우트 구현**

`src/app/api/naver/articles/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { fetchArticles, NaverUpstreamError } from '@/lib/naver-client'
import { createCache } from '@/lib/naver-cache'
import { errorResponse } from '@/lib/auth-helpers'
import type { ArticlesResponse, TradeTypeCode } from '@/lib/naver-types'

export const _articlesCache = createCache<ArticlesResponse>({
  maxEntries: 200,
  ttlMs: 5 * 60_000,
})

interface ArticlesRequestBody {
  complexNumber?: string
  tradeTypes?: TradeTypeCode[]
  pyeongTypes?: string[]
  dongNumbers?: string[]
}

function naverErrorResponse(err: NaverUpstreamError): NextResponse {
  return NextResponse.json(
    { error: { code: err.code, message: err.message } },
    { status: 502 },
  )
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = (await req.json()) as ArticlesRequestBody
    if (!body.complexNumber) {
      return NextResponse.json(
        { error: { code: 'VALIDATION', message: 'complexNumber가 필요합니다' } },
        { status: 400 },
      )
    }
    const tradeTypes = body.tradeTypes ?? []
    const cacheKey = `${body.complexNumber}|${tradeTypes.join(':')}|${(body.pyeongTypes ?? []).join(':')}|${(body.dongNumbers ?? []).join(':')}`

    const cached = _articlesCache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached, { headers: { 'x-cache': 'hit' } })
    }

    try {
      const result = await fetchArticles({
        complexNumber: body.complexNumber,
        tradeTypes,
        pyeongTypes: body.pyeongTypes,
        dongNumbers: body.dongNumbers,
      })
      _articlesCache.set(cacheKey, result)
      return NextResponse.json(result, { headers: { 'x-cache': 'miss' } })
    } catch (e) {
      if (e instanceof NaverUpstreamError) return naverErrorResponse(e)
      throw e
    }
  } catch (err) {
    return errorResponse(err)
  }
}
```

- [ ] **Step 4: 통과 확인**

```bash
npm test -- tests/api-naver-articles.test.ts
```
Expected: 3 passed

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/naver/articles/route.ts tests/api-naver-articles.test.ts
git commit -m "feat(api): POST /api/naver/articles 프록시 + 캐시 + 테스트"
```

### Task 7: /explore 페이지 shell + URL state 동기화

**Files:**
- Create: `src/app/(app)/explore/page.tsx`

- [ ] **Step 1: 페이지 작성 (state + placeholders)**

`src/app/(app)/explore/page.tsx`:
```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Map as MapIcon } from 'lucide-react'
import { RegionPicker } from '@/components/explore/RegionPicker'
import { FilterBar } from '@/components/explore/FilterBar'
import { ComplexList } from '@/components/explore/ComplexList'
import { ArticleTable } from '@/components/explore/ArticleTable'
import { KakaoMap, type MapMarker } from '@/components/KakaoMap'
import { apiFetch } from '@/lib/api-client'
import type {
  RegionEntry, NaverComplex, ComplexesResponse,
  TradeTypeCode, RealEstateTypeCode,
} from '@/lib/naver-types'
import { getRegionByCode } from '@/lib/regions-data'

const DEFAULT_TRADE: TradeTypeCode[] = ['A1']
const DEFAULT_REAL_ESTATE: RealEstateTypeCode[] = ['A01']

export default function ExplorePage() {
  const params = useSearchParams()
  const router = useRouter()

  const eupCode = params.get('eup') ?? ''
  const tradeTypes = (params.get('trade') || DEFAULT_TRADE.join(',')).split(',').filter(Boolean) as TradeTypeCode[]
  const realEstateTypes = (params.get('realEstate') || DEFAULT_REAL_ESTATE.join(',')).split(',').filter(Boolean) as RealEstateTypeCode[]
  const selectedComplex = params.get('complex')

  const [region, setRegion] = useState<RegionEntry | null>(eupCode ? getRegionByCode(eupCode) ?? null : null)
  const [complexes, setComplexes] = useState<NaverComplex[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateUrl = useCallback((next: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === '') sp.delete(k)
      else sp.set(k, v)
    }
    router.replace(`/explore?${sp.toString()}`)
  }, [params, router])

  // eupCode 변경 → complexes fetch
  useEffect(() => {
    if (!eupCode) { setComplexes([]); return }
    let cancelled = false
    setLoading(true); setError(null)
    const qs = new URLSearchParams({
      eupCode,
      trade: tradeTypes.join(','),
      realEstate: realEstateTypes.join(','),
    })
    apiFetch<ComplexesResponse>(`/naver/complexes?${qs.toString()}`)
      .then((r) => { if (!cancelled) setComplexes(r.complexes) })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eupCode, tradeTypes.join(','), realEstateTypes.join(',')])

  const markers: MapMarker[] = complexes
    .filter((c) => c.latitude != null && c.longitude != null)
    .map((c) => ({ id: Number(c.complexNumber), lat: c.latitude!, lng: c.longitude!, title: c.complexName }))
  const mapCenter = region ? { lat: region.centerLat, lng: region.centerLng } : undefined

  const onSelectRegion = (r: RegionEntry) => {
    setRegion(r)
    updateUrl({ eup: r.legalDivisionNumber, complex: undefined })
  }
  const onTradeChange = (next: TradeTypeCode[]) => updateUrl({ trade: next.join(','), complex: undefined })
  const onRealEstateChange = (next: RealEstateTypeCode[]) => updateUrl({ realEstate: next.join(','), complex: undefined })
  const onSelectComplex = (c: NaverComplex) => updateUrl({ complex: c.complexNumber })
  const onMarkerClick = (id: number) => updateUrl({ complex: String(id) })

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-hud-border-secondary p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <RegionPicker selected={region} onSelect={onSelectRegion} />
          <FilterBar
            tradeTypes={tradeTypes}
            onTradeChange={onTradeChange}
            realEstateTypes={realEstateTypes}
            onRealEstateChange={onRealEstateChange}
          />
        </div>
        {error && <p className="text-sm text-hud-accent-danger">{error}</p>}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <ComplexList
          complexes={complexes}
          loading={loading}
          selectedComplex={selectedComplex}
          onSelect={onSelectComplex}
        />
        <div className="flex-1 relative">
          {markers.length === 0 && !loading && (
            <div className="absolute inset-0 flex items-center justify-center text-hud-text-muted text-sm">
              <MapIcon size={16} className="mr-2" />
              지역을 선택하면 단지가 표시됩니다
            </div>
          )}
          <KakaoMap markers={markers} center={mapCenter} onMarkerClick={onMarkerClick} className="w-full h-full" />
        </div>
      </div>

      {selectedComplex && (
        <ArticleTable
          complexNumber={selectedComplex}
          tradeTypes={tradeTypes}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: 빌드 검증**

```bash
npm run build
```
Expected: 통과 (RegionPicker, FilterBar 등이 아직 없으면 빌드 실패. 다음 태스크에서 만든다 → 빌드는 Task 11 끝에 검증)

> Task 8-11에서 부족한 컴포넌트를 만들기 전까지는 빌드가 실패한다. 정상적인 흐름이다. 커밋은 Task 11에서 함께.

### Task 8: RegionPicker 컴포넌트

**Files:**
- Create: `src/components/explore/RegionPicker.tsx`

- [ ] **Step 1: 컴포넌트 작성**

`src/components/explore/RegionPicker.tsx`:
```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, Search, X } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import type { RegionEntry } from '@/lib/naver-types'

interface Props {
  selected: RegionEntry | null
  onSelect: (r: RegionEntry) => void
}

export function RegionPicker({ selected, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RegionEntry[]>([])
  const [loading, setLoading] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await apiFetch<{ regions: RegionEntry[] }>(`/naver/regions?q=${encodeURIComponent(query)}`)
        setResults(res.regions)
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => clearTimeout(t)
  }, [open, query])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary hover:border-hud-accent-primary transition-hud min-w-[180px]"
      >
        <MapPin size={16} className="text-hud-accent-primary" />
        {selected ? (
          <span className="truncate">
            {selected.sigungu} <span className="text-hud-text-muted">{selected.eup}</span>
          </span>
        ) : (
          <span className="text-hud-text-muted">지역 선택</span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-80 hud-card rounded-lg shadow-hud z-50">
          <div className="p-3 border-b border-hud-border-secondary relative">
            <Search size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-hud-text-muted" />
            <input
              autoFocus
              className="w-full pl-7 pr-7 py-1.5 bg-hud-bg-primary border border-hud-border-secondary rounded text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary"
              placeholder="시군구 또는 동 검색..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-5 top-1/2 -translate-y-1/2 text-hud-text-muted hover:text-hud-text-primary">
                <X size={12} />
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-auto p-1">
            {loading ? (
              <p className="text-xs text-hud-text-muted p-3">검색 중...</p>
            ) : results.length === 0 ? (
              <p className="text-xs text-hud-text-muted p-3">결과 없음</p>
            ) : (
              results.map((r) => (
                <button
                  key={r.legalDivisionNumber}
                  onClick={() => { onSelect(r); setOpen(false); setQuery('') }}
                  className="w-full text-left px-3 py-2 rounded text-sm hover:bg-hud-bg-hover transition-hud"
                >
                  <div className="text-hud-text-primary">{r.sigungu} <span className="text-hud-accent-primary">{r.eup}</span></div>
                  <div className="text-xs text-hud-text-muted">{r.sido} · {r.legalDivisionNumber}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 커밋 — Task 11에서 일괄 커밋 (Task 7-11이 서로 의존)**

### Task 9: FilterBar 컴포넌트

**Files:**
- Create: `src/components/explore/FilterBar.tsx`

- [ ] **Step 1: 작성**

`src/components/explore/FilterBar.tsx`:
```typescript
'use client'

import {
  tradeTypeCodes, tradeTypeLabel,
  realEstateTypeCodes, realEstateTypeLabel,
} from '@/lib/naver-codes'
import type { TradeTypeCode, RealEstateTypeCode } from '@/lib/naver-types'

interface Props {
  tradeTypes: TradeTypeCode[]
  onTradeChange: (next: TradeTypeCode[]) => void
  realEstateTypes: RealEstateTypeCode[]
  onRealEstateChange: (next: RealEstateTypeCode[]) => void
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
}

export function FilterBar({ tradeTypes, onTradeChange, realEstateTypes, onRealEstateChange }: Props) {
  return (
    <div className="flex flex-wrap gap-4">
      <FilterGroup label="거래유형">
        {tradeTypeCodes.map((code) => (
          <ToggleChip
            key={code}
            active={tradeTypes.includes(code)}
            onClick={() => {
              const next = toggle(tradeTypes, code)
              if (next.length === 0) return  // 최소 1개 유지
              onTradeChange(next)
            }}
          >{tradeTypeLabel(code)}</ToggleChip>
        ))}
      </FilterGroup>
      <FilterGroup label="매물종류">
        {realEstateTypeCodes.map((code) => (
          <ToggleChip
            key={code}
            active={realEstateTypes.includes(code)}
            onClick={() => {
              const next = toggle(realEstateTypes, code)
              if (next.length === 0) return
              onRealEstateChange(next)
            }}
          >{realEstateTypeLabel(code)}</ToggleChip>
        ))}
      </FilterGroup>
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-hud-text-muted mr-1">{label}</span>
      {children}
    </div>
  )
}

function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded text-xs transition-hud border ${
        active
          ? 'bg-hud-accent-primary/20 border-hud-accent-primary text-hud-accent-primary'
          : 'bg-hud-bg-secondary border-hud-border-secondary text-hud-text-secondary hover:border-hud-accent-primary/50'
      }`}
    >{children}</button>
  )
}
```

### Task 10: ComplexList 컴포넌트

**Files:**
- Create: `src/components/explore/ComplexList.tsx`

- [ ] **Step 1: 작성**

`src/components/explore/ComplexList.tsx`:
```typescript
'use client'

import { Building, Users, Calendar } from 'lucide-react'
import type { NaverComplex } from '@/lib/naver-types'

interface Props {
  complexes: NaverComplex[]
  loading: boolean
  selectedComplex: string | null
  onSelect: (c: NaverComplex) => void
}

export function ComplexList({ complexes, loading, selectedComplex, onSelect }: Props) {
  return (
    <aside className="w-80 border-r border-hud-border-secondary overflow-auto">
      <div className="p-3 border-b border-hud-border-secondary text-xs text-hud-text-muted">
        단지 {loading ? '...' : complexes.length}곳
      </div>
      {loading ? (
        <p className="p-4 text-sm text-hud-text-muted">불러오는 중...</p>
      ) : complexes.length === 0 ? (
        <p className="p-4 text-sm text-hud-text-muted">표시할 단지가 없습니다.</p>
      ) : (
        <ul>
          {complexes.map((c) => {
            const active = c.complexNumber === selectedComplex
            return (
              <li key={c.complexNumber}>
                <button
                  type="button"
                  onClick={() => onSelect(c)}
                  className={`w-full text-left p-3 border-b border-hud-border-secondary transition-hud
                    ${active
                      ? 'bg-hud-accent-primary/10 border-l-2 border-l-hud-accent-primary'
                      : 'hover:bg-hud-bg-hover'}`}
                >
                  <div className="flex items-start gap-2">
                    <Building size={14} className="text-hud-accent-primary mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-hud-text-primary truncate">{c.complexName}</div>
                      <div className="text-xs text-hud-text-muted truncate">{c.address}</div>
                      <div className="flex gap-3 mt-1 text-xs text-hud-text-secondary">
                        {c.householdCount != null && (
                          <span className="flex items-center gap-1">
                            <Users size={10} />{c.householdCount.toLocaleString()}세대
                          </span>
                        )}
                        {c.builtYear != null && (
                          <span className="flex items-center gap-1">
                            <Calendar size={10} />{c.builtYear}년
                          </span>
                        )}
                        {c.totalArticleCount != null && c.totalArticleCount > 0 && (
                          <span className="text-hud-accent-primary">매물 {c.totalArticleCount}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
```

### Task 11: ArticleTable 컴포넌트 + Phase 3 빌드 + 통합 커밋

**Files:**
- Create: `src/components/explore/ArticleTable.tsx`

- [ ] **Step 1: ArticleTable 작성**

`src/components/explore/ArticleTable.tsx`:
```typescript
'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-client'
import { tradeTypeLabel, formatPrice } from '@/lib/naver-codes'
import type {
  NaverArticle, ArticlesResponse, TradeTypeCode,
} from '@/lib/naver-types'

interface Props {
  complexNumber: string
  tradeTypes: TradeTypeCode[]
}

export function ArticleTable({ complexNumber, tradeTypes }: Props) {
  const [articles, setArticles] = useState<NaverArticle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    apiFetch<ArticlesResponse>('/naver/articles', {
      method: 'POST',
      body: JSON.stringify({ complexNumber, tradeTypes }),
    })
      .then((r) => { if (!cancelled) setArticles(r.articles) })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [complexNumber, tradeTypes.join(',')])

  return (
    <div className="border-t border-hud-border-secondary max-h-[40vh] overflow-auto">
      <div className="px-4 py-2 border-b border-hud-border-secondary bg-hud-bg-secondary text-xs text-hud-text-muted">
        매물 {loading ? '...' : articles.length}건
      </div>
      {error && <p className="p-3 text-sm text-hud-accent-danger">{error}</p>}
      {!loading && articles.length === 0 && !error ? (
        <p className="p-4 text-sm text-hud-text-muted">매물이 없습니다.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-hud-bg-secondary text-left text-xs text-hud-text-muted">
            <tr>
              <th className="px-3 py-1.5 font-medium">매물번호</th>
              <th className="px-3 py-1.5 font-medium">유형</th>
              <th className="px-3 py-1.5 font-medium">평형</th>
              <th className="px-3 py-1.5 font-medium">가격</th>
              <th className="px-3 py-1.5 font-medium">면적</th>
              <th className="px-3 py-1.5 font-medium">층</th>
              <th className="px-3 py-1.5 font-medium">향</th>
              <th className="px-3 py-1.5 font-medium">등록</th>
              <th className="px-3 py-1.5 font-medium">중개사</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hud-border-secondary">
            {articles.map((a) => (
              <tr key={a.articleNo} className="hover:bg-hud-bg-hover">
                <td className="px-3 py-1.5 font-mono text-xs text-hud-text-muted">{a.articleNo}</td>
                <td className="px-3 py-1.5">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-hud-accent-primary/20 text-hud-accent-primary">
                    {tradeTypeLabel(a.tradeType)}
                  </span>
                </td>
                <td className="px-3 py-1.5">{a.pyeongName ?? '-'}</td>
                <td className="px-3 py-1.5 font-mono text-hud-accent-primary">
                  {formatPrice(a.price)}
                  {a.monthlyRent != null && a.monthlyRent > 0 && (
                    <span className="text-hud-text-muted"> / 월 {formatPrice(a.monthlyRent)}</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-hud-text-secondary">{a.exclusiveArea ?? '-'}㎡</td>
                <td className="px-3 py-1.5 text-hud-text-secondary">{a.floor ?? '-'}</td>
                <td className="px-3 py-1.5 text-hud-text-secondary">{a.direction ?? '-'}</td>
                <td className="px-3 py-1.5 text-xs text-hud-text-muted">{a.registeredAt ?? '-'}</td>
                <td className="px-3 py-1.5 text-xs text-hud-text-muted">{a.brokerName ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 빌드 검증 (Task 7-11 전부 모인 상태)**

```bash
npm run build
```
Expected: `Compiled successfully`. `/explore` 라우트가 빌드 산출물에 잡힘.

- [ ] **Step 3: Task 7-11 일괄 커밋**

```bash
git add src/app/\(app\)/explore/ \
        src/components/explore/RegionPicker.tsx \
        src/components/explore/FilterBar.tsx \
        src/components/explore/ComplexList.tsx \
        src/components/explore/ArticleTable.tsx
git commit -m "feat(explore): /explore 페이지 + RegionPicker/FilterBar/ComplexList/ArticleTable + KakaoMap 통합"
```

### Task 12: 사이드바에서 /explore 활성화 확인 + Phase 3 검증

**Files:** 없음 — 검증만

- [ ] **Step 1: Sidebar 항목 확인**

Sidebar(`src/components/layout/Sidebar.tsx`)에 이미 `/explore` 항목이 있음 (Task 18 Phase 2). 변경 불필요.

- [ ] **Step 2: 모든 테스트**

```bash
npm test 2>&1 | tail -10
```
Expected: Phase 1+2의 33 tests + Phase 3 추가 (codes 14 + cache 6 + client 6 + regions 4 + complexes 4 + articles 3 = 37) = **70 passed**.

- [ ] **Step 3: 빌드**

```bash
npm run build
```
Expected: 통과. `/explore` 정적 또는 동적 렌더 표시.

- [ ] **Step 4: dev 서버 수동 라운드트립**

```bash
# DB + dev 서버 이미 떠 있다고 가정
/usr/bin/curl -s -c /tmp/le-c.txt -X POST http://localhost:3000/api/auth/signup \
  -H 'content-type: application/json' \
  -d '{"agency":{"name":"P3"},"owner":{"name":"E","email":"p3@x.com","password":"pw12345678"}}' > /dev/null

echo "--- regions ---"
/usr/bin/curl -s -b /tmp/le-c.txt 'http://localhost:3000/api/naver/regions?q=정자' | head -c 300
echo

echo "--- complexes (실제 Naver 호출; 차단되면 502 가능) ---"
/usr/bin/curl -s -b /tmp/le-c.txt 'http://localhost:3000/api/naver/complexes?eupCode=4111113000&trade=A1&realEstate=A01' | head -c 400
echo
```
Expected:
- regions: `{"regions":[{...정자동...}]}`
- complexes: `{"complexes":[...]}` 또는 `{"error":{"code":"RATE_LIMITED",...}}` (네이버 차단 시 — 디자인 문서에 기록된 알려진 위험)

- [ ] **Step 5: 페이지 라우팅 확인**

```bash
/usr/bin/curl -s -o /dev/null -w "/explore %{http_code}\n" http://localhost:3000/explore
```
Expected: 200

- [ ] **Step 6: 푸시**

```bash
git push origin feat/le-03-naver-explore
```

---

## Notes

- **네이버 차단 위험**: 서버 IP 기반 rate limit. 운영 단계에서 차단되면 retry+backoff + 사용자에게 "잠시 후 다시 시도" 안내. Electron 패키징(미래)으로 자연 해소 예정.
- **Region 데이터 한계**: Phase 3 MVP는 22개 동만 큐레이트. 후속 작업에서 전체 법정동 데이터셋(약 2만 동) 도입 또는 Naver 자체 region search API 통합.
- **Map zoom**: KakaoMap의 `level` 기본값 5는 동 단위 탐색에 적절. 단지 마커 클릭 시 자동 줌인은 후속 작업.
- **Article URL 상태**: `?complex=...`가 매칭되면 ArticleTable이 렌더. 페이지 새로고침해도 상태 유지.
- **세션 캐시는 서버 process 메모리**: Next.js 프로세스 재시작 시 손실. 의도된 단순함.
- **dev 서버 stale chunk**: 새 라우트가 추가될 때 dev 서버에서 종종 "Cannot find module './XXX.js'" 발생. `rm -rf .next && npm run dev` 권장.

## Out of Scope (Phase 4-5)

- 내부 매물 CRUD — Phase 4
- 엑셀 다운로드 (`/explore/download`) — Phase 5
- 평형별 평균가 차트 (`/explore/chart`) — Phase 5
- 전체 법정동 데이터셋
- 단지 상세 페이지 / 사진 그리드
- 시계열 가격 추적 (DB 영속화 없음)
- CSRF 토큰
