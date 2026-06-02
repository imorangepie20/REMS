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
