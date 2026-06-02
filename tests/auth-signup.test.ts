import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb } from './helpers'
import { POST } from '@/app/api/auth/signup/route'

beforeEach(async () => { await resetDb() })

describe('POST /api/auth/signup', () => {
  it('agency + owner를 생성하고 세션 쿠키를 발급한다', async () => {
    const req = new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agency: { name: '테스트사무소' },
        owner: { name: '홍길동', email: 'test@example.com', password: 'pw12345678', phone: '010-1234-5678' },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.agency.name).toBe('테스트사무소')
    expect(body.agent.email).toBe('test@example.com')
    expect(body.agent.role).toBe('owner')
    expect(res.headers.get('set-cookie')).toMatch(/le_session=/)
  })

  it('잘못된 이메일이면 400', async () => {
    const req = new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agency: { name: 'A' },
        owner: { name: 'B', email: 'not-an-email', password: 'pw12345678' },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('이메일 중복이면 409', async () => {
    const payload = JSON.stringify({
      agency: { name: 'A' },
      owner: { name: 'B', email: 'dup@example.com', password: 'pw12345678' },
    })
    const first = await POST(new Request('http://localhost/api/auth/signup', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: payload,
    }))
    expect(first.status).toBe(200)
    const second = await POST(new Request('http://localhost/api/auth/signup', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: payload,
    }))
    expect(second.status).toBe(409)
  })
})
