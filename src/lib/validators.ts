import { z } from 'zod'

export const signupSchema = z.object({
  agency: z.object({
    name: z.string().min(1, '사무소 이름은 필수입니다').max(100),
  }),
  owner: z.object({
    name: z.string().min(1, '이름은 필수입니다').max(50),
    email: z.string().email('올바른 이메일을 입력하세요').max(100),
    password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다').max(100),
    phone: z.string().max(20).optional(),
  }),
})
export type SignupInput = z.infer<typeof signupSchema>

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
export type LoginInput = z.infer<typeof loginSchema>

export const changePasswordSchema = z.object({
  current: z.string().min(1, '현재 비밀번호를 입력하세요'),
  next: z.string().min(8, '새 비밀번호는 최소 8자 이상이어야 합니다').max(100),
})
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

export const updateAgencySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  businessNumber: z.string().max(50).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
})
export type UpdateAgencyInput = z.infer<typeof updateAgencySchema>

export const createAgentSchema = z.object({
  name: z.string().min(1).max(50),
  email: z.string().email().max(100),
  password: z.string().min(8).max(100),
  phone: z.string().max(20).optional(),
})
export type CreateAgentInput = z.infer<typeof createAgentSchema>

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  phone: z.string().max(20).nullable().optional(),
  role: z.enum(['owner', 'member']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
})
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>
