import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signupAgent, addMember } from './helpers'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { POST as loginHandler } from '@/app/api/auth/login/route'
import { GET as listAgents, POST as createAgent } from '@/app/api/agents/route'
import { PATCH as updateAgent } from '@/app/api/agents/[id]/route'

beforeEach(async () => { await resetDb() })

function loginCookie(email: string, password: string) {
  return loginHandler(new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })).then((r) => (r.headers.get('set-cookie') ?? '').match(/le_session=[^;]+/)?.[0] ?? '')
}

describe('GET /api/agents', () => {
  it('owner — 사무소 멤버 리스트', async () => {
    const { agencyId, cookie } = await signupAgent(signupHandler, { email: 'o@x.com', password: 'pw12345678' })
    await addMember(agencyId, { email: 'm1@x.com' })
    await addMember(agencyId, { email: 'm2@x.com' })
    const res = await listAgents(new Request('http://localhost/api/agents', { headers: { cookie } }))
    expect(res.status).toBe(200)
    const arr = await res.json()
    expect(arr).toHaveLength(3)
    expect(arr.map((a: { email: string }) => a.email).sort()).toEqual(['m1@x.com', 'm2@x.com', 'o@x.com'])
  })

  it('member — 같은 사무소 리스트 가능', async () => {
    const { agencyId } = await signupAgent(signupHandler, { email: 'owner@x.com', password: 'pw12345678' })
    const member = await addMember(agencyId, { email: 'mem@x.com' })
    const cookie = await loginCookie(member.email, member.password)
    const res = await listAgents(new Request('http://localhost/api/agents', { headers: { cookie } }))
    expect(res.status).toBe(200)
  })

  it('비로그인 401', async () => {
    const res = await listAgents(new Request('http://localhost/api/agents'))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/agents', () => {
  it('owner — 새 멤버 생성 200', async () => {
    const { cookie } = await signupAgent(signupHandler, { email: 'o2@x.com', password: 'pw12345678' })
    const res = await createAgent(new Request('http://localhost/api/agents', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: '신규멤버', email: 'new@x.com', password: 'pw12345678', phone: '010-9999-9999' }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.email).toBe('new@x.com')
    expect(body.role).toBe('member')
  })

  it('member — 멤버 생성 시도 403', async () => {
    const { agencyId } = await signupAgent(signupHandler, { email: 'o3@x.com', password: 'pw12345678' })
    const m = await addMember(agencyId)
    const cookie = await loginCookie(m.email, m.password)
    const res = await createAgent(new Request('http://localhost/api/agents', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: 'x', email: 'fail@x.com', password: 'pw12345678' }),
    }))
    expect(res.status).toBe(403)
  })

  it('이메일 중복 409', async () => {
    const { cookie } = await signupAgent(signupHandler, { email: 'o4@x.com', password: 'pw12345678' })
    const payload = JSON.stringify({ name: 'd', email: 'dup-mem@x.com', password: 'pw12345678' })
    await createAgent(new Request('http://localhost/api/agents', {
      method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: payload,
    }))
    const second = await createAgent(new Request('http://localhost/api/agents', {
      method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: payload,
    }))
    expect(second.status).toBe(409)
  })
})

describe('PATCH /api/agents/[id]', () => {
  it('본인 — name/phone 수정 200', async () => {
    const { agentId, cookie } = await signupAgent(signupHandler, { email: 'self@x.com', password: 'pw12345678' })
    const res = await updateAgent(
      new Request(`http://localhost/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ name: '바꿈', phone: '010-0000-0000' }),
      }),
      { params: Promise.resolve({ id: String(agentId) }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('바꿈')
  })

  it('member — 다른 사람 수정 시도 403', async () => {
    const { agencyId } = await signupAgent(signupHandler, { email: 'o5@x.com', password: 'pw12345678' })
    const m1 = await addMember(agencyId, { email: 'mm1@x.com' })
    const m2 = await addMember(agencyId, { email: 'mm2@x.com' })
    const cookie = await loginCookie(m1.email, m1.password)
    const res = await updateAgent(
      new Request(`http://localhost/api/agents/${m2.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ name: 'x' }),
      }),
      { params: Promise.resolve({ id: String(m2.id) }) },
    )
    expect(res.status).toBe(403)
  })

  it('owner — 멤버 status 변경 200', async () => {
    const { agencyId, cookie } = await signupAgent(signupHandler, { email: 'o6@x.com', password: 'pw12345678' })
    const m = await addMember(agencyId)
    const res = await updateAgent(
      new Request(`http://localhost/api/agents/${m.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ status: 'suspended' }),
      }),
      { params: Promise.resolve({ id: String(m.id) }) },
    )
    expect(res.status).toBe(200)
  })

  it('member — 자기 status 변경 시도 403', async () => {
    const { agencyId } = await signupAgent(signupHandler, { email: 'o7@x.com', password: 'pw12345678' })
    const m = await addMember(agencyId)
    const cookie = await loginCookie(m.email, m.password)
    const res = await updateAgent(
      new Request(`http://localhost/api/agents/${m.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ status: 'suspended' }),
      }),
      { params: Promise.resolve({ id: String(m.id) }) },
    )
    expect(res.status).toBe(403)
  })
})
