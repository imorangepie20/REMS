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
  '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도',
]

interface VWorldItem {
  id: string         // 8자리 법정동 코드 (VWorld L4); 우리는 끝에 "00" 붙여 10자리로 정규화
  title: string      // 전체 명칭 (예: "경기도 수원시 장안구 정자동")
  geometry?: string
  point?: { x: string; y: string }  // x=경도, y=위도 (EPSG:4326)
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
  url.searchParams.set('category', 'L4')  // L4 = 법정동(읍면동), L3=시군구, L2=구, L1=시도
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
  if (!item.point) return null
  const lng = Number(item.point.x)
  const lat = Number(item.point.y)
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  // VWorld L4의 id는 8자리. 네이버 eupLegalDivisionNumber는 10자리 (끝 2자리 = 리 코드).
  // 동 자체를 가리키려면 "00"을 append.
  if (!/^\d{8}$/.test(item.id)) return null
  const code = item.id + '00'

  // title 패턴:
  //   "경기도 수원시 장안구 정자동" (4단어, 시도+시군+구+동)
  //   "서울특별시 강남구 역삼동" (3단어, 시도+구+동)
  //   "세종특별자치시 반곡동" (2단어, 광역시 직속 — 시군구 없음)
  const parts = item.title.split(/\s+/).filter(Boolean)
  if (parts.length < 2) return null
  const sido = parts[0]
  const eup = parts[parts.length - 1]
  const sigungu = parts.length >= 3 ? parts.slice(1, -1).join(' ') : ''

  return { code, sido, sigungu, eup, latitude: lat, longitude: lng }
}

async function importSido(sidoName: string, key: string): Promise<{ added: number; updated: number }> {
  let added = 0
  const updated = 0
  for (let page = 1; page < 100; page++) {
    let items: VWorldItem[]
    try {
      items = await searchDistricts(sidoName, page, key)
    } catch (e) {
      console.error(`  [${sidoName} p${page}] 호출 실패:`, (e as Error).message)
      throw e
    }
    if (items.length === 0) break

    const parsed = items.map(parseRegion).filter((r): r is NonNullable<ReturnType<typeof parseRegion>> => r !== null)

    for (const r of parsed) {
      const result = await prisma.region.upsert({
        where: { code: r.code },
        create: r,
        update: r,
      })
      // upsert는 결과만으로 added/updated 구분이 어려움 — 합쳐서 표시
      void result
      added++
    }
    process.stdout.write(`  [${sidoName} p${page}] +${parsed.length}/${items.length} valid (총 누적 ${added})\n`)
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
