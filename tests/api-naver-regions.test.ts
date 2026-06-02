import { beforeEach, describe, expect, it } from 'vitest'
import { GET } from '@/app/api/naver/regions/route'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { resetDb, signupAgent } from './helpers'

beforeEach(async () => { await resetDb() })

function reqAuth(url: string, cookie: string): Request {
  return new Request(url, { headers: { cookie } })
}

describe('GET /api/naver/regions', () => {
  it('비로그인 → 401', async () => {
    const res = await GET(new Request('http://localhost/api/naver/regions'))
    expect(res.status).toBe(401)
  })

  it('빈 쿼리 → 기본 리스트 반환', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const res = await GET(reqAuth('http://localhost/api/naver/regions', cookie))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.regions)).toBe(true)
    expect(body.regions.length).toBeGreaterThan(0)
  })

  it('q=정자 → 매칭 반환', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const res = await GET(reqAuth('http://localhost/api/naver/regions?q=정자', cookie))
    const body = await res.json()
    const eups = body.regions.map((r: { eup: string }) => r.eup)
    expect(eups).toContain('정자동')
  })

  it('q=강남 → 강남구 항목들 반환', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const res = await GET(reqAuth('http://localhost/api/naver/regions?q=강남', cookie))
    const body = await res.json()
    expect(body.regions.length).toBeGreaterThan(0)
    expect(body.regions.every((r: { sigungu: string }) => r.sigungu.includes('강남'))).toBe(true)
  })

  it('q=zzzzzz → 빈 배열', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const res = await GET(reqAuth('http://localhost/api/naver/regions?q=zzzzzz', cookie))
    const body = await res.json()
    expect(body.regions).toEqual([])
  })
})
