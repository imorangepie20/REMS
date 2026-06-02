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
