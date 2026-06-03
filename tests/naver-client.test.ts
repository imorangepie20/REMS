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
      isSuccess: true,
      result: {
        hasNextPage: false,
        totalCount: 1,
        list: [{
          complexInfo: {
            complexNumber: 102614,
            name: '테스트단지',
            type: 'A01',
            totalHouseholdNumber: 1234,
            useApprovalDate: '20150601',
            roadNameAddress: '경기도 수원시 장안구 정자동',
            latitude: 37.30,
            longitude: 126.97,
          },
          articleCountInfo: {
            dealCount: 8,
            leaseDepositCount: 3,
            leaseMonthlyCount: 1,
            leaseShortTerm: 0,
          },
        }],
      },
    })
    const res = await fetchComplexes({ eupCode: '4111113000', tradeTypes: ['A1'], realEstateTypes: ['A01'] })
    expect(res.complexes).toHaveLength(1)
    expect(res.complexes[0].complexNumber).toBe('102614')
    expect(res.complexes[0].complexName).toBe('테스트단지')
    expect(res.complexes[0].latitude).toBe(37.30)
    expect(res.complexes[0].householdCount).toBe(1234)
    expect(res.complexes[0].builtYear).toBe(2015)
    expect(res.complexes[0].totalArticleCount).toBe(12)
    expect(res.total).toBe(1)
  })

  it('Referer 헤더 부착', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementationOnce(async () =>
      new Response(JSON.stringify({ isSuccess: true, result: { list: [], totalCount: 0 } }), { status: 200 }))
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
