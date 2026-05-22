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
