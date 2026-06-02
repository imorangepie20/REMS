import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, errorResponse } from '@/lib/auth-helpers'
import { NotFoundError, ForbiddenError } from '@/lib/errors'
import { projectListing, canWriteListing } from '@/lib/listing-helpers'
import { updateListingSchema } from '@/lib/validators'

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const me = await requireAuth(req)
    const { id } = await ctx.params
    const targetId = Number(id)
    if (!Number.isFinite(targetId)) throw new NotFoundError('없는 매물입니다')

    const listing = await prisma.internalListing.findUnique({
      where: { id: targetId },
      include: { photos: { orderBy: { sortOrder: 'asc' } }, contracts: true },
    })
    if (!listing || listing.agencyId !== me.agencyId) {
      throw new NotFoundError('없는 매물입니다')
    }
    return NextResponse.json(projectListing(listing, me))
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const me = await requireAuth(req)
    const { id } = await ctx.params
    const targetId = Number(id)
    if (!Number.isFinite(targetId)) throw new NotFoundError('없는 매물입니다')

    const existing = await prisma.internalListing.findUnique({ where: { id: targetId } })
    if (!existing || existing.agencyId !== me.agencyId) {
      throw new NotFoundError('없는 매물입니다')
    }
    if (!canWriteListing(existing, me)) {
      throw new ForbiddenError('본인 매물 또는 owner만 수정할 수 있습니다')
    }

    const input = updateListingSchema.parse(await req.json())

    const updated = await prisma.internalListing.update({
      where: { id: targetId },
      data: {
        title: input.title,
        complexName: input.complexName ?? undefined,
        dong: input.dong ?? undefined,
        ho: input.ho ?? undefined,
        floor: input.floor ?? undefined,
        direction: input.direction ?? undefined,
        pyeongType: input.pyeongType ?? undefined,
        dealType: input.dealType,
        propertyType: input.propertyType,
        salePrice: input.salePrice ?? undefined,
        deposit: input.deposit ?? undefined,
        monthlyRent: input.monthlyRent ?? undefined,
        areaM2: input.areaM2,
        supplyAreaM2: input.supplyAreaM2 ?? undefined,
        address: input.address,
        roadAddress: input.roadAddress ?? undefined,
        addressDetail: input.addressDetail ?? undefined,
        latitude: input.latitude ?? undefined,
        longitude: input.longitude ?? undefined,
        maintenanceFee: input.maintenanceFee ?? undefined,
        availableMoveInDate: input.availableMoveInDate ?? undefined,
        ownerName: input.ownerName ?? undefined,
        ownerPhone: input.ownerPhone ?? undefined,
        ownerMemo: input.ownerMemo ?? undefined,
        commissionRate: input.commissionRate ?? undefined,
        description: input.description ?? undefined,
        privateMemo: input.privateMemo ?? undefined,
        status: input.status,
        contractedAt: input.contractedAt ?? undefined,
        contractedPrice: input.contractedPrice ?? undefined,
      },
    })
    return NextResponse.json(projectListing(updated, me))
  } catch (err) {
    return errorResponse(err)
  }
}
