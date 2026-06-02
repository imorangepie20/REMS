import { NextResponse } from 'next/server'
import { fetchArticles, NaverUpstreamError } from '@/lib/naver-client'
import { errorResponse } from '@/lib/auth-helpers'
import { articlesCache } from '@/lib/naver-route-caches'
import type { TradeTypeCode } from '@/lib/naver-types'

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

    const cached = articlesCache.get(cacheKey)
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
      articlesCache.set(cacheKey, result)
      return NextResponse.json(result, { headers: { 'x-cache': 'miss' } })
    } catch (e) {
      if (e instanceof NaverUpstreamError) return naverErrorResponse(e)
      throw e
    }
  } catch (err) {
    return errorResponse(err)
  }
}
