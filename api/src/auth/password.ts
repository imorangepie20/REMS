import bcrypt from 'bcrypt';

const COST = 10;

/** 평문 비밀번호를 bcrypt로 해시한다 */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

/** 평문 비밀번호와 해시를 비교한다 */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
