import { describe, expect, it } from 'vitest'
import { projectListing, maskPhone, maskName, canWriteListing } from '@/lib/listing-helpers'
import type { SessionAgent } from '@/lib/session'

const owner: SessionAgent = { id: 1, agencyId: 100, email: 'o@x.com', name: 'Owner', role: 'owner', status: 'active' }
const member1: SessionAgent = { id: 2, agencyId: 100, email: 'm1@x.com', name: 'M1', role: 'member', status: 'active' }
const member2: SessionAgent = { id: 3, agencyId: 100, email: 'm2@x.com', name: 'M2', role: 'member', status: 'active' }

const baseListing = {
  id: 1, agencyId: 100, createdById: 2,
  title: '래미안', complexName: null, dong: null, ho: null,
  floor: null, direction: null, pyeongType: null,
  dealType: 'sale' as const, propertyType: 'apartment' as const,
  salePrice: 900_000_000n, deposit: null, monthlyRent: null,
  areaM2: { toNumber: () => 84.5 }, supplyAreaM2: null,
  address: '서울 강남구 역삼동', roadAddress: null, addressDetail: null,
  latitude: 37.5, longitude: 127.0,
  maintenanceFee: 200_000, availableMoveInDate: null,
  ownerName: '김철수', ownerPhone: '010-1234-5678', ownerMemo: '바쁨',
  commissionRate: null, description: '좋은 매물', privateMemo: '비밀',
  status: 'active' as const, contractedAt: null, contractedPrice: null,
  createdAt: new Date('2026-06-01'), updatedAt: new Date('2026-06-01'),
}

describe('maskPhone', () => {
  it('끝 4자리만 노출', () => {
    expect(maskPhone('010-1234-5678')).toBe('***-****-5678')
    expect(maskPhone('01012345678')).toBe('*******5678')
    expect(maskPhone(null)).toBeNull()
    expect(maskPhone('')).toBe('')
  })
})

describe('maskName', () => {
  it('첫글자 + ***', () => {
    expect(maskName('김철수')).toBe('김***')
    expect(maskName('이')).toBe('이***')
    expect(maskName(null)).toBeNull()
    expect(maskName('')).toBe('')
  })
})

describe('projectListing', () => {
  it('작성자 본인 — 모든 필드 평문', () => {
    const p = projectListing(baseListing, member1)
    expect(p.ownerName).toBe('김철수')
    expect(p.ownerPhone).toBe('010-1234-5678')
    expect(p.ownerMemo).toBe('바쁨')
    expect(p.privateMemo).toBe('비밀')
  })

  it('같은 사무소 다른 member — owner 정보 마스킹, privateMemo 숨김', () => {
    const p = projectListing(baseListing, member2)
    expect(p.ownerName).toBe('김***')
    expect(p.ownerPhone).toBe('***-****-5678')
    expect(p.ownerMemo).toBeNull()
    expect(p.privateMemo).toBeUndefined()
  })

  it('owner — 모든 필드 평문', () => {
    const p = projectListing(baseListing, owner)
    expect(p.ownerName).toBe('김철수')
    expect(p.privateMemo).toBe('비밀')
  })

  it('BigInt → string 직렬화 안전', () => {
    const p = projectListing(baseListing, owner)
    expect(typeof p.salePrice).toBe('string')
    expect(p.salePrice).toBe('900000000')
  })

  it('areaM2 Decimal → number', () => {
    const p = projectListing(baseListing, owner)
    expect(p.areaM2).toBe(84.5)
  })
})

describe('canWriteListing', () => {
  it('작성자 본인 → true', () => {
    expect(canWriteListing(baseListing, member1)).toBe(true)
  })
  it('owner → true', () => {
    expect(canWriteListing(baseListing, owner)).toBe(true)
  })
  it('다른 member → false', () => {
    expect(canWriteListing(baseListing, member2)).toBe(false)
  })
})
