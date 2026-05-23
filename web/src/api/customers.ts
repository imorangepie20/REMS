import type {
  Customer,
  CustomerListingMatch,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CreateMatchRequest,
  UpdateMatchRequest,
  Paginated,
} from '@rems/shared'
import { apiFetch } from './client'

export interface CustomerQuery {
  customerType?: string
  q?: string
  page?: number
}

export function listCustomers(query: CustomerQuery = {}): Promise<Paginated<Customer>> {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.set(k, String(v))
  })
  const qs = params.toString()
  return apiFetch<Paginated<Customer>>(`/customers${qs ? `?${qs}` : ''}`)
}

export function getCustomer(id: number): Promise<Customer> {
  return apiFetch<Customer>(`/customers/${id}`)
}

export function createCustomer(data: CreateCustomerRequest): Promise<Customer> {
  return apiFetch<Customer>('/customers', { method: 'POST', body: JSON.stringify(data) })
}

export function updateCustomer(id: number, data: UpdateCustomerRequest): Promise<Customer> {
  return apiFetch<Customer>(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export function deleteCustomer(id: number): Promise<void> {
  return apiFetch<void>(`/customers/${id}`, { method: 'DELETE' })
}

export function listMatches(customerId: number): Promise<CustomerListingMatch[]> {
  return apiFetch<CustomerListingMatch[]>(`/customers/${customerId}/listings`)
}

export function createMatch(customerId: number, data: CreateMatchRequest): Promise<CustomerListingMatch> {
  return apiFetch<CustomerListingMatch>(`/customers/${customerId}/listings`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateMatch(customerId: number, matchId: number, data: UpdateMatchRequest): Promise<CustomerListingMatch> {
  return apiFetch<CustomerListingMatch>(`/customers/${customerId}/listings/${matchId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteMatch(customerId: number, matchId: number): Promise<void> {
  return apiFetch<void>(`/customers/${customerId}/listings/${matchId}`, { method: 'DELETE' })
}
