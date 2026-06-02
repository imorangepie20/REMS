import { describe, it, expect } from 'vitest'
import {
  tradeTypeLabel, tradeTypeCodes,
  realEstateTypeLabel, realEstateTypeCodes,
  formatPrice,
} from '@/lib/naver-codes'

describe('tradeType', () => {
  it('A1 → 매매', () => { expect(tradeTypeLabel('A1')).toBe('매매') })
  it('B1 → 전세', () => { expect(tradeTypeLabel('B1')).toBe('전세') })
  it('B2 → 월세', () => { expect(tradeTypeLabel('B2')).toBe('월세') })
  it('codes contains all three', () => {
    expect(tradeTypeCodes).toEqual(['A1', 'B1', 'B2'])
  })
})

describe('realEstateType', () => {
  it('A01 → 아파트', () => { expect(realEstateTypeLabel('A01')).toBe('아파트') })
  it('A02 → 오피스텔', () => { expect(realEstateTypeLabel('A02')).toBe('오피스텔') })
  it('A03 → 빌라/연립', () => { expect(realEstateTypeLabel('A03')).toBe('빌라/연립') })
  it('B03 → 단독/다가구', () => { expect(realEstateTypeLabel('B03')).toBe('단독/다가구') })
  it('C01 → 상가', () => { expect(realEstateTypeLabel('C01')).toBe('상가') })
  it('D01 → 토지', () => { expect(realEstateTypeLabel('D01')).toBe('토지') })
  it('codes 모두 포함', () => {
    expect(realEstateTypeCodes).toEqual(['A01', 'A02', 'A03', 'B03', 'C01', 'D01'])
  })
})

describe('formatPrice', () => {
  it('1억 5천만', () => { expect(formatPrice(150_000_000)).toBe('1억 5,000만') })
  it('5억', () => { expect(formatPrice(500_000_000)).toBe('5억') })
  it('3,500만 (1억 미만)', () => { expect(formatPrice(35_000_000)).toBe('3,500만') })
  it('null → "-"', () => { expect(formatPrice(null)).toBe('-') })
  it('5천 미만은 그냥 원 단위', () => { expect(formatPrice(8000)).toBe('8,000원') })
})
