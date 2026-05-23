import '../src/bigint-json';
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { resetDb, signupAgent, addMember } from './helpers';

const listingA = {
  title: 'A사무소 매물',
  dealType: 'sale',
  propertyType: 'apartment',
  salePrice: 900000000,
  areaM2: 70,
  address: '서울 서초구',
};

describe('테넌트 격리 — 사무소 A의 매물은 사무소 B에게 보이지 않는다', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('B의 목록에는 A의 매물이 없다', async () => {
    const app = createApp();
    const agentA = await signupAgent(app, { agencyName: 'A부동산', email: 'a@example.com' });
    await agentA.post('/api/listings').send(listingA);

    const agentB = await signupAgent(app, { agencyName: 'B부동산', email: 'b@example.com' });
    const res = await agentB.get('/api/listings');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  it('B가 A의 매물 상세를 요청하면 404', async () => {
    const app = createApp();
    const agentA = await signupAgent(app, { agencyName: 'A부동산', email: 'a@example.com' });
    const created = await agentA.post('/api/listings').send(listingA);

    const agentB = await signupAgent(app, { agencyName: 'B부동산', email: 'b@example.com' });
    const res = await agentB.get(`/api/listings/${created.body.id}`);
    expect(res.status).toBe(404);
  });

  it('B가 A의 매물을 수정/삭제하려 하면 404', async () => {
    const app = createApp();
    const agentA = await signupAgent(app, { agencyName: 'A부동산', email: 'a@example.com' });
    const created = await agentA.post('/api/listings').send(listingA);

    const agentB = await signupAgent(app, { agencyName: 'B부동산', email: 'b@example.com' });
    const patch = await agentB.patch(`/api/listings/${created.body.id}`).send({ title: '탈취' });
    expect(patch.status).toBe(404);
    const del = await agentB.delete(`/api/listings/${created.body.id}`);
    expect(del.status).toBe(404);

    // A의 매물은 그대로다
    const stillThere = await agentA.get(`/api/listings/${created.body.id}`);
    expect(stillThere.status).toBe(200);
    expect(stillThere.body.title).toBe('A사무소 매물');
  });
});

const customerA = {
  name: 'A사무소 고객',
  customerType: 'buyer',
};

describe('테넌트 격리 — 고객', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('B의 고객 목록에는 A의 고객이 없다', async () => {
    const app = createApp();
    const agentA = await signupAgent(app, { agencyName: 'A부동산', email: 'a@example.com' });
    await agentA.post('/api/customers').send(customerA);

    const agentB = await signupAgent(app, { agencyName: 'B부동산', email: 'b@example.com' });
    const res = await agentB.get('/api/customers');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  it('B가 A의 고객 상세/수정/삭제 요청은 모두 404', async () => {
    const app = createApp();
    const agentA = await signupAgent(app, { agencyName: 'A부동산', email: 'a@example.com' });
    const created = await agentA.post('/api/customers').send(customerA);

    const agentB = await signupAgent(app, { agencyName: 'B부동산', email: 'b@example.com' });
    expect((await agentB.get(`/api/customers/${created.body.id}`)).status).toBe(404);
    expect((await agentB.patch(`/api/customers/${created.body.id}`).send({ name: 'x' })).status).toBe(404);
    expect((await agentB.delete(`/api/customers/${created.body.id}`)).status).toBe(404);
  });
});

describe('역할 격리 — 같은 사무소 내 member끼리는 서로의 고객을 못 본다', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('member1의 고객을 member2가 조회/수정/삭제하려 하면 404; owner는 둘 다 본다', async () => {
    const app = createApp();
    const owner = await signupAgent(app, { agencyName: 'A부동산', email: 'owner@example.com' });
    const me = await owner.get('/api/auth/me');
    // member1, member2 추가 (직접 DB)
    await addMember(BigInt(me.body.agent.agencyId), 'm1@example.com', '멤버1');
    await addMember(BigInt(me.body.agent.agencyId), 'm2@example.com', '멤버2');

    const m1 = request.agent(app);
    await m1.post('/api/auth/login').send({ email: 'm1@example.com', password: 'password123' });
    const m2 = request.agent(app);
    await m2.post('/api/auth/login').send({ email: 'm2@example.com', password: 'password123' });

    const c1 = await m1.post('/api/customers').send({ name: '멤버1의 고객', customerType: 'buyer' });

    expect((await m2.get(`/api/customers/${c1.body.id}`)).status).toBe(404);
    expect((await m2.patch(`/api/customers/${c1.body.id}`).send({ name: 'x' })).status).toBe(404);
    expect((await m2.delete(`/api/customers/${c1.body.id}`)).status).toBe(404);

    // member2의 목록엔 멤버1의 고객이 없다
    const list2 = await m2.get('/api/customers');
    expect(list2.body.total).toBe(0);

    // owner는 둘 다 본다
    const ownerList = await owner.get('/api/customers');
    expect(ownerList.body.total).toBe(1);
    expect((await owner.get(`/api/customers/${c1.body.id}`)).status).toBe(200);
  });
});
