import { Router } from 'express';
import { updateAgencySchema } from '@rems/shared';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';
import { ForbiddenError } from '../errors';

export const agencyRouter = Router();

agencyRouter.use(requireAuth);

function toAgencyResponse(row: Awaited<ReturnType<typeof prisma.agency.findUniqueOrThrow>>) {
  return {
    id: row.id,
    name: row.name,
    businessNumber: row.businessNumber,
    phone: row.phone,
    address: row.address,
    createdAt: row.createdAt.toISOString(),
  };
}

agencyRouter.patch('/', async (req, res) => {
  if (req.agent!.role !== 'owner') throw new ForbiddenError('owner만 사무소 정보를 수정할 수 있습니다');
  const data = updateAgencySchema.parse(req.body);
  const updated = await prisma.agency.update({
    where: { id: req.agent!.agencyId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.businessNumber !== undefined ? { businessNumber: data.businessNumber } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
    },
  });
  res.json(toAgencyResponse(updated));
});
