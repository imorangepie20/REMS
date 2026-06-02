import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signupAgent } from './helpers'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { POST as loginHandler } from '@/app/api/auth/login/route'

beforeEach(async () => { await resetDb() })

describe('POST /api/auth/login', () => {
  it('올바른 자격증명으로 200 + 세션 쿠키', async () => {
    await signupAgent(signupHandler, { email: 'a@x.com', password: 'pw12345678' })
    const res = await loginHandler(new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@x.com', password: 'pw12345678' }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.agent.email).toBe('a@x.com')
    expect(res.headers.get('set-cookie')).toMatch(/le_session=/)
  })

  it('잘못된 비밀번호면 401', async () => {
    await signupAgent(signupHandler, { email: 'b@x.com', password: 'right1234' })
    const res = await loginHandler(new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'b@x.com', password: 'wrong1234' }),
    }))
    expect(res.status).toBe(401)
  })

  it('없는 이메일이면 401', async () => {
    const res = await loginHandler(new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@x.com', password: 'pw12345678' }),
    }))
    expect(res.status).toBe(401)
  })
})
