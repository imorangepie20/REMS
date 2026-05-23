import '../src/bigint-json';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app';
import { resetDb, signupAgent, addMember } from './helpers';

describe('PATCH /api/agency', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('owner가 사무소 정보를 수정한다', async () => {
    const app = createApp();
    const owner = await signupAgent(app, { agencyName: 'A부동산', email: 'owner@example.com' });
    const res = await owner.patch('/api/agency').send({
      name: '강남부동산',
      phone: '02-1234-5678',
      address: '서울 강남구',
    });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('강남부동산');
    expect(res.body.phone).toBe('02-1234-5678');
  });

  it('member는 수정 못 함 (403)', async () => {
    const app = createApp();
    const owner = await signupAgent(app, { agencyName: 'A부동산', email: 'owner@example.com' });
    const me = await owner.get('/api/auth/me');
    await addMember(BigInt(me.body.agent.agencyId), 'm@example.com', '멤버');
    const member = request.agent(app);
    await member.post('/api/auth/login').send({ email: 'm@example.com', password: 'password123' });
    const res = await member.patch('/api/agency').send({ name: 'x' });
    expect(res.status).toBe(403);
  });
});
