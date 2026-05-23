import '../src/bigint-json';
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app';
import { resetDb, signupAgent } from './helpers';

describe('GET /api/dashboard/summary', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('빈 사무소는 0 카운트를 반환한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const res = await agent.get('/api/dashboard/summary');
    expect(res.status).toBe(200);
    expect(res.body.listings).toEqual({ active: 0, completed: 0, hidden: 0 });
    expect(res.body.customers).toEqual({ mine: 0, agency: 0 });
    expect(res.body.matches.byStatus.suggested).toBe(0);
    expect(res.body.matches.recent).toEqual([]);
  });

  it('매물·고객·매칭 카운트가 정확히 집계된다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const l1 = await agent.post('/api/listings').send({
      title: '매물1', dealType: 'sale', propertyType: 'apartment',
      salePrice: 1000000000, areaM2: 60, address: '서울',
    });
    const l2 = await agent.post('/api/listings').send({
      title: '매물2', dealType: 'sale', propertyType: 'apartment',
      salePrice: 2000000000, areaM2: 80, address: '서울',
    });
    await agent.patch(`/api/listings/${l2.body.id}`).send({ status: 'completed' });

    const c1 = await agent.post('/api/customers').send({ name: '고객A', customerType: 'buyer' });
    await agent.post('/api/customers').send({ name: '고객B', customerType: 'buyer' });

    await agent.post(`/api/customers/${c1.body.id}/listings`).send({ listingId: l1.body.id });

    const res = await agent.get('/api/dashboard/summary');
    expect(res.status).toBe(200);
    expect(res.body.listings).toEqual({ active: 1, completed: 1, hidden: 0 });
    expect(res.body.customers.mine).toBe(2);
    expect(res.body.customers.agency).toBe(2);
    expect(res.body.matches.byStatus.suggested).toBe(1);
    expect(res.body.matches.recent).toHaveLength(1);
    expect(res.body.matches.recent[0].customerName).toBe('고객A');
    expect(res.body.matches.recent[0].listingTitle).toBe('매물1');
  });
});
