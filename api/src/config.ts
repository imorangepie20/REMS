import 'dotenv/config';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL 환경 변수가 설정되지 않았습니다 (api/.env 확인)');
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  session: {
    cookieName: 'rems_session',
    ttlMs: 30 * 24 * 60 * 60 * 1000, // 30일
    secure: process.env.NODE_ENV === 'production', // 프로덕션(HTTPS)에서만 Secure 쿠키
  },
};
