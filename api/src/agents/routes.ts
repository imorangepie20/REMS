import { Router } from 'express';
import bcrypt from 'bcrypt';
import { createAgentSchema, updateAgentSchema } from '@rems/shared';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors';

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

agentsRouter.patch('/:id', async (req, res) => {
  const numericId = Number(req.params.id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new NotFoundError('중개사를 찾을 수 없습니다');
  }
  const target = await prisma.agent.findFirst({
    where: { id: BigInt(numericId), agencyId: req.agent!.agencyId },
  });
  if (!target) throw new NotFoundError('중개사를 찾을 수 없습니다');

  const data = updateAgentSchema.parse(req.body);
  const isSelf = target.id === req.agent!.id;
  const isOwner = req.agent!.role === 'owner';

  if (data.status !== undefined) {
    if (!isOwner) throw new ForbiddenError('status는 owner만 변경할 수 있습니다');
    if (isSelf) throw new ForbiddenError('본인 status는 변경할 수 없습니다');
  }
  if ((data.name !== undefined || data.phone !== undefined) && !isSelf && !isOwner) {
    throw new ForbiddenError('다른 중개사의 프로필은 수정할 수 없습니다');
  }

  const updated = await prisma.agent.update({
    where: { id: target.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });
  res.json(toAgentResponse(updated));
});
