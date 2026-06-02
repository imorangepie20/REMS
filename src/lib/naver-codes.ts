import type { TradeTypeCode, RealEstateTypeCode } from './naver-types'

export const tradeTypeCodes: TradeTypeCode[] = ['A1', 'B1', 'B2']

const TRADE_TYPE_LABELS: Record<TradeTypeCode, string> = {
  A1: '매매',
  B1: '전세',
  B2: '월세',
}

export function tradeTypeLabel(code: TradeTypeCode): string {
  return TRADE_TYPE_LABELS[code]
}

export const realEstateTypeCodes: RealEstateTypeCode[] = ['A01', 'A02', 'A03', 'B03', 'C01', 'D01']

const REAL_ESTATE_TYPE_LABELS: Record<RealEstateTypeCode, string> = {
  A01: '아파트',
  A02: '오피스텔',
  A03: '빌라/연립',
  B03: '단독/다가구',
  C01: '상가',
  D01: '토지',
}

export function realEstateTypeLabel(code: RealEstateTypeCode): string {
  return REAL_ESTATE_TYPE_LABELS[code]
}

/**
 * 가격(원)을 한국식 표기로. 1억 5,000만 / 5억 / 3,500만 / 8,000원.
 */
export function formatPrice(won: number | null): string {
  if (won == null) return '-'
  if (won < 10_000) return `${won.toLocaleString()}원`
  if (won < 100_000_000) return `${Math.floor(won / 10_000).toLocaleString()}만`
  const eok = Math.floor(won / 100_000_000)
  const man = Math.floor((won % 100_000_000) / 10_000)
  return man > 0 ? `${eok}억 ${man.toLocaleString()}만` : `${eok}억`
}
