import '../src/bigint-json';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app';
import { resetDb, signupAgent } from './helpers';

const sampleListing = {
  title: '강남 아파트',
  dealType: 'sale',
  propertyType: 'apartment',
  salePrice: 1500000000,
  areaM2: 84.5,
  address: '서울 강남구 역삼동 123',
};

describe('POST /api/listings', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('인증 없으면 401', async () => {
    const app = createApp();
    const res = await request(app).post('/api/listings').send(sampleListing);
    expect(res.status).toBe(401);
  });

  it('매물을 등록하고 201 + 생성된 매물을 반환한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const res = await agent.post('/api/listings').send(sampleListing);
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('강남 아파트');
    expect(res.body.salePrice).toBe(1500000000);
    expect(res.body.status).toBe('active');
    expect(res.body.photos).toEqual([]);
    expect(typeof res.body.agencyId).toBe('number');
  });

  it('매매인데 매매가가 없으면 400', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const res = await agent
      .post('/api/listings')
      .send({ ...sampleListing, salePrice: undefined });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
  });
});

describe('GET /api/listings', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('우리 사무소 매물 목록을 페이지네이션 형태로 반환한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    await agent.post('/api/listings').send(sampleListing);
    await agent.post('/api/listings').send({ ...sampleListing, title: '두 번째 매물' });

    const res = await agent.get('/api/listings');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.page).toBe(1);
  });

  it('dealType 필터가 동작한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    await agent.post('/api/listings').send(sampleListing); // sale
    await agent
      .post('/api/listings')
      .send({ title: '전세집', dealType: 'jeonse', propertyType: 'house', deposit: 300000000, areaM2: 60, address: '서울 마포구' });

    const res = await agent.get('/api/listings?dealType=jeonse');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].title).toBe('전세집');
  });
});

describe('GET /api/listings/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('매물 상세를 반환한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const created = await agent.post('/api/listings').send(sampleListing);
    const res = await agent.get(`/api/listings/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.title).toBe('강남 아파트');
  });

  it('없는 매물이면 404', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const res = await agent.get('/api/listings/999999');
    expect(res.status).toBe(404);
  });
});
