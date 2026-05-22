import { z } from 'zod';

export const dealTypes = ['sale', 'jeonse', 'wolse'] as const;
export const propertyTypes = ['apartment', 'officetel', 'house', 'commercial', 'land'] as const;
export const listingStatuses = ['active', 'completed', 'hidden'] as const;

/** 매물 공통 필드 (refine 없는 평 객체 — create/update가 재사용) */
const listingFields = z.object({
  title: z.string().min(1).max(255),
  dealType: z.enum(dealTypes),
  propertyType: z.enum(propertyTypes),
  salePrice: z.number().int().nonnegative().optional(),
  deposit: z.number().int().nonnegative().optional(),
  monthlyRent: z.number().int().nonnegative().optional(),
  areaM2: z.number().positive(),
  address: z.string().min(1).max(255),
  addressDetail: z.string().max(255).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  floor: z.number().int().optional(),
  totalFloors: z.number().int().optional(),
  rooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  builtYear: z.number().int().min(1900).max(2100).optional(),
  description: z.string().max(5000).optional(),
});

/** 거래유형에 맞는 금액이 있는지 검증 */
function checkDealPrices(
  v: { dealType: string; salePrice?: number; deposit?: number; monthlyRent?: number },
  ctx: z.RefinementCtx,
): void {
  if (v.dealType === 'sale' && v.salePrice == null) {
    ctx.addIssue({ code: 'custom', message: '매매는 매매가가 필요합니다', path: ['salePrice'] });
  }
  if (v.dealType === 'jeonse' && v.deposit == null) {
    ctx.addIssue({ code: 'custom', message: '전세는 보증금이 필요합니다', path: ['deposit'] });
  }
  if (v.dealType === 'wolse' && (v.deposit == null || v.monthlyRent == null)) {
    ctx.addIssue({ code: 'custom', message: '월세는 보증금과 월세액이 필요합니다', path: ['monthlyRent'] });
  }
}

/** 매물 등록 요청 */
export const createListingSchema = listingFields.superRefine(checkDealPrices);
export type CreateListingRequest = z.infer<typeof createListingSchema>;

/** 매물 수정 요청 (모든 필드 선택 + status) */
export const updateListingSchema = listingFields.partial().extend({
  status: z.enum(listingStatuses).optional(),
});
export type UpdateListingRequest = z.infer<typeof updateListingSchema>;

/** 매물 목록 필터 쿼리 */
export const listingFilterSchema = z.object({
  dealType: z.enum(dealTypes).optional(),
  propertyType: z.enum(propertyTypes).optional(),
  status: z.enum(listingStatuses).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListingFilter = z.infer<typeof listingFilterSchema>;

/** 매물 사진 */
export interface ListingPhoto {
  id: number;
  url: string;
  sortOrder: number;
}

/** 매물 응답 */
export interface Listing {
  id: number;
  agencyId: number;
  createdBy: number;
  title: string;
  dealType: (typeof dealTypes)[number];
  propertyType: (typeof propertyTypes)[number];
  salePrice: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  areaM2: number;
  address: string;
  addressDetail: string | null;
  latitude: number | null;
  longitude: number | null;
  floor: number | null;
  totalFloors: number | null;
  rooms: number | null;
  bathrooms: number | null;
  builtYear: number | null;
  status: (typeof listingStatuses)[number];
  description: string | null;
  createdAt: string;
  updatedAt: string;
  photos: ListingPhoto[];
}
