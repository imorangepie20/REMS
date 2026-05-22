import { describe, it, expect } from 'vitest';
import { prisma } from '../src/db';

describe('database connection', () => {
  it('agency 테이블 카운트를 조회할 수 있다', async () => {
    const count = await prisma.agency.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
