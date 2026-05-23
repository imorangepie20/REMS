import { Router } from 'express';
import { createCustomerSchema, customerFilterSchema } from '@rems/shared';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';
import { NotFoundError } from '../errors';
import type { AuthenticatedAgent } from '../auth/session';

export const customersRouter = Router();

customersRouter.use(requireAuth);

/** Prisma Customer 행을 API 응답 형태로 변환한다 */
function toCustomerResponse(row: Awaited<ReturnType<typeof prisma.customer.findFirstOrThrow>>) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

customersRouter.post('/', async (req, res) => {
  const data = createCustomerSchema.parse(req.body);
  const agent = req.agent!;
  const created = await prisma.customer.create({
    data: {
      agencyId: agent.agencyId,
      ownerAgentId: agent.id,
      name: data.name,
      phone: data.phone,
      customerType: data.customerType,
      budgetMin: data.budgetMin == null ? null : BigInt(data.budgetMin),
      budgetMax: data.budgetMax == null ? null : BigInt(data.budgetMax),
      desiredArea: data.desiredArea,
      memo: data.memo,
    },
  });
  res.status(201).json(toCustomerResponse(created));
});

/** member는 owner_agent_id=self도 추가 필터 */
function ownerFilter(agent: AuthenticatedAgent) {
  return agent.role === 'member' ? { ownerAgentId: agent.id } : {};
}

/** 우리 사무소(또는 본인 소속)의 고객을 id로 찾는다. 없거나 권한 없으면 404. */
async function findOwnCustomerOrThrow(id: string, agent: AuthenticatedAgent) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new NotFoundError('고객을 찾을 수 없습니다');
  }
  const customer = await prisma.customer.findFirst({
    where: {
      id: BigInt(numericId),
      agencyId: agent.agencyId,
      ...ownerFilter(agent),
    },
  });
  if (!customer) throw new NotFoundError('고객을 찾을 수 없습니다');
  return customer;
}

customersRouter.get('/', async (req, res) => {
  const filter = customerFilterSchema.parse(req.query);
  const agent = req.agent!;

  const where = {
    agencyId: agent.agencyId,
    ...ownerFilter(agent),
    ...(filter.customerType ? { customerType: filter.customerType } : {}),
    ...(filter.q
      ? {
          OR: [
            { name: { contains: filter.q } },
            { phone: { contains: filter.q } },
            { desiredArea: { contains: filter.q } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filter.page - 1) * filter.limit,
      take: filter.limit,
    }),
    prisma.customer.count({ where }),
  ]);

  res.json({
    data: rows.map(toCustomerResponse),
    total,
    page: filter.page,
    limit: filter.limit,
  });
});

customersRouter.get('/:id', async (req, res) => {
  const customer = await findOwnCustomerOrThrow(req.params.id, req.agent!);
  res.json(toCustomerResponse(customer));
});
