import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, errorResponse } from '@/lib/auth-helpers'
import { NotFoundError } from '@/lib/errors'
import { projectListing } from '@/lib/listing-helpers'

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
