import type {
  AgentRow,
  AgencyRow,
  CreateAgentRequest,
  UpdateAgentRequest,
  UpdateAgencyRequest,
  ChangePasswordRequest,
  DashboardSummary,
} from '@rems/shared'
import { apiFetch } from './client'

export function listAgents(): Promise<AgentRow[]> {
  return apiFetch<AgentRow[]>('/agents')
}

export function createAgent(data: CreateAgentRequest): Promise<AgentRow> {
  return apiFetch<AgentRow>('/agents', { method: 'POST', body: JSON.stringify(data) })
}

export function updateAgent(id: number, data: UpdateAgentRequest): Promise<AgentRow> {
  return apiFetch<AgentRow>(`/agents/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export function changePassword(data: ChangePasswordRequest): Promise<void> {
  return apiFetch<void>('/auth/password', { method: 'PATCH', body: JSON.stringify(data) })
}

export function updateAgency(data: UpdateAgencyRequest): Promise<AgencyRow> {
  return apiFetch<AgencyRow>('/agency', { method: 'PATCH', body: JSON.stringify(data) })
}

export function getDashboardSummary(): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>('/dashboard/summary')
}
