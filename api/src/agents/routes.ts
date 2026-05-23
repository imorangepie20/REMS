import { Router } from 'express';
import bcrypt from 'bcrypt';
import { createAgentSchema } from '@rems/shared';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';
import { ConflictError, ForbiddenError } from '../errors';

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

agentsRouter.post('/', async (req, res) => {
  if (req.agent!.role !== 'owner') throw new ForbiddenError('owner만 멤버를 생성할 수 있습니다');
  const data = createAgentSchema.parse(req.body);

  const exists = await prisma.agent.findUnique({ where: { email: data.email } });
  if (exists) throw new ConflictError('이미 사용 중인 이메일입니다');

  const passwordHash = await bcrypt.hash(data.password, 10);
  const created = await prisma.agent.create({
    data: {
      agencyId: req.agent!.agencyId,
      email: data.email,
      passwordHash,
      name: data.name,
      phone: data.phone,
      role: 'member',
    },
  });
  res.status(201).json(toAgentResponse(created));
});
