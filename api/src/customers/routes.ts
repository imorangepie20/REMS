import { Router } from 'express';
import { createCustomerSchema } from '@rems/shared';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';

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
