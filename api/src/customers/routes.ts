import { Router } from 'express';
import { createCustomerSchema, updateCustomerSchema, customerFilterSchema, createMatchSchema } from '@rems/shared';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';
import { ConflictError, NotFoundError } from '../errors';
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

customersRouter.patch('/:id', async (req, res) => {
  await findOwnCustomerOrThrow(req.params.id, req.agent!);
  const data = updateCustomerSchema.parse(req.body);
  const updated = await prisma.customer.update({
    where: { id: BigInt(Number(req.params.id)) },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.customerType !== undefined ? { customerType: data.customerType } : {}),
      ...(data.budgetMin !== undefined
        ? { budgetMin: data.budgetMin == null ? null : BigInt(data.budgetMin) }
        : {}),
      ...(data.budgetMax !== undefined
        ? { budgetMax: data.budgetMax == null ? null : BigInt(data.budgetMax) }
        : {}),
      ...(data.desiredArea !== undefined ? { desiredArea: data.desiredArea } : {}),
      ...(data.memo !== undefined ? { memo: data.memo } : {}),
    },
  });
  res.json(toCustomerResponse(updated));
});

customersRouter.delete('/:id', async (req, res) => {
  await findOwnCustomerOrThrow(req.params.id, req.agent!);
  await prisma.customer.delete({ where: { id: BigInt(Number(req.params.id)) } });
  res.status(204).send();
});

interface ListingSummaryRow {
  id: bigint;
  title: string;
  address: string;
  dealType: 'sale' | 'jeonse' | 'wolse';
  status: 'active' | 'completed' | 'hidden';
}

function toMatchResponse(
  row: Awaited<ReturnType<typeof prisma.customerListing.findFirstOrThrow>>,
  listing?: ListingSummaryRow,
) {
  return {
    id: row.id,
    customerId: row.customerId,
    listingId: row.listingId,
    status: row.status,
    memo: row.memo,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(listing
      ? {
          listing: {
            id: listing.id,
            title: listing.title,
            address: listing.address,
            dealType: listing.dealType,
            status: listing.status,
          },
        }
      : {}),
  };
}

customersRouter.get('/:id/listings', async (req, res) => {
  const customer = await findOwnCustomerOrThrow(req.params.id, req.agent!);
  const matches = await prisma.customerListing.findMany({
    where: { customerId: customer.id },
    include: {
      listing: {
        select: { id: true, title: true, address: true, dealType: true, status: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(matches.map((m) => toMatchResponse(m, m.listing)));
});

customersRouter.post('/:id/listings', async (req, res) => {
  const customer = await findOwnCustomerOrThrow(req.params.id, req.agent!);
  const { listingId, status, memo } = createMatchSchema.parse(req.body);

  // 같은 사무소 매물인지 확인
  const listing = await prisma.listing.findFirst({
    where: { id: BigInt(listingId), agencyId: req.agent!.agencyId },
    select: { id: true, title: true, address: true, dealType: true, status: true },
  });
  if (!listing) throw new NotFoundError('매물을 찾을 수 없습니다');

  try {
    const match = await prisma.customerListing.create({
      data: {
        customerId: customer.id,
        listingId: listing.id,
        status: status ?? 'suggested',
        memo,
      },
    });
    res.status(201).json(toMatchResponse(match, listing));
  } catch (err: unknown) {
    if (
      err != null &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    ) {
      throw new ConflictError('이미 매칭된 매물입니다');
    }
    throw err;
  }
});
