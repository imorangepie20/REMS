import '../src/bigint-json';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app';
import { resetDb, signupAgent } from './helpers';

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
