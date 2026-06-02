import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signupAgent, addMember } from './helpers'
import { prisma } from '@/lib/db'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { POST as loginHandler } from '@/app/api/auth/login/route'
import { POST as createListing } from '@/app/api/listings/route'
import { DELETE as deleteListing } from '@/app/api/listings/[id]/route'

beforeEach(async () => { await resetDb() })

async function loginCookie(email: string, password: string): Promise<string> {
  const r = await loginHandler(new Request('http://localhost/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }))
  return (r.headers.get('set-cookie') ?? '').match(/le_session=[^;]+/)?.[0] ?? ''
}

async function createOne(cookie: string): Promise<number> {
  const r = await createListing(new Request('http://localhost/api/listings', {
    method: 'POST', headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      title: 'L', dealType: 'sale', propertyType: 'apartment',
      salePrice: '900000000', areaM2: 84.5, address: '주소',
    }),
  }))
  return (await r.json()).id
}

function delReq(id: number, cookie: string) {
  return {
    req: new Request(`http://localhost/api/listings/${id}`, {
      method: 'DELETE', headers: { cookie },
    }),
    ctx: { params: Promise.resolve({ id: String(id) }) },
  }
}

describe('DELETE /api/listings/[id]', () => {
  it('본인 → 200, DB에서 삭제됨', async () => {
    const { cookie } = await signupAgent(signupHandler, { email: 'self@x.com', password: 'pw12345678' })
    const id = await createOne(cookie)
    const { req, ctx } = delReq(id, cookie)
    const r = await deleteListing(req, ctx)
    expect(r.status).toBe(200)
    const exists = await prisma.internalListing.findUnique({ where: { id } })
    expect(exists).toBeNull()
  })

  it('owner → 200 (다른 멤버 매물)', async () => {
    const { agencyId, cookie: ownerCookie } = await signupAgent(signupHandler, { email: 'o@x.com', password: 'pw12345678' })
    const m = await addMember(agencyId)
    const mcookie = await loginCookie(m.email, m.password)
    const id = await createOne(mcookie)
    const { req, ctx } = delReq(id, ownerCookie)
    const r = await deleteListing(req, ctx)
    expect(r.status).toBe(200)
  })

  it('다른 member → 403', async () => {
    const { agencyId, cookie: m1cookie } = await signupAgent(signupHandler, { email: 'm1@x.com', password: 'pw12345678' })
    const id = await createOne(m1cookie)
    const m2 = await addMember(agencyId)
    const m2cookie = await loginCookie(m2.email, m2.password)
    const { req, ctx } = delReq(id, m2cookie)
    const r = await deleteListing(req, ctx)
    expect(r.status).toBe(403)
  })

  it('타사무소 → 404', async () => {
    const A = await signupAgent(signupHandler, { agencyName: 'A', email: 'a@x.com', password: 'pw12345678' })
    const id = await createOne(A.cookie)
    const B = await signupAgent(signupHandler, { agencyName: 'B', email: 'b@x.com', password: 'pw12345678' })
    const { req, ctx } = delReq(id, B.cookie)
    const r = await deleteListing(req, ctx)
    expect(r.status).toBe(404)
  })
})
