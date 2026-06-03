import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/naver/complexes/route'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { complexesCache } from '@/lib/naver-route-caches'
import { resetDb, signupAgent, type SignupResult } from './helpers'

let session: SignupResult

beforeEach(async () => {
  await resetDb()
  complexesCache.clear()
  session = await signupAgent(signupHandler)
})
afterEach(() => vi.restoreAllMocks())

function mockComplexFetchOnce(complexes: Array<{ complexNumber: string; complexName: string }>) {
  vi.spyOn(global, 'fetch').mockImplementationOnce(async () =>
    new Response(JSON.stringify({
      isSuccess: true,
      result: {
        totalCount: complexes.length,
        list: complexes.map((c) => ({
          complexInfo: { complexNumber: Number(c.complexNumber), name: c.complexName, roadNameAddress: '주소' },
          articleCountInfo: { dealCount: 0, leaseDepositCount: 0, leaseMonthlyCount: 0, leaseShortTerm: 0 },
        })),
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
}

function authReq(url: string): Request {
  return new Request(url, { headers: { cookie: session.cookie } })
}

describe('GET /api/naver/complexes', () => {
  it('비로그인 → 401', async () => {
    const res = await GET(new Request('http://localhost/api/naver/complexes?eupCode=4111113000&trade=A1&realEstate=A01'))
    expect(res.status).toBe(401)
  })

  it('eupCode + tradeTypes + realEstateTypes로 fetch 호출', async () => {
    mockComplexFetchOnce([{ complexNumber: '102614', complexName: '테스트단지' }])
    const res = await GET(authReq('http://localhost/api/naver/complexes?eupCode=4111113000&trade=A1&realEstate=A01'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.complexes).toHaveLength(1)
    expect(body.complexes[0].complexNumber).toBe('102614')
  })

  it('같은 쿼리 두 번 호출 → 두 번째는 캐시', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({
        isSuccess: true,
        result: { totalCount: 1, list: [{ complexInfo: { complexNumber: 1, name: 'A' } }] },
      }), { status: 200 }))
    const url = 'http://localhost/api/naver/complexes?eupCode=4111113000&trade=A1&realEstate=A01'
    await GET(authReq(url))
    await GET(authReq(url))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('eupCode 없으면 400', async () => {
    const res = await GET(authReq('http://localhost/api/naver/complexes?trade=A1&realEstate=A01'))
    expect(res.status).toBe(400)
  })

  it('네이버 429 → 502 + RATE_LIMITED 코드', async () => {
    vi.spyOn(global, 'fetch').mockImplementationOnce(async () =>
      new Response('{}', { status: 429 }))
    const res = await GET(authReq('http://localhost/api/naver/complexes?eupCode=4111113000&trade=A1&realEstate=A01'))
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})
