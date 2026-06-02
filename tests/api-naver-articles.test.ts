import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/naver/articles/route'
import { articlesCache } from '@/lib/naver-route-caches'

beforeEach(() => {
  articlesCache.clear()
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
