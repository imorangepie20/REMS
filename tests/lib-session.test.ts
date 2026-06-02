import { describe, it, expect } from 'vitest'
import { generateSessionToken, SESSION_COOKIE } from '@/lib/session'

describe('session', () => {
  it('토큰은 64자 hex 문자열', () => {
    const t = generateSessionToken()
    expect(t).toMatch(/^[0-9a-f]{64}$/)
  })
  it('두 번 호출하면 서로 다른 토큰', () => {
    expect(generateSessionToken()).not.toBe(generateSessionToken())
  })
  it('쿠키 이름은 le_session', () => {
    expect(SESSION_COOKIE).toBe('le_session')
  })
})
