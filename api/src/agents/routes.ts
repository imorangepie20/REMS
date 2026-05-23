import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';

export const agentsRouter = Router();

agentsRouter.use(requireAuth);

/** Prisma Agent 행을 API 응답 형태로 변환 (passwordHash 제외) */
function toAgentResponse(row: Awaited<ReturnType<typeof prisma.agent.findFirstOrThrow>>) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

agentsRouter.get('/', async (req, res) => {
  const agencyId = req.agent!.agencyId;
  const agents = await prisma.agent.findMany({
    where: { agencyId },
    orderBy: { createdAt: 'asc' },
  });
  res.json(agents.map(toAgentResponse));
});
