import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signupAgent } from './helpers'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { POST as createListing } from '@/app/api/listings/route'
import { GET as getListing } from '@/app/api/listings/[id]/route'

beforeEach(async () => { await resetDb() })

async function createOne(cookie: string, title = 'L'): Promise<number> {
  const r = await createListing(new Request('http://localhost/api/listings', {
    method: 'POST', headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      title, dealType: 'sale', propertyType: 'apartment',
      salePrice: '900000000', areaM2: 84.5, address: '주소', privateMemo: 'secret',
    }),
  }))
  return (await r.json()).id
}

describe('GET /api/listings/[id]', () => {
  it('정상 조회 — 본인이면 privateMemo 노출', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const id = await createOne(cookie)
    const r = await getListing(
      new Request(`http://localhost/api/listings/${id}`, { headers: { cookie } }),
      { params: Promise.resolve({ id: String(id) }) },
    )
    expect(r.status).toBe(200)
    const body = await r.json()
    expect(body.id).toBe(id)
    expect(body.privateMemo).toBe('secret')
  })

  it('비로그인 → 401', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const id = await createOne(cookie)
    const r = await getListing(
      new Request(`http://localhost/api/listings/${id}`),
      { params: Promise.resolve({ id: String(id) }) },
    )
    expect(r.status).toBe(401)
  })

  it('타사무소 매물 — 404', async () => {
    const A = await signupAgent(signupHandler, { agencyName: 'A', email: 'a@x.com', password: 'pw12345678' })
    const id = await createOne(A.cookie)
    const B = await signupAgent(signupHandler, { agencyName: 'B', email: 'b@x.com', password: 'pw12345678' })
    const r = await getListing(
      new Request(`http://localhost/api/listings/${id}`, { headers: { cookie: B.cookie } }),
      { params: Promise.resolve({ id: String(id) }) },
    )
    expect(r.status).toBe(404)
  })

  it('존재하지 않는 id → 404', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const r = await getListing(
      new Request(`http://localhost/api/listings/999999`, { headers: { cookie } }),
      { params: Promise.resolve({ id: '999999' }) },
    )
    expect(r.status).toBe(404)
  })
})
