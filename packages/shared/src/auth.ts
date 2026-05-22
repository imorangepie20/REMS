import { z } from 'zod';

/** 사무소 가입 요청 */
export const signupSchema = z.object({
  agency: z.object({
    name: z.string().min(1).max(255),
    businessNumber: z.string().max(20).optional(),
    phone: z.string().max(20).optional(),
    address: z.string().max(255).optional(),
  }),
  owner: z.object({
    email: z.string().email().max(255),
    password: z.string().min(8).max(100),
    name: z.string().min(1).max(100),
    phone: z.string().max(20).optional(),
  }),
});
export type SignupRequest = z.infer<typeof signupSchema>;

/** 로그인 요청 */
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginSchema>;

export type AgentRole = 'owner' | 'member';

/** 인증 응답 (signup/login/me 공통) */
export interface AuthResponse {
  agent: {
    id: number;
    email: string;
    name: string;
    role: AgentRole;
    agencyId: number;
  };
  agency: {
    id: number;
    name: string;
  };
}
