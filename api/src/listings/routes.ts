import { Router } from 'express';
import { createListingSchema, updateListingSchema, listingFilterSchema } from '@rems/shared';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';
import { NotFoundError } from '../errors';
import { photoUpload } from './upload';

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

/** 우리 사무소의 매물을 id로 찾는다. 없거나 타 사무소면 404. */
async function findOwnListingOrThrow(id: string, agencyId: bigint) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new NotFoundError('매물을 찾을 수 없습니다');
  }
  const listing = await prisma.listing.findFirst({
    where: { id: BigInt(numericId), agencyId },
    include: { photos: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!listing) throw new NotFoundError('매물을 찾을 수 없습니다');
  return listing;
}

listingsRouter.get('/', async (req, res) => {
  const filter = listingFilterSchema.parse(req.query);
  const agencyId = req.agent!.agencyId;

  const where = {
    agencyId,
    ...(filter.dealType ? { dealType: filter.dealType } : {}),
    ...(filter.propertyType ? { propertyType: filter.propertyType } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.q
      ? { OR: [{ title: { contains: filter.q } }, { address: { contains: filter.q } }] }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      include: { photos: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      skip: (filter.page - 1) * filter.limit,
      take: filter.limit,
    }),
    prisma.listing.count({ where }),
  ]);

  res.json({
    data: rows.map(toListingResponse),
    total,
    page: filter.page,
    limit: filter.limit,
  });
});

listingsRouter.get('/:id', async (req, res) => {
  const listing = await findOwnListingOrThrow(req.params.id, req.agent!.agencyId);
  res.json(toListingResponse(listing));
});

listingsRouter.patch('/:id', async (req, res) => {
  await findOwnListingOrThrow(req.params.id, req.agent!.agencyId);
  const data = updateListingSchema.parse(req.body);
  const updated = await prisma.listing.update({
    where: { id: BigInt(Number(req.params.id)) },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.dealType !== undefined ? { dealType: data.dealType } : {}),
      ...(data.propertyType !== undefined ? { propertyType: data.propertyType } : {}),
      ...(data.salePrice !== undefined
        ? { salePrice: data.salePrice == null ? null : BigInt(data.salePrice) }
        : {}),
      ...(data.deposit !== undefined
        ? { deposit: data.deposit == null ? null : BigInt(data.deposit) }
        : {}),
      ...(data.monthlyRent !== undefined
        ? { monthlyRent: data.monthlyRent == null ? null : BigInt(data.monthlyRent) }
        : {}),
      ...(data.areaM2 !== undefined ? { areaM2: data.areaM2 } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.addressDetail !== undefined ? { addressDetail: data.addressDetail } : {}),
      ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
      ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
      ...(data.floor !== undefined ? { floor: data.floor } : {}),
      ...(data.totalFloors !== undefined ? { totalFloors: data.totalFloors } : {}),
      ...(data.rooms !== undefined ? { rooms: data.rooms } : {}),
      ...(data.bathrooms !== undefined ? { bathrooms: data.bathrooms } : {}),
      ...(data.builtYear !== undefined ? { builtYear: data.builtYear } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
    },
    include: { photos: { orderBy: { sortOrder: 'asc' } } },
  });
  res.json(toListingResponse(updated));
});

listingsRouter.delete('/:id', async (req, res) => {
  await findOwnListingOrThrow(req.params.id, req.agent!.agencyId);
  await prisma.listing.delete({ where: { id: BigInt(Number(req.params.id)) } });
  res.status(204).send();
});

listingsRouter.post('/:id/photos', async (req, res, next) => {
  // 매물 소유 확인을 업로드보다 먼저
  await findOwnListingOrThrow(req.params.id, req.agent!.agencyId);
  photoUpload(req, res, (err: unknown) => {
    if (err) return next(err);
    void (async () => {
      try {
        if (!req.file) throw new NotFoundError('업로드된 파일이 없습니다');
        const count = await prisma.listingPhoto.count({
          where: { listingId: BigInt(Number(req.params.id)) },
        });
        const photo = await prisma.listingPhoto.create({
          data: {
            listingId: BigInt(Number(req.params.id)),
            url: `/uploads/${req.file.filename}`,
            sortOrder: count,
          },
        });
        res.status(201).json({ id: photo.id, url: photo.url, sortOrder: photo.sortOrder });
      } catch (e) {
        next(e);
      }
    })();
  });
});
