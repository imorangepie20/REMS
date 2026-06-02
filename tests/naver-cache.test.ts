import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCache } from '@/lib/naver-cache'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('naver-cache', () => {
  it('miss → set → hit', () => {
    const c = createCache<string>({ maxEntries: 10, ttlMs: 60_000 })
    expect(c.get('k')).toBeUndefined()
    c.set('k', 'v')
    expect(c.get('k')).toBe('v')
  })

  it('TTL 만료 후 hit 안 됨', () => {
    const c = createCache<string>({ maxEntries: 10, ttlMs: 60_000 })
    c.set('k', 'v')
    vi.advanceTimersByTime(60_001)
    expect(c.get('k')).toBeUndefined()
  })

  it('LRU 초과 시 가장 오래된 항목 삭제', () => {
    const c = createCache<number>({ maxEntries: 3, ttlMs: 60_000 })
    c.set('a', 1); c.set('b', 2); c.set('c', 3)
    c.set('d', 4)  // a 축출
    expect(c.get('a')).toBeUndefined()
    expect(c.get('b')).toBe(2)
    expect(c.get('c')).toBe(3)
    expect(c.get('d')).toBe(4)
  })

  it('hit 시 LRU 순서 갱신', () => {
    const c = createCache<number>({ maxEntries: 3, ttlMs: 60_000 })
    c.set('a', 1); c.set('b', 2); c.set('c', 3)
    c.get('a')   // a를 최신으로
    c.set('d', 4)  // b 축출
    expect(c.get('a')).toBe(1)
    expect(c.get('b')).toBeUndefined()
  })

  it('invalidate(key) — 강제 무효화', () => {
    const c = createCache<string>({ maxEntries: 10, ttlMs: 60_000 })
    c.set('k', 'v')
    c.invalidate('k')
    expect(c.get('k')).toBeUndefined()
  })

  it('clear() — 전체 비움', () => {
    const c = createCache<string>({ maxEntries: 10, ttlMs: 60_000 })
    c.set('a', '1'); c.set('b', '2')
    c.clear()
    expect(c.get('a')).toBeUndefined()
    expect(c.get('b')).toBeUndefined()
  })
})
