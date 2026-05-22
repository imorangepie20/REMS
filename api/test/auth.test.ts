import '../src/bigint-json';
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { resetDb } from './helpers';

describe('POST /api/auth/signup', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('201을 반환하고 사무소·owner를 생성하고 세션 쿠키를 설정한다', async () => {
    const res = await request(createApp())
      .post('/api/auth/signup')
      .send({
        agency: { name: '강남부동산' },
        owner: {
          email: 'kim@example.com',
          password: 'password123',
          name: '김중개',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.agent.email).toBe('kim@example.com');
    expect(res.body.agent.role).toBe('owner');
    expect(res.body.agency.name).toBe('강남부동산');
    expect(res.body.agent.agencyId).toBe(res.body.agency.id);
    expect(res.headers['set-cookie']?.[0]).toMatch(/^rems_session=[a-f0-9]{64}/);
  });

  it('이미 사용 중인 이메일이면 409를 반환한다', async () => {
    const payload = {
      agency: { name: 'A부동산' },
      owner: { email: 'dup@example.com', password: 'password123', name: '중개1' },
    };
    await request(createApp()).post('/api/auth/signup').send(payload).expect(201);

    const res = await request(createApp())
      .post('/api/auth/signup')
      .send({
        agency: { name: 'B부동산' },
        owner: { email: 'dup@example.com', password: 'password456', name: '중개2' },
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('필수 필드 누락 시 400을 반환한다', async () => {
    const res = await request(createApp())
      .post('/api/auth/signup')
      .send({ agency: { name: 'X' }, owner: { email: 'bad', password: '123', name: '' } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await resetDb();
    // signup으로 사용자 하나 준비
    await request(createApp())
      .post('/api/auth/signup')
      .send({
        agency: { name: 'A부동산' },
        owner: { email: 'login@example.com', password: 'password123', name: '로그인테스트' },
      });
  });

  it('올바른 이메일·비밀번호로 200 + 세션 쿠키를 반환한다', async () => {
    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.agent.email).toBe('login@example.com');
    expect(res.headers['set-cookie']?.[0]).toMatch(/^rems_session=[a-f0-9]{64}/);
  });

  it('잘못된 비밀번호면 401을 반환한다', async () => {
    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('존재하지 않는 이메일이면 401을 반환한다', async () => {
    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });
    expect(res.status).toBe(401);
  });
});
