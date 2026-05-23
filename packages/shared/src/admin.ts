import { z } from 'zod';

export const agentStatuses = ['active', 'inactive'] as const;

/** owner가 멤버 계정 생성 */
export const createAgentSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(100),
  phone: z.string().max(20).optional(),
  password: z.string().min(8).max(100),
});
export type CreateAgentRequest = z.infer<typeof createAgentSchema>;

/** 본인 프로필 수정(name/phone) + owner의 멤버 status 변경 */
export const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  status: z.enum(agentStatuses).optional(),
});
export type UpdateAgentRequest = z.infer<typeof updateAgentSchema>;

export interface AgentRow {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  role: 'owner' | 'member';
  status: (typeof agentStatuses)[number];
  createdAt: string;
}

/** 비밀번호 변경 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;

/** 사무소 정보 수정 (owner only) */
export const updateAgencySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  businessNumber: z.string().max(20).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(255).optional(),
});
export type UpdateAgencyRequest = z.infer<typeof updateAgencySchema>;

export interface AgencyRow {
  id: number;
  name: string;
  businessNumber: string | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
}

/** 대시보드 요약 응답 */
export interface DashboardSummary {
  listings: {
    active: number;
    completed: number;
    hidden: number;
  };
  customers: {
    mine: number;
    agency: number;
  };
  matches: {
    byStatus: {
      suggested: number;
      interested: number;
      visited: number;
      contracted: number;
      rejected: number;
    };
    recent: Array<{
      id: number;
      customerName: string;
      listingTitle: string;
      status: 'suggested' | 'interested' | 'visited' | 'contracted' | 'rejected';
      createdAt: string;
    }>;
  };
}
