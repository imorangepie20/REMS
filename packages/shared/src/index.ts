import { z } from 'zod';

/** 목록 API 공통 페이지네이션 쿼리 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** 목록 API 공통 응답 형태 */
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export * from './auth';
export * from './listings';
export * from './customers';
export * from './admin';
