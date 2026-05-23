import '../src/bigint-json';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app';
import { resetDb, signupAgent, addMember } from './helpers';

const sampleCustomer = {
  name: '김매수',
  phone: '010-1234-5678',
  customerType: 'buyer',
  budgetMin: 500000000,
  budgetMax: 1500000000,
  desiredArea: '강남구',
  memo: '아파트 선호',
};

describe('POST /api/customers', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('인증 없으면 401', async () => {
    const app = createApp();
    const res = await request(app).post('/api/customers').send(sampleCustomer);
    expect(res.status).toBe(401);
  });

  it('고객을 등록하고 201 + 생성된 고객을 반환한다 — owner_agent_id는 현재 agent', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const me = await agent.get('/api/auth/me');
    const res = await agent.post('/api/customers').send(sampleCustomer);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('김매수');
    expect(res.body.customerType).toBe('buyer');
    expect(res.body.budgetMax).toBe(1500000000);
    expect(res.body.ownerAgentId).toBe(me.body.agent.id);
    expect(res.body.agencyId).toBe(me.body.agent.agencyId);
  });

  it('필수 필드 누락 시 400', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const res = await agent.post('/api/customers').send({ phone: '010-0000-0000' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
  });
});

describe('GET /api/customers', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('member는 본인 고객만 본다', async () => {
    const app = createApp();
    // owner 가입 → 고객 1명
    const owner = await signupAgent(app, { agencyName: 'A부동산', email: 'owner@example.com' });
    await owner.post('/api/customers').send(sampleCustomer);
    // owner가 member 추가 (직접 DB — /api/agents는 Plan 5)
    const me = await owner.get('/api/auth/me');
    await addMember(BigInt(me.body.agent.agencyId), 'm@example.com', '멤버');
    // member 로그인
    const member = request.agent(app);
    await member.post('/api/auth/login').send({ email: 'm@example.com', password: 'password123' });
    // member 자신의 고객 1명
    await member.post('/api/customers').send({ ...sampleCustomer, name: '멤버의 고객' });

    const memberList = await member.get('/api/customers');
    expect(memberList.body.total).toBe(1);
    expect(memberList.body.data[0].name).toBe('멤버의 고객');

    const ownerList = await owner.get('/api/customers');
    expect(ownerList.body.total).toBe(2); // owner는 사무소 전체
  });

  it('customerType 필터가 동작한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    await agent.post('/api/customers').send(sampleCustomer); // buyer
    await agent.post('/api/customers').send({ name: '박매도', customerType: 'seller' });

    const res = await agent.get('/api/customers?customerType=seller');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].name).toBe('박매도');
  });
});

describe('GET /api/customers/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('고객 상세를 반환한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const created = await agent.post('/api/customers').send(sampleCustomer);
    const res = await agent.get(`/api/customers/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.name).toBe('김매수');
  });

  it('없는 고객이면 404', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const res = await agent.get('/api/customers/999999');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/customers/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('고객을 수정한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const created = await agent.post('/api/customers').send(sampleCustomer);
    const res = await agent
      .patch(`/api/customers/${created.body.id}`)
      .send({ memo: '연락 완료', budgetMax: 2000000000 });
    expect(res.status).toBe(200);
    expect(res.body.memo).toBe('연락 완료');
    expect(res.body.budgetMax).toBe(2000000000);
  });
});

describe('DELETE /api/customers/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('고객을 삭제하고 204', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const created = await agent.post('/api/customers').send(sampleCustomer);
    const del = await agent.delete(`/api/customers/${created.body.id}`);
    expect(del.status).toBe(204);
    const after = await agent.get(`/api/customers/${created.body.id}`);
    expect(after.status).toBe(404);
  });
});

const sampleListing = {
  title: '강남 아파트',
  dealType: 'sale',
  propertyType: 'apartment',
  salePrice: 1200000000,
  areaM2: 84,
  address: '서울 강남구',
};

describe('GET/POST /api/customers/:id/listings', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('매칭 추가하면 201 + 매물 요약 포함', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const customer = await agent.post('/api/customers').send(sampleCustomer);
    const listing = await agent.post('/api/listings').send(sampleListing);

    const res = await agent
      .post(`/api/customers/${customer.body.id}/listings`)
      .send({ listingId: listing.body.id, memo: '관심 표시' });
    expect(res.status).toBe(201);
    expect(res.body.listingId).toBe(listing.body.id);
    expect(res.body.status).toBe('suggested');
    expect(res.body.memo).toBe('관심 표시');
  });

  it('같은 매물을 중복 매칭하면 409', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const customer = await agent.post('/api/customers').send(sampleCustomer);
    const listing = await agent.post('/api/listings').send(sampleListing);
    await agent
      .post(`/api/customers/${customer.body.id}/listings`)
      .send({ listingId: listing.body.id });
    const dup = await agent
      .post(`/api/customers/${customer.body.id}/listings`)
      .send({ listingId: listing.body.id });
    expect(dup.status).toBe(409);
  });

  it('타 사무소 매물로 매칭하면 404', async () => {
    const app = createApp();
    const agentA = await signupAgent(app, { agencyName: 'A', email: 'a@example.com' });
    const customer = await agentA.post('/api/customers').send(sampleCustomer);
    const agentB = await signupAgent(app, { agencyName: 'B', email: 'b@example.com' });
    const bListing = await agentB.post('/api/listings').send(sampleListing);

    const res = await agentA
      .post(`/api/customers/${customer.body.id}/listings`)
      .send({ listingId: bListing.body.id });
    expect(res.status).toBe(404);
  });

  it('매칭 목록은 매물 요약을 포함한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const customer = await agent.post('/api/customers').send(sampleCustomer);
    const listing = await agent.post('/api/listings').send(sampleListing);
    await agent
      .post(`/api/customers/${customer.body.id}/listings`)
      .send({ listingId: listing.body.id });

    const res = await agent.get(`/api/customers/${customer.body.id}/listings`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].listing.title).toBe('강남 아파트');
    expect(res.body[0].listing.dealType).toBe('sale');
  });
});

describe('PATCH/DELETE /api/customers/:id/listings/:matchId', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('매칭 상태·메모를 수정한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const customer = await agent.post('/api/customers').send(sampleCustomer);
    const listing = await agent.post('/api/listings').send(sampleListing);
    const match = await agent
      .post(`/api/customers/${customer.body.id}/listings`)
      .send({ listingId: listing.body.id });

    const res = await agent
      .patch(`/api/customers/${customer.body.id}/listings/${match.body.id}`)
      .send({ status: 'visited', memo: '임장 완료' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('visited');
    expect(res.body.memo).toBe('임장 완료');
  });

  it('매칭을 삭제하고 204', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const customer = await agent.post('/api/customers').send(sampleCustomer);
    const listing = await agent.post('/api/listings').send(sampleListing);
    const match = await agent
      .post(`/api/customers/${customer.body.id}/listings`)
      .send({ listingId: listing.body.id });

    const del = await agent.delete(
      `/api/customers/${customer.body.id}/listings/${match.body.id}`,
    );
    expect(del.status).toBe(204);
    const list = await agent.get(`/api/customers/${customer.body.id}/listings`);
    expect(list.body).toHaveLength(0);
  });
});
