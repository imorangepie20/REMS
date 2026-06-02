import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/password'

describe('password', () => {
  it('hash + verify 라운드트립', async () => {
    const hash = await hashPassword('hunter2-strong!')
    expect(hash).not.toBe('hunter2-strong!')
    expect(hash.length).toBeGreaterThan(20)
    expect(await verifyPassword('hunter2-strong!', hash)).toBe(true)
  })
  it('잘못된 비밀번호는 false', async () => {
    const hash = await hashPassword('correct')
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })
})
