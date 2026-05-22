import { Router } from 'express';
import { createListingSchema } from '@rems/shared';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';

export const listingsRouter = Router();

listingsRouter.use(requireAuth);

/** Prisma Listing 행을 API 응답 형태로 변환한다 */
function toListingResponse(
  row: Awaited<ReturnType<typeof prisma.listing.findFirstOrThrow>> & {
    photos?: { id: bigint; url: string; sortOrder: number }[];
  },
) {
  return {
    ...row,
    areaM2: Number(row.areaM2),
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    photos: (row.photos ?? []).map((p) => ({
      id: p.id,
      url: p.url,
      sortOrder: p.sortOrder,
    })),
  };
}

listingsRouter.post('/', async (req, res) => {
  const data = createListingSchema.parse(req.body);
  const agent = req.agent!;
  const created = await prisma.listing.create({
    data: {
      agencyId: agent.agencyId,
      createdBy: agent.id,
      title: data.title,
      dealType: data.dealType,
      propertyType: data.propertyType,
      salePrice: data.salePrice == null ? null : BigInt(data.salePrice),
      deposit: data.deposit == null ? null : BigInt(data.deposit),
      monthlyRent: data.monthlyRent == null ? null : BigInt(data.monthlyRent),
      areaM2: data.areaM2,
      address: data.address,
      addressDetail: data.addressDetail,
      latitude: data.latitude,
      longitude: data.longitude,
      floor: data.floor,
      totalFloors: data.totalFloors,
      rooms: data.rooms,
      bathrooms: data.bathrooms,
      builtYear: data.builtYear,
      description: data.description,
    },
    include: { photos: true },
  });
  res.status(201).json(toListingResponse(created));
});
