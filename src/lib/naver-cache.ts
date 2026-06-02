export interface CacheOptions {
  maxEntries: number
  ttlMs: number
}

export interface Cache<T> {
  get(key: string): T | undefined
  set(key: string, value: T): void
  invalidate(key: string): void
  clear(): void
}

interface Entry<T> {
  value: T
  expiresAt: number
}

/**
 * LRU + TTL 캐시. Map의 삽입 순서 보존 특성을 이용.
 */
export function createCache<T>({ maxEntries, ttlMs }: CacheOptions): Cache<T> {
  const map = new Map<string, Entry<T>>()

  function isExpired(entry: Entry<T>): boolean {
    return entry.expiresAt <= Date.now()
  }

  return {
    get(key) {
      const entry = map.get(key)
      if (!entry) return undefined
      if (isExpired(entry)) {
        map.delete(key)
        return undefined
      }
      // LRU 갱신: 삭제 후 재삽입으로 가장 최신으로
      map.delete(key)
      map.set(key, entry)
      return entry.value
    },
    set(key, value) {
      if (map.has(key)) map.delete(key)
      map.set(key, { value, expiresAt: Date.now() + ttlMs })
      while (map.size > maxEntries) {
        const oldestKey = map.keys().next().value
        if (oldestKey === undefined) break
        map.delete(oldestKey)
      }
    },
    invalidate(key) {
      map.delete(key)
    },
    clear() {
      map.clear()
    },
  }
}
