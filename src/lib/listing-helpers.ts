import type { SessionAgent } from './session'

interface ListingLike {
  id: number
  agencyId: number
  createdById: number
  ownerName: string | null
  ownerPhone: string | null
  ownerMemo: string | null
  privateMemo: string | null
  salePrice: bigint | null
  deposit: bigint | null
  monthlyRent: bigint | null
  contractedPrice: bigint | null
  areaM2: { toNumber: () => number } | number
  supplyAreaM2: { toNumber: () => number } | number | null
  commissionRate: { toNumber: () => number } | number | null
  [key: string]: unknown
}

export function maskPhone(phone: string | null): string | null {
  if (phone == null) return null
  if (phone.length <= 4) return phone
  const tail = phone.slice(-4)
  const head = phone.slice(0, -4).replace(/[^-]/g, '*')
  return head + tail
}

export function maskName(name: string | null): string | null {
  if (name == null) return null
  if (name.length === 0) return ''
  return name[0] + '***'
}

function decToNum(v: { toNumber: () => number } | number | null | undefined): number | null {
  if (v == null) return null
  if (typeof v === 'number') return v
  return v.toNumber()
}

function bigToStr(v: bigint | null | undefined): string | null {
  return v == null ? null : v.toString()
}

export function canWriteListing(listing: { createdById: number }, agent: SessionAgent): boolean {
  if (agent.role === 'owner') return true
  return listing.createdById === agent.id
}

/**
 * 매물을 API 응답용으로 직렬화. 본인이 아닌 같은 사무소 member는
 * owner 정보를 마스킹하고 privateMemo는 응답에서 제외한다.
 */
export function projectListing(listing: ListingLike, viewer: SessionAgent): Record<string, unknown> {
  const isSelf = listing.createdById === viewer.id
  const isOwner = viewer.role === 'owner'
  const fullAccess = isSelf || isOwner

  const projected: Record<string, unknown> = {
    ...listing,
    salePrice: bigToStr(listing.salePrice),
    deposit: bigToStr(listing.deposit),
    monthlyRent: bigToStr(listing.monthlyRent),
    contractedPrice: bigToStr(listing.contractedPrice),
    areaM2: decToNum(listing.areaM2),
    supplyAreaM2: decToNum(listing.supplyAreaM2),
    commissionRate: decToNum(listing.commissionRate),
  }

  if (!fullAccess) {
    projected.ownerName = maskName(listing.ownerName)
    projected.ownerPhone = maskPhone(listing.ownerPhone)
    projected.ownerMemo = null
    delete projected.privateMemo
  }
  return projected
}
