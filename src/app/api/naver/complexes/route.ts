import { NextResponse } from 'next/server'
import { fetchComplexes, NaverUpstreamError } from '@/lib/naver-client'
import { errorResponse, requireAuth } from '@/lib/auth-helpers'
import { complexesCache } from '@/lib/naver-route-caches'
import type { TradeTypeCode, RealEstateTypeCode } from '@/lib/naver-types'

function naverErrorResponse(err: NaverUpstreamError): NextResponse {
  return NextResponse.json(
    { error: { code: err.code, message: err.message } },
    { status: 502 },
  )
}

export async function GET(req: Request): Promise<NextResponse> {
  try {
    await requireAuth(req)
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

    const cached = complexesCache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached, { headers: { 'x-cache': 'hit' } })
    }

    try {
      const result = await fetchComplexes({ eupCode, tradeTypes, realEstateTypes })
      complexesCache.set(cacheKey, result)
      return NextResponse.json(result, { headers: { 'x-cache': 'miss' } })
    } catch (e) {
      if (e instanceof NaverUpstreamError) return naverErrorResponse(e)
      throw e
    }
  } catch (err) {
    return errorResponse(err)
  }
}
