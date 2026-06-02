import type { RegionEntry } from './naver-types'

/**
 * MVP용 큐레이트된 법정동 데이터.
 * 향후 전체 법정동 데이터셋으로 교체 가능 (행정자치부 공개 데이터).
 */
export const REGIONS: RegionEntry[] = [
  // 서울 강남구
  { legalDivisionNumber: '1168010100', sido: '서울특별시', sigungu: '강남구', eup: '역삼동', centerLat: 37.5004, centerLng: 127.0367 },
  { legalDivisionNumber: '1168010300', sido: '서울특별시', sigungu: '강남구', eup: '개포동', centerLat: 37.4781, centerLng: 127.0445 },
  { legalDivisionNumber: '1168010400', sido: '서울특별시', sigungu: '강남구', eup: '청담동', centerLat: 37.5230, centerLng: 127.0476 },
  { legalDivisionNumber: '1168010500', sido: '서울특별시', sigungu: '강남구', eup: '삼성동', centerLat: 37.5114, centerLng: 127.0631 },
  { legalDivisionNumber: '1168010600', sido: '서울특별시', sigungu: '강남구', eup: '대치동', centerLat: 37.4995, centerLng: 127.0577 },
  { legalDivisionNumber: '1168010700', sido: '서울특별시', sigungu: '강남구', eup: '신사동', centerLat: 37.5202, centerLng: 127.0220 },
  { legalDivisionNumber: '1168010800', sido: '서울특별시', sigungu: '강남구', eup: '논현동', centerLat: 37.5113, centerLng: 127.0282 },
  // 서울 서초구
  { legalDivisionNumber: '1165010100', sido: '서울특별시', sigungu: '서초구', eup: '서초동', centerLat: 37.4836, centerLng: 127.0327 },
  { legalDivisionNumber: '1165010200', sido: '서울특별시', sigungu: '서초구', eup: '잠원동', centerLat: 37.5118, centerLng: 127.0156 },
  { legalDivisionNumber: '1165010800', sido: '서울특별시', sigungu: '서초구', eup: '반포동', centerLat: 37.5073, centerLng: 127.0011 },
  // 서울 송파구
  { legalDivisionNumber: '1171010100', sido: '서울특별시', sigungu: '송파구', eup: '잠실동', centerLat: 37.5114, centerLng: 127.0817 },
  { legalDivisionNumber: '1171010200', sido: '서울특별시', sigungu: '송파구', eup: '신천동', centerLat: 37.5174, centerLng: 127.0817 },
  { legalDivisionNumber: '1171010800', sido: '서울특별시', sigungu: '송파구', eup: '문정동', centerLat: 37.4866, centerLng: 127.1248 },
  // 서울 마포구
  { legalDivisionNumber: '1144012700', sido: '서울특별시', sigungu: '마포구', eup: '합정동', centerLat: 37.5497, centerLng: 126.9134 },
  { legalDivisionNumber: '1144013100', sido: '서울특별시', sigungu: '마포구', eup: '망원동', centerLat: 37.5557, centerLng: 126.9038 },
  // 경기 수원시 장안구
  { legalDivisionNumber: '4111113000', sido: '경기도', sigungu: '수원시 장안구', eup: '정자동', centerLat: 37.2983, centerLng: 127.0078 },
  { legalDivisionNumber: '4111110100', sido: '경기도', sigungu: '수원시 장안구', eup: '파장동', centerLat: 37.2962, centerLng: 127.0078 },
  // 경기 성남시 분당구
  { legalDivisionNumber: '4113510700', sido: '경기도', sigungu: '성남시 분당구', eup: '서현동', centerLat: 37.3858, centerLng: 127.1234 },
  { legalDivisionNumber: '4113510900', sido: '경기도', sigungu: '성남시 분당구', eup: '정자동', centerLat: 37.3680, centerLng: 127.1075 },
  { legalDivisionNumber: '4113511000', sido: '경기도', sigungu: '성남시 분당구', eup: '미금동', centerLat: 37.3504, centerLng: 127.1112 },
  // 경기 용인시 수지구
  { legalDivisionNumber: '4146510100', sido: '경기도', sigungu: '용인시 수지구', eup: '풍덕천동', centerLat: 37.3287, centerLng: 127.0964 },
  { legalDivisionNumber: '4146510200', sido: '경기도', sigungu: '용인시 수지구', eup: '죽전동', centerLat: 37.3225, centerLng: 127.1059 },
]

export function searchRegions(query: string, limit = 20): RegionEntry[] {
  const q = query.trim()
  if (!q) return REGIONS.slice(0, limit)
  const lc = q.toLowerCase()
  return REGIONS.filter((r) =>
    r.sido.includes(q) ||
    r.sigungu.includes(q) ||
    r.eup.includes(q) ||
    `${r.sigungu} ${r.eup}`.toLowerCase().includes(lc),
  ).slice(0, limit)
}

export function getRegionByCode(code: string): RegionEntry | undefined {
  return REGIONS.find((r) => r.legalDivisionNumber === code)
}
