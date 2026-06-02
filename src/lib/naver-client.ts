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
