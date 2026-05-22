import { PrismaClient } from '@prisma/client';

/** 앱 전역에서 공유하는 Prisma 클라이언트 */
export const prisma = new PrismaClient();
