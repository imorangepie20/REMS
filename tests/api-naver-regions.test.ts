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
