import type {
  ComplexesResponse, ArticlesResponse, TradeTypeCode, RealEstateTypeCode,
} from './naver-types'

const BASE = 'https://fin.land.naver.com/front-api/v1'
const ORIGIN = 'https://fin.land.naver.com'
const REFERER = 'https://fin.land.naver.com/map?tradeTypes=A1&realEstateTypes=A01&hasArticleComplex=true'
// 실제 Chrome 148 macOS와 일치 — sec-ch-ua 클라이언트 힌트의 버전과 매칭되어야 봇 식별 우회
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'

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

/**
 * 실제 브라우저(Chrome 148 / macOS)의 헤더 풀세트.
 * 네이버는 sec-ch-ua 클라이언트 힌트로 봇/실제 브라우저를 식별하므로
 * User-Agent 위장만으로는 차단을 우회할 수 없다.
 */
function commonHeaders(): Record<string, string> {
  return {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7',
    'cache-control': 'no-cache',
    origin: ORIGIN,
    pragma: 'no-cache',
    priority: 'u=1, i',
    referer: REFERER,
    'sec-ch-ua': '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': USER_AGENT,
  }
}

// ============================================================
// 쿠키 워밍업
// ============================================================
// 브라우저는 fin.land.naver.com을 처음 방문할 때 anonymous 세션 쿠키(NID_AUT 등)를
// 받아두고 이후 /front-api 호출 시 자동 부착한다. 서버 fetch는 쿠키 jar이 없으므로
// 차단 대상. 매 30분마다 / 매 RATE_LIMITED 응답마다 워밍업해서 동등 흉내.
//
// Vitest 환경(VITEST=true)에서는 워밍업을 비활성화 — 기존 mock 테스트 호환.

const WARMUP_URL = 'https://fin.land.naver.com/map?tradeTypes=A1&realEstateTypes=A01&hasArticleComplex=true'
const WARMUP_TTL_MS = 30 * 60_000  // 30분
const SKIP_WARMUP = process.env.VITEST === 'true'

interface WarmupState {
  cookieHeader: string | null
  warmupAt: number
  inFlight: Promise<void> | null
}

const warmup: WarmupState = {
  cookieHeader: null,
  warmupAt: 0,
  inFlight: null,
}

function navigationHeaders(): Record<string, string> {
  return {
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7',
    'cache-control': 'no-cache',
    pragma: 'no-cache',
    priority: 'u=0, i',
    'sec-ch-ua': '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'user-agent': USER_AGENT,
  }
}

function extractCookies(res: Response): string | null {
  // Node fetch (undici): Headers.getSetCookie() returns string[]
  // 폴백: raw response.headers.get('set-cookie') (단일 합쳐진 문자열)
  const headersWithGetSetCookie = res.headers as Headers & {
    getSetCookie?: () => string[]
  }
  const setCookies = headersWithGetSetCookie.getSetCookie?.() ?? []
  if (setCookies.length === 0) return null
  // 각 Set-Cookie 값에서 이름=값만 추출 ("name=val; Path=/; ..." → "name=val")
  return setCookies
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ')
}

async function performWarmup(): Promise<void> {
  try {
    const res = await fetch(WARMUP_URL, { headers: navigationHeaders() })
    const cookies = extractCookies(res)
    if (cookies) {
      warmup.cookieHeader = cookies
      warmup.warmupAt = Date.now()
    }
  } catch {
    // 워밍업 실패 시 조용히 — 다음 호출에서 다시 시도
  }
}

async function warmupIfStale(): Promise<void> {
  if (SKIP_WARMUP) return
  if (warmup.cookieHeader && Date.now() - warmup.warmupAt < WARMUP_TTL_MS) return
  if (warmup.inFlight) {
    await warmup.inFlight
    return
  }
  warmup.inFlight = performWarmup()
  try { await warmup.inFlight } finally { warmup.inFlight = null }
}

function invalidateWarmup(): void {
  warmup.cookieHeader = null
  warmup.warmupAt = 0
}

/** 테스트용 — 워밍업 상태를 강제 초기화 */
export function _resetWarmup(): void { invalidateWarmup() }

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  await warmupIfStale()
  const headers: Record<string, string> = { ...commonHeaders(), ...(init.headers as Record<string, string> ?? {}) }
  if (warmup.cookieHeader) headers.cookie = warmup.cookieHeader

  let res: Response
  try {
    res = await fetch(url, { ...init, headers })
  } catch (e) {
    throw new NaverUpstreamError('NETWORK', e instanceof Error ? e.message : 'network error')
  }
  if (res.status === 429) {
    // 차단 받은 쿠키는 이미 식별된 상태로 간주 — 다음 호출 전 재워밍업
    invalidateWarmup()
    throw new NaverUpstreamError('RATE_LIMITED', '네이버 호출 한도 초과 — 잠시 후 다시 시도', 429)
  }
  if (res.status === 404) {
    throw new NaverUpstreamError('NOT_FOUND', '없는 리소스', 404)
  }
  if (res.status >= 400) {
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
