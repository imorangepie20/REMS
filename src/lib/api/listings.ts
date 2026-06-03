import { apiFetch } from '@/lib/api-client'

export interface ListingSummary {
  id: number
  agencyId: number
  createdById: number
  title: string
  complexName: string | null
  address: string
  dealType: 'sale' | 'jeonse' | 'wolse'
  propertyType: 'apartment' | 'officetel' | 'villa' | 'house' | 'commercial' | 'land'
  status: 'active' | 'contracted' | 'hidden'
  salePrice: string | null
  deposit: string | null
  monthlyRent: string | null
  areaM2: number
  createdAt: string
}

export interface ListingPhoto {
  id: number
  url: string
  caption: string | null
  sortOrder: number
}
export interface ListingContract {
  id: number
  url: string
  filename: string
  uploadedAt: string
}

export interface ListingDetail extends ListingSummary {
  dong: string | null
  ho: string | null
  floor: string | null
  direction: string | null
  pyeongType: string | null
  supplyAreaM2: number | null
  roadAddress: string | null
  addressDetail: string | null
  latitude: number | null
  longitude: number | null
  maintenanceFee: number | null
  availableMoveInDate: string | null
  ownerName: string | null
  ownerPhone: string | null
  ownerMemo: string | null
  commissionRate: number | null
  description: string | null
  privateMemo?: string  // 본인/owner에게만 노출
  contractedAt: string | null
  contractedPrice: string | null
  photos: ListingPhoto[]
  contracts: ListingContract[]
  updatedAt: string
}

export interface ListingsQuery {
  q?: string
  dealType?: 'sale' | 'jeonse' | 'wolse'
  status?: 'active' | 'contracted' | 'hidden'
  page?: number
  limit?: number
}

export interface ListingsResponse {
  data: ListingSummary[]
  total: number
  page: number
  limit: number
}

export function listListings(query: ListingsQuery = {}): Promise<ListingsResponse> {
  const sp = new URLSearchParams()
  if (query.q) sp.set('q', query.q)
  if (query.dealType) sp.set('dealType', query.dealType)
  if (query.status) sp.set('status', query.status)
  if (query.page) sp.set('page', String(query.page))
  if (query.limit) sp.set('limit', String(query.limit))
  const qs = sp.toString()
  return apiFetch<ListingsResponse>(`/listings${qs ? `?${qs}` : ''}`)
}

export function getListing(id: number): Promise<ListingDetail> {
  return apiFetch<ListingDetail>(`/listings/${id}`)
}

export function createListing(body: Record<string, unknown>): Promise<ListingDetail> {
  return apiFetch<ListingDetail>('/listings', { method: 'POST', body: JSON.stringify(body) })
}

export function updateListing(id: number, body: Record<string, unknown>): Promise<ListingDetail> {
  return apiFetch<ListingDetail>(`/listings/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteListing(id: number): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/listings/${id}`, { method: 'DELETE' })
}

export async function uploadPhoto(id: number, file: File, caption?: string): Promise<ListingPhoto> {
  const fd = new FormData()
  fd.append('file', file)
  if (caption) fd.append('caption', caption)
  const res = await fetch(`/api/listings/${id}/photos`, { method: 'POST', credentials: 'include', body: fd })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? '사진 업로드 실패')
  }
  return res.json()
}

export function deletePhoto(listingId: number, photoId: number): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/listings/${listingId}/photos/${photoId}`, { method: 'DELETE' })
}

export async function uploadContract(id: number, file: File): Promise<ListingContract> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`/api/listings/${id}/contracts`, { method: 'POST', credentials: 'include', body: fd })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? '계약서 업로드 실패')
  }
  return res.json()
}

export function deleteContract(listingId: number, contractId: number): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/listings/${listingId}/contracts/${contractId}`, { method: 'DELETE' })
}
