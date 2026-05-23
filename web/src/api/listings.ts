import type {
  Listing,
  ListingPhoto,
  CreateListingRequest,
  UpdateListingRequest,
  Paginated,
} from '@rems/shared'
import { apiFetch } from './client'

export interface ListingQuery {
  dealType?: string
  propertyType?: string
  status?: string
  q?: string
  page?: number
  limit?: number
}

export function listListings(query: ListingQuery = {}): Promise<Paginated<Listing>> {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.set(k, String(v))
  })
  const qs = params.toString()
  return apiFetch<Paginated<Listing>>(`/listings${qs ? `?${qs}` : ''}`)
}

export function getListing(id: number): Promise<Listing> {
  return apiFetch<Listing>(`/listings/${id}`)
}

export function createListing(data: CreateListingRequest): Promise<Listing> {
  return apiFetch<Listing>('/listings', { method: 'POST', body: JSON.stringify(data) })
}

export function updateListing(id: number, data: UpdateListingRequest): Promise<Listing> {
  return apiFetch<Listing>(`/listings/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export function deleteListing(id: number): Promise<void> {
  return apiFetch<void>(`/listings/${id}`, { method: 'DELETE' })
}

/** 사진 업로드 — multipart라 apiFetch 대신 fetch 직접 사용 */
export async function uploadListingPhoto(id: number, file: File): Promise<ListingPhoto> {
  const form = new FormData()
  form.append('photo', file)
  const res = await fetch(`/api/listings/${id}/photos`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  if (!res.ok) throw new Error('사진 업로드 실패')
  return res.json() as Promise<ListingPhoto>
}

export function deleteListingPhoto(listingId: number, photoId: number): Promise<void> {
  return apiFetch<void>(`/listings/${listingId}/photos/${photoId}`, { method: 'DELETE' })
}
