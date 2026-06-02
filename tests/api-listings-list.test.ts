import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signupAgent, addMember } from './helpers'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { POST as loginHandler } from '@/app/api/auth/login/route'
import { POST as createListing, GET as listListings } from '@/app/api/listings/route'

beforeEach(async () => { await resetDb() })

async function loginCookie(email: string, password: string): Promise<string> {
  const r = await loginHandler(new Request('http://localhost/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }))
  return (r.headers.get('set-cookie') ?? '').match(/le_session=[^;]+/)?.[0] ?? ''
}

async function createOne(cookie: string, override: object = {}): Promise<number> {
  const r = await createListing(new Request('http://localhost/api/listings', {
    method: 'POST', headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      title: '매물',
      dealType: 'sale', propertyType: 'apartment',
      salePrice: '900000000', areaM2: 84.5, address: '주소',
      ownerName: '김철수', ownerPhone: '010-1234-5678', ownerMemo: '메모', privateMemo: '비공개',
      ...override,
    }),
  }))
  const body = await r.json()
  return body.id
}

describe('GET /api/listings', () => {
  it('비로그인 → 401', async () => {
    const r = await listListings(new Request('http://localhost/api/listings'))
    expect(r.status).toBe(401)
  })

  it('빈 목록 → []', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const r = await listListings(new Request('http://localhost/api/listings', { headers: { cookie } }))
    const body = await r.json()
    expect(body.data).toEqual([])
    expect(body.total).toBe(0)
  })

  it('내가 만든 매물 → 모든 필드 평문', async () => {
    const { cookie } = await signupAgent(signupHandler, { email: 'self@x.com', password: 'pw12345678' })
    await createOne(cookie)
    const r = await listListings(new Request('http://localhost/api/listings', { headers: { cookie } }))
    const body = await r.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].ownerName).toBe('김철수')
    expect(body.data[0].ownerPhone).toBe('010-1234-5678')
    expect(body.data[0].privateMemo).toBe('비공개')
  })

  it('다른 member의 매물 — owner 정보 마스킹, privateMemo 없음', async () => {
    const { agencyId, cookie: m1cookie } = await signupAgent(signupHandler, { email: 'm1@x.com', password: 'pw12345678' })
    await createOne(m1cookie)
    const m2email = `m2-${Date.now()}@x.com`
    const m2pw = 'pw12345678'
    await prisma.agent.create({
      data: { agencyId, name: 'M2', email: m2email, passwordHash: await hashPassword(m2pw), role: 'member' },
    })
    const m2cookie = await loginCookie(m2email, m2pw)
    const r = await listListings(new Request('http://localhost/api/listings', { headers: { cookie: m2cookie } }))
    const body = await r.json()
    expect(body.data[0].ownerName).toBe('김***')
    expect(body.data[0].ownerPhone).toMatch(/[*-]+5678$/)
    expect(body.data[0].ownerMemo).toBeNull()
    expect(body.data[0].privateMemo).toBeUndefined()
  })

  it('owner는 다른 멤버 매물도 평문', async () => {
    const { agencyId, cookie: ownerCookie } = await signupAgent(signupHandler, { email: 'owner@x.com', password: 'pw12345678' })
    const m = await addMember(agencyId)
    const mcookie = await loginCookie(m.email, m.password)
    await createOne(mcookie)
    const r = await listListings(new Request('http://localhost/api/listings', { headers: { cookie: ownerCookie } }))
    const body = await r.json()
    expect(body.data[0].ownerName).toBe('김철수')
    expect(body.data[0].privateMemo).toBe('비공개')
  })

  it('타사무소 매물은 보이지 않는다', async () => {
    const A = await signupAgent(signupHandler, { agencyName: 'A', email: 'a@x.com', password: 'pw12345678' })
    await createOne(A.cookie, { title: 'A매물' })
    const B = await signupAgent(signupHandler, { agencyName: 'B', email: 'b@x.com', password: 'pw12345678' })
    const r = await listListings(new Request('http://localhost/api/listings', { headers: { cookie: B.cookie } }))
    const body = await r.json()
    expect(body.data).toEqual([])
  })

  it('q 필터 — 제목·주소 부분일치', async () => {
    const { cookie } = await signupAgent(signupHandler, { email: 'q@x.com', password: 'pw12345678' })
    await createOne(cookie, { title: '강남 아파트' })
    await createOne(cookie, { title: '서초 빌라', address: '서울 서초구' })
    const r = await listListings(new Request('http://localhost/api/listings?q=강남', { headers: { cookie } }))
    const body = await r.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe('강남 아파트')
  })

  it('dealType 필터', async () => {
    const { cookie } = await signupAgent(signupHandler, { email: 'd@x.com', password: 'pw12345678' })
    await createOne(cookie)
    await createOne(cookie, { dealType: 'jeonse', salePrice: undefined, deposit: '500000000' })
    const r = await listListings(new Request('http://localhost/api/listings?dealType=jeonse', { headers: { cookie } }))
    const body = await r.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].dealType).toBe('jeonse')
  })

  it('페이지네이션 — limit=2, page=2', async () => {
    const { cookie } = await signupAgent(signupHandler, { email: 'p@x.com', password: 'pw12345678' })
    for (let i = 0; i < 5; i++) await createOne(cookie, { title: `t${i}` })
    const r = await listListings(new Request('http://localhost/api/listings?limit=2&page=2', { headers: { cookie } }))
    const body = await r.json()
    expect(body.data).toHaveLength(2)
    expect(body.total).toBe(5)
    expect(body.page).toBe(2)
    expect(body.limit).toBe(2)
  })
})
