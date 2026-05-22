import { prisma } from '../src/db';

/** 테스트 사이에 모든 테넌트 테이블을 비운다. FK 의존성 역순으로 삭제. */
export async function resetDb(): Promise<void> {
  await prisma.session.deleteMany();
  await prisma.customerListing.deleteMany();
  await prisma.listingPhoto.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.agency.deleteMany();
}
