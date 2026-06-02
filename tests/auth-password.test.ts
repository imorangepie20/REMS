import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signupAgent } from './helpers'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { POST as loginHandler } from '@/app/api/auth/login/route'
import { PATCH as passwordHandler } from '@/app/api/auth/password/route'

beforeEach(async () => { await resetDb() })

describe('PATCH /api/auth/password', () => {
  it('현재 비번 검증 후 새 비번으로 변경 + 새 비번으로 로그인 성공', async () => {
    const { cookie } = await signupAgent(signupHandler, { email: 'pw@x.com', password: 'oldpw1234' })
    const res = await passwordHandler(new Request('http://localhost/api/auth/password', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ current: 'oldpw1234', next: 'newpw5678' }),
    }))
    expect(res.status).toBe(200)

    const login = await loginHandler(new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'pw@x.com', password: 'newpw5678' }),
    }))
    expect(login.status).toBe(200)
  })

  it('현재 비번 틀리면 401', async () => {
    const { cookie } = await signupAgent(signupHandler, { email: 'pw2@x.com', password: 'right1234' })
    const res = await passwordHandler(new Request('http://localhost/api/auth/password', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ current: 'wrong1234', next: 'newpw5678' }),
    }))
    expect(res.status).toBe(401)
  })

  it('비로그인 401', async () => {
    const res = await passwordHandler(new Request('http://localhost/api/auth/password', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ current: 'x', next: 'pw12345678' }),
    }))
    expect(res.status).toBe(401)
  })
})
