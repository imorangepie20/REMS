/**
 * VWorld API로 전국 법정동 데이터 임포트 (idempotent upsert).
 *
 * 사용법:
 *   1. .env에 VWORLD_API_KEY=... 추가
 *   2. npm run import-regions
 *
 * 전략:
 *   - 17개 시도를 순회하면서 VWorld Search API의 type=DISTRICT category=L (법정)로 검색
 *   - 응답의 'point' 좌표(EPSG:4326)와 'text' (전체 명칭)에서 시도/시군구/동 파싱
 *   - 'id'는 10자리 법정동 코드
 *   - level=DONG 인 항목만 동으로 인정 (그 외 시도/시군구는 건너뜀)
 *   - 동명이 중복되어도 code가 UNIQUE이므로 upsert로 안전 처리
 *
 * 페이지네이션: size=1000 (VWorld 최대), page=1,2,... 빈 응답이면 종료.
 *
 * VWorld 일일 한도 무료 30,000건. 17 시도 × 평균 10 페이지 = ~170 호출 → 매우 여유.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SIDO_LIST = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시',
  '대전광역시', '울산광역시', '세종특별자치시',
  '경기도', '강원특별자치도', '충청북도', '충청남도',
  '전라북도', '전라남도', '경상북도', '경상남도', '제주특별자치도',
]

interface VWorldItem {
  id: string         // 10자리 법정동 코드 (동의 경우)
  text: string       // 전체 명칭 (예: "경기도 수원시 장안구 정자동")
  level?: string     // SIDO | SIGUNGU | DONG | RI
  point?: { x: string; y: string }  // x=경도, y=위도 (EPSG:4326)
  type?: string
  category?: string
}

interface VWorldResponse {
  response: {
    status: 'OK' | 'NOT_FOUND' | 'ERROR'
    record?: { total: string; current: string }
    page?: { total: string; current: string; size: string }
    result?: { items?: VWorldItem[] }
  }
}

async function searchDistricts(query: string, page: number, key: string): Promise<VWorldItem[]> {
  const url = new URL('https://api.vworld.kr/req/search')
  url.searchParams.set('service', 'search')
  url.searchParams.set('request', 'search')
  url.searchParams.set('version', '2.0')
  url.searchParams.set('crs', 'EPSG:4326')
  url.searchParams.set('size', '1000')
  url.searchParams.set('page', String(page))
  url.searchParams.set('query', query)
  url.searchParams.set('type', 'DISTRICT')
  url.searchParams.set('category', 'L')  // L=법정, A=행정
  url.searchParams.set('format', 'json')
  url.searchParams.set('errorformat', 'json')
  url.searchParams.set('key', key)

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`VWorld HTTP ${res.status}: ${await res.text().catch(() => '')}`)
  }
  const body = (await res.json()) as VWorldResponse
  if (body.response.status === 'NOT_FOUND') return []
  if (body.response.status === 'ERROR') {
    throw new Error(`VWorld ERROR: ${JSON.stringify(body)}`)
  }
  return body.response.result?.items ?? []
}

function parseRegion(item: VWorldItem): {
  code: string
  sido: string
  sigungu: string
  eup: string
  latitude: number
  longitude: number
} | null {
  if (item.level !== 'DONG') return null
  if (!item.point) return null
  const lng = Number(item.point.x)
  const lat = Number(item.point.y)
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  if (!/^\d{10}$/.test(item.id)) return null

  // text: "경기도 수원시 장안구 정자동" 또는 "서울특별시 강남구 역삼동"
  const parts = item.text.split(/\s+/).filter(Boolean)
  if (parts.length < 3) return null
  const sido = parts[0]
  const eup = parts[parts.length - 1]
  const sigungu = parts.slice(1, -1).join(' ')

  return { code: item.id, sido, sigungu, eup, latitude: lat, longitude: lng }
}

async function importSido(sidoName: string, key: string): Promise<{ added: number; updated: number }> {
  let added = 0
  let updated = 0
  for (let page = 1; page < 100; page++) {
    let items: VWorldItem[]
    try {
      items = await searchDistricts(sidoName, page, key)
    } catch (e) {
      console.error(`  [${sidoName} p${page}] 호출 실패:`, (e as Error).message)
      throw e
    }
    if (items.length === 0) break

    for (const it of items) {
      const r = parseRegion(it)
      if (!r) continue
      const existing = await prisma.region.findUnique({ where: { code: r.code } })
      if (existing) {
        await prisma.region.update({ where: { code: r.code }, data: r })
        updated++
      } else {
        await prisma.region.create({ data: r })
        added++
      }
    }
    process.stdout.write(`  [${sidoName} p${page}] +${items.length} items (acc add=${added} upd=${updated})\n`)
    if (items.length < 1000) break
  }
  return { added, updated }
}

async function main(): Promise<void> {
  const key = process.env.VWORLD_API_KEY
  if (!key) {
    console.error('VWORLD_API_KEY가 .env에 없습니다.')
    process.exit(1)
  }

  console.log(`✓ VWorld 키 로드. 17개 시도 순회 시작.`)
  const t0 = Date.now()
  let totalAdded = 0
  let totalUpdated = 0
  for (const sido of SIDO_LIST) {
    console.log(`\n[${sido}]`)
    const { added, updated } = await importSido(sido, key)
    totalAdded += added
    totalUpdated += updated
  }
  const total = await prisma.region.count()
  const seconds = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\n✓ 완료. ${seconds}s 소요. 신규 ${totalAdded}, 갱신 ${totalUpdated}. 총 Region: ${total}건`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
