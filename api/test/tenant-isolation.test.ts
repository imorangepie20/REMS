import '../src/bigint-json';
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app';
import { resetDb, signupAgent } from './helpers';

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
