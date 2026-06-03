import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signupAgent } from './helpers'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { POST as createListing } from '@/app/api/listings/route'

beforeEach(async () => { await resetDb() })

async function authReq(cookie: string, body: object): Promise<Request> {
  return new Request('http://localhost/api/listings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(body),
  })
}

const baseBody = {
  title: '강남 래미안 30평',
  dealType: 'sale',
  propertyType: 'apartment',
  salePrice: '900000000',
  areaM2: 84.5,
  address: '서울 강남구 역삼동',
}

describe('POST /api/listings', () => {
  it('비로그인 → 401', async () => {
    const res = await createListing(new Request('http://localhost/api/listings', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(baseBody),
    }))
    expect(res.status).toBe(401)
  })

  it('정상 생성 → 200 + 생성자 본인이 createdById', async () => {
    const { agentId, agencyId, cookie } = await signupAgent(signupHandler)
    const res = await createListing(await authReq(cookie, baseBody))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toBe('강남 래미안 30평')
    expect(body.createdById).toBe(agentId)
    expect(body.agencyId).toBe(agencyId)
    expect(body.salePrice).toBe('900000000')
  })

  it('매매에 salePrice 없으면 400', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const { salePrice, ...rest } = baseBody
    void salePrice
    const res = await createListing(await authReq(cookie, rest))
    expect(res.status).toBe(400)
  })

  it('전세에 deposit 없으면 400', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const res = await createListing(await authReq(cookie, {
      ...baseBody, dealType: 'jeonse', salePrice: undefined,
    }))
    expect(res.status).toBe(400)
  })

  it('월세 — deposit + monthlyRent 둘 다 필수', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const res = await createListing(await authReq(cookie, {
      ...baseBody, dealType: 'wolse', salePrice: undefined, deposit: '50000000',
    }))
    expect(res.status).toBe(400)
  })
})
