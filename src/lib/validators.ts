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

// === Internal Listings ===

const dealTypeEnum = z.enum(['sale', 'jeonse', 'wolse'])
const propertyTypeEnum = z.enum(['apartment', 'officetel', 'villa', 'house', 'commercial', 'land'])
const listingStatusEnum = z.enum(['active', 'contracted', 'hidden'])
const directionEnum = z.enum(['north', 'east', 'south', 'west', 'northeast', 'southeast', 'southwest', 'northwest'])

const bigIntInput = z.union([z.bigint(), z.number().int().nonnegative(), z.string().regex(/^\d+$/)])
  .transform((v): bigint => typeof v === 'bigint' ? v : BigInt(v))

const baseListingShape = z.object({
  title: z.string().min(1).max(200),
  complexName: z.string().max(100).nullable().optional(),
  dong: z.string().max(20).nullable().optional(),
  ho: z.string().max(20).nullable().optional(),
  floor: z.string().max(10).nullable().optional(),
  direction: directionEnum.nullable().optional(),
  pyeongType: z.string().max(20).nullable().optional(),

  dealType: dealTypeEnum,
  propertyType: propertyTypeEnum,
  salePrice: bigIntInput.nullable().optional(),
  deposit: bigIntInput.nullable().optional(),
  monthlyRent: bigIntInput.nullable().optional(),

  areaM2: z.number().positive(),
  supplyAreaM2: z.number().positive().nullable().optional(),

  address: z.string().min(1).max(300),
  roadAddress: z.string().max(300).nullable().optional(),
  addressDetail: z.string().max(200).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),

  maintenanceFee: z.number().int().nonnegative().nullable().optional(),
  availableMoveInDate: z.coerce.date().nullable().optional(),
  ownerName: z.string().max(50).nullable().optional(),
  ownerPhone: z.string().max(20).nullable().optional(),
  ownerMemo: z.string().max(1000).nullable().optional(),
  commissionRate: z.number().min(0).max(100).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  privateMemo: z.string().max(5000).nullable().optional(),
})

export const createListingSchema = baseListingShape.superRefine((data, ctx) => {
  if (data.dealType === 'sale' && data.salePrice == null) {
    ctx.addIssue({ code: 'custom', path: ['salePrice'], message: '매매는 매매가가 필요합니다' })
  }
  if (data.dealType === 'jeonse' && data.deposit == null) {
    ctx.addIssue({ code: 'custom', path: ['deposit'], message: '전세는 보증금이 필요합니다' })
  }
  if (data.dealType === 'wolse' && (data.deposit == null || data.monthlyRent == null)) {
    ctx.addIssue({ code: 'custom', path: ['deposit'], message: '월세는 보증금과 월세가 필요합니다' })
  }
})
export type CreateListingInput = z.infer<typeof createListingSchema>

export const updateListingSchema = baseListingShape.partial().extend({
  status: listingStatusEnum.optional(),
  contractedAt: z.coerce.date().nullable().optional(),
  contractedPrice: bigIntInput.nullable().optional(),
})
export type UpdateListingInput = z.infer<typeof updateListingSchema>

export const listingQuerySchema = z.object({
  q: z.string().max(100).optional(),
  dealType: dealTypeEnum.optional(),
  status: listingStatusEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
export type ListingQueryInput = z.infer<typeof listingQuerySchema>
