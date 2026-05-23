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

describe('POST /api/agents', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('owner가 멤버를 생성하면 201', async () => {
    const app = createApp();
    const owner = await signupAgent(app, { agencyName: 'A부동산', email: 'owner@example.com' });
    const res = await owner.post('/api/agents').send({
      email: 'new@example.com',
      name: '신규멤버',
      password: 'password123',
    });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('new@example.com');
    expect(res.body.role).toBe('member');
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('member는 멤버를 생성할 수 없다 (403)', async () => {
    const app = createApp();
    const owner = await signupAgent(app, { agencyName: 'A부동산', email: 'owner@example.com' });
    const me = await owner.get('/api/auth/me');
    await addMember(BigInt(me.body.agent.agencyId), 'm@example.com', '멤버');
    const member = request.agent(app);
    await member.post('/api/auth/login').send({ email: 'm@example.com', password: 'password123' });

    const res = await member.post('/api/agents').send({
      email: 'x@example.com',
      name: 'x',
      password: 'password123',
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('이미 사용 중인 이메일이면 409', async () => {
    const app = createApp();
    const owner = await signupAgent(app, { agencyName: 'A부동산', email: 'owner@example.com' });
    await owner.post('/api/agents').send({
      email: 'dup@example.com',
      name: '첫번째',
      password: 'password123',
    });
    const dup = await owner.post('/api/agents').send({
      email: 'dup@example.com',
      name: '두번째',
      password: 'password123',
    });
    expect(dup.status).toBe(409);
  });
});

describe('PATCH /api/agents/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('본인 프로필을 수정한다', async () => {
    const app = createApp();
    const agent = await signupAgent(app);
    const me = await agent.get('/api/auth/me');
    const res = await agent.patch(`/api/agents/${me.body.agent.id}`).send({ name: '바뀐이름', phone: '010-1111-2222' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('바뀐이름');
    expect(res.body.phone).toBe('010-1111-2222');
  });

  it('owner가 멤버 status를 inactive로 바꿀 수 있다', async () => {
    const app = createApp();
    const owner = await signupAgent(app, { agencyName: 'A부동산', email: 'owner@example.com' });
    const me = await owner.get('/api/auth/me');
    await addMember(BigInt(me.body.agent.agencyId), 'm@example.com', '멤버');
    const agents = await owner.get('/api/agents');
    const member = (agents.body as Array<{ id: number; email: string }>).find((a) => a.email === 'm@example.com')!;

    const res = await owner.patch(`/api/agents/${member.id}`).send({ status: 'inactive' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('inactive');
  });

  it('member가 다른 사람의 status를 바꾸려 하면 403', async () => {
    const app = createApp();
    const owner = await signupAgent(app, { agencyName: 'A부동산', email: 'owner@example.com' });
    const me = await owner.get('/api/auth/me');
    await addMember(BigInt(me.body.agent.agencyId), 'm1@example.com', '멤버1');
    await addMember(BigInt(me.body.agent.agencyId), 'm2@example.com', '멤버2');
    const m1 = request.agent(app);
    await m1.post('/api/auth/login').send({ email: 'm1@example.com', password: 'password123' });
    const agents = await owner.get('/api/agents');
    const m2Id = (agents.body as Array<{ id: number; email: string }>).find((a) => a.email === 'm2@example.com')!.id;

    const res = await m1.patch(`/api/agents/${m2Id}`).send({ status: 'inactive' });
    expect(res.status).toBe(403);
  });

  it('다른 사무소 agent 수정은 404', async () => {
    const app = createApp();
    const ownerA = await signupAgent(app, { agencyName: 'A부동산', email: 'a@example.com' });
    const ownerB = await signupAgent(app, { agencyName: 'B부동산', email: 'b@example.com' });
    const meB = await ownerB.get('/api/auth/me');
    const res = await ownerA.patch(`/api/agents/${meB.body.agent.id}`).send({ name: 'x' });
    expect(res.status).toBe(404);
  });
});
