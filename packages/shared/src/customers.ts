import { z } from 'zod';

export const customerTypes = ['buyer', 'seller', 'tenant', 'landlord'] as const;
export const matchStatuses = ['suggested', 'interested', 'visited', 'contracted', 'rejected'] as const;

const customerFields = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().max(20).optional(),
  customerType: z.enum(customerTypes),
  budgetMin: z.number().int().nonnegative().optional(),
  budgetMax: z.number().int().nonnegative().optional(),
  desiredArea: z.string().max(255).optional(),
  memo: z.string().max(5000).optional(),
});

export const createCustomerSchema = customerFields;
export type CreateCustomerRequest = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = customerFields.partial();
export type UpdateCustomerRequest = z.infer<typeof updateCustomerSchema>;

export const customerFilterSchema = z.object({
  customerType: z.enum(customerTypes).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type CustomerFilter = z.infer<typeof customerFilterSchema>;

export interface Customer {
  id: number;
  agencyId: number;
  ownerAgentId: number;
  name: string;
  phone: string | null;
  customerType: (typeof customerTypes)[number];
  budgetMin: number | null;
  budgetMax: number | null;
  desiredArea: string | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
}

export const createMatchSchema = z.object({
  listingId: z.number().int().positive(),
  status: z.enum(matchStatuses).optional(),
  memo: z.string().max(2000).optional(),
});
export type CreateMatchRequest = z.infer<typeof createMatchSchema>;

export const updateMatchSchema = z.object({
  status: z.enum(matchStatuses).optional(),
  memo: z.string().max(2000).optional(),
});
export type UpdateMatchRequest = z.infer<typeof updateMatchSchema>;

export interface CustomerListingMatch {
  id: number;
  customerId: number;
  listingId: number;
  status: (typeof matchStatuses)[number];
  memo: string | null;
  createdAt: string;
  updatedAt: string;
  /** 응답 편의용 매물 요약 (목록 GET에서 포함) */
  listing?: {
    id: number;
    title: string;
    address: string;
    dealType: 'sale' | 'jeonse' | 'wolse';
    status: 'active' | 'completed' | 'hidden';
  };
}
