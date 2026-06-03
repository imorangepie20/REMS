import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, errorResponse } from '@/lib/auth-helpers'
import { createListingSchema, listingQuerySchema } from '@/lib/validators'
import { projectListing } from '@/lib/listing-helpers'

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const me = await requireAuth(req)
    const input = createListingSchema.parse(await req.json())

    const created = await prisma.internalListing.create({
      data: {
        agencyId: me.agencyId,
        createdById: me.id,
        title: input.title,
        complexName: input.complexName ?? null,
        dong: input.dong ?? null,
        ho: input.ho ?? null,
        floor: input.floor ?? null,
        direction: input.direction ?? null,
        pyeongType: input.pyeongType ?? null,
        dealType: input.dealType,
        propertyType: input.propertyType,
        salePrice: input.salePrice ?? null,
        deposit: input.deposit ?? null,
        monthlyRent: input.monthlyRent ?? null,
        areaM2: input.areaM2,
        supplyAreaM2: input.supplyAreaM2 ?? null,
        address: input.address,
        roadAddress: input.roadAddress ?? null,
        addressDetail: input.addressDetail ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        maintenanceFee: input.maintenanceFee ?? null,
        availableMoveInDate: input.availableMoveInDate ?? null,
        ownerName: input.ownerName ?? null,
        ownerPhone: input.ownerPhone ?? null,
        ownerMemo: input.ownerMemo ?? null,
        commissionRate: input.commissionRate ?? null,
        description: input.description ?? null,
        privateMemo: input.privateMemo ?? null,
      },
    })
    return NextResponse.json(projectListing(created, me))
  } catch (err) {
    return errorResponse(err)
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const me = await requireAuth(req)
    const url = new URL(req.url)
    const query = listingQuerySchema.parse(Object.fromEntries(url.searchParams))

    const where = {
      agencyId: me.agencyId,
      ...(query.dealType && { dealType: query.dealType }),
      ...(query.status && { status: query.status }),
      ...(query.q && {
        OR: [
          { title: { contains: query.q } },
          { address: { contains: query.q } },
          { complexName: { contains: query.q } },
        ],
      }),
    }

    const [total, rows] = await Promise.all([
      prisma.internalListing.count({ where }),
      prisma.internalListing.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ])

    return NextResponse.json({
      data: rows.map((r) => projectListing(r, me)),
      total,
      page: query.page,
      limit: query.limit,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
