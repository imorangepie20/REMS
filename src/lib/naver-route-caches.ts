/**
 * Naver 프록시 라우트의 세션 캐시.
 *
 * Next.js 15 라우트 파일(src/app/api/.../route.ts)은 export를 GET/POST/etc로만 허용한다.
 * 캐시 인스턴스를 라우트에서 export하면 타입 체크가 실패하므로 별도 모듈에 둔다.
 */
import { createCache } from './naver-cache'
import type { ComplexesResponse, ArticlesResponse } from './naver-types'

const FIVE_MIN = 5 * 60_000

export const complexesCache = createCache<ComplexesResponse>({
  maxEntries: 200,
  ttlMs: FIVE_MIN,
})

export const articlesCache = createCache<ArticlesResponse>({
  maxEntries: 200,
  ttlMs: FIVE_MIN,
})
