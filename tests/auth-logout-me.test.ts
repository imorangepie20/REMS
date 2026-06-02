import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signupAgent } from './helpers'
import { POST as signupHandler } from '@/app/api/auth/signup/route'
import { GET as meHandler } from '@/app/api/auth/me/route'
import { POST as logoutHandler } from '@/app/api/auth/logout/route'

beforeEach(async () => { await resetDb() })

function withCookie(url: string, cookie: string, init: RequestInit = {}): Request {
  return new Request(url, { ...init, headers: { ...(init.headers ?? {}), cookie } })
}

describe('auth me/logout', () => {
  it('GET /me — 쿠키 없으면 401', async () => {
    const res = await meHandler(new Request('http://localhost/api/auth/me'))
    expect(res.status).toBe(401)
  })

  it('GET /me — 가입 직후 쿠키로 200 + agent 정보', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const res = await meHandler(withCookie('http://localhost/api/auth/me', cookie))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.agent.role).toBe('owner')
    expect(body.agency).toBeTruthy()
  })

  it('POST /logout — 쿠키 무효화', async () => {
    const { cookie } = await signupAgent(signupHandler)
    const out = await logoutHandler(withCookie('http://localhost/api/auth/logout', cookie, { method: 'POST' }))
    expect(out.status).toBe(200)
    // 쿠키 삭제 헤더 확인
    expect(out.headers.get('set-cookie') ?? '').toMatch(/le_session=/)
    // 같은 쿠키로 me 호출 시 세션 DB 레코드는 삭제됐어야 함 → 401
    const me = await meHandler(withCookie('http://localhost/api/auth/me', cookie))
    expect(me.status).toBe(401)
  })
})
