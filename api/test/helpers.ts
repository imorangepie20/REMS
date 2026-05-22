import request from 'supertest';
import type { Express } from 'express';
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

/** 사무소를 가입시키고 세션 쿠키를 보유한 supertest agent를 반환한다 */
export async function signupAgent(
  app: Express,
  opts: { agencyName?: string; email?: string } = {},
) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/signup').send({
    agency: { name: opts.agencyName ?? '테스트부동산' },
    owner: {
      email: opts.email ?? 'tester@example.com',
      password: 'password123',
      name: '테스터',
    },
  });
  if (res.status !== 201) {
    throw new Error(`signupAgent 실패: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}
