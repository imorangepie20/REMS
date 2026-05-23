import '../src/bigint-json';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app';
import { resetDb, signupAgent, addMember } from './helpers';

describe('GET /api/agents', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('인증 없으면 401', async () => {
    const app = createApp();
    const res = await request(app).get('/api/agents');
    expect(res.status).toBe(401);
  });

  it('사무소 소속 중개사 목록을 반환한다', async () => {
    const app = createApp();
    const owner = await signupAgent(app, { agencyName: 'A부동산', email: 'owner@example.com' });
    const me = await owner.get('/api/auth/me');
    await addMember(BigInt(me.body.agent.agencyId), 'm1@example.com', '멤버1');
    await addMember(BigInt(me.body.agent.agencyId), 'm2@example.com', '멤버2');

    const res = await owner.get('/api/agents');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    const names = (res.body as Array<{ name: string }>).map((a) => a.name).sort();
    expect(names).toEqual(['멤버1', '멤버2', '테스터']);
  });

  it('다른 사무소 중개사는 안 보인다', async () => {
    const app = createApp();
    const a = await signupAgent(app, { agencyName: 'A부동산', email: 'a@example.com' });
    await signupAgent(app, { agencyName: 'B부동산', email: 'b@example.com' });
    const res = await a.get('/api/agents');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect((res.body as Array<{ email: string }>)[0].email).toBe('a@example.com');
  });
});
