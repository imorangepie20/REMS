import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signupAgent, addMember } from './helpers'
import { prisma } from '@/lib/db'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { POST as loginHandler } from '@/app/api/auth/login/route'
import { PATCH as agencyHandler } from '@/app/api/agency/route'

beforeEach(async () => { await resetDb() })

describe('PATCH /api/agency', () => {
  it('owner — 사무소 정보 수정 200', async () => {
    const { agencyId, cookie } = await signupAgent(signupHandler)
    const res = await agencyHandler(new Request('http://localhost/api/agency', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: '신규명', phone: '02-1234-5678', address: '서울시 강남구' }),
    }))
    expect(res.status).toBe(200)
    const updated = await prisma.agency.findUnique({ where: { id: agencyId } })
    expect(updated?.name).toBe('신규명')
    expect(updated?.phone).toBe('02-1234-5678')
  })

  it('member — 403', async () => {
    const { agencyId } = await signupAgent(signupHandler)
    const member = await addMember(agencyId)
    const login = await loginHandler(new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: member.email, password: member.password }),
    }))
    const cookie = (login.headers.get('set-cookie') ?? '').match(/le_session=[^;]+/)?.[0] ?? ''
    const res = await agencyHandler(new Request('http://localhost/api/agency', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: 'X' }),
    }))
    expect(res.status).toBe(403)
  })

  it('비로그인 — 401', async () => {
    const res = await agencyHandler(new Request('http://localhost/api/agency', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    }))
    expect(res.status).toBe(401)
  })
})
