import { randomBytes } from 'crypto';
import { prisma } from '../db';
import { config } from '../config';

export type AgentRole = 'owner' | 'member';

export interface AuthenticatedAgent {
  id: bigint;
  agencyId: bigint;
  role: AgentRole;
}

/** 64자 hex 랜덤 토큰 */
function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/** 세션을 DB에 만들고 토큰을 반환한다 */
export async function createSession(agentId: bigint): Promise<string> {
  const id = generateToken();
  const expiresAt = new Date(Date.now() + config.session.ttlMs);
  await prisma.session.create({ data: { id, agentId, expiresAt } });
  return id;
}

/** 토큰으로 세션을 조회한다. 만료된 세션은 자동 삭제 후 null. */
export async function getSession(token: string): Promise<{ agent: AuthenticatedAgent } | null> {
  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { agent: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: token } }).catch(() => undefined);
    return null;
  }
  return {
    agent: {
      id: session.agent.id,
      agencyId: session.agent.agencyId,
      role: session.agent.role,
    },
  };
}

/** 토큰의 세션을 삭제한다 (이미 없으면 무시) */
export async function destroySession(token: string): Promise<void> {
  await prisma.session.delete({ where: { id: token } }).catch(() => undefined);
}
