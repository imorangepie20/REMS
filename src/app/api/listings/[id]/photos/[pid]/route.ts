import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, errorResponse } from '@/lib/auth-helpers'
import { NotFoundError, ForbiddenError } from '@/lib/errors'
import { canWriteListing } from '@/lib/listing-helpers'
import { deleteUpload, UPLOADS_ROOT } from '@/lib/uploads'

function uploadsBaseDir(): string {
  return process.env.UPLOADS_BASE_DIR ?? UPLOADS_ROOT
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; pid: string }> },
): Promise<NextResponse> {
  try {
    const me = await requireAuth(req)
    const { id, pid } = await ctx.params
    const listingId = Number(id)
    const photoId = Number(pid)
    if (!Number.isFinite(listingId) || !Number.isFinite(photoId)) {
      throw new NotFoundError('없는 사진입니다')
    }

    const photo = await prisma.listingPhoto.findUnique({
      where: { id: photoId },
      include: { listing: true },
    })
    if (!photo || photo.listingId !== listingId || photo.listing.agencyId !== me.agencyId) {
      throw new NotFoundError('없는 사진입니다')
    }
    if (!canWriteListing(photo.listing, me)) {
      throw new ForbiddenError('본인 매물 또는 owner만 사진을 삭제할 수 있습니다')
    }

    await prisma.listingPhoto.delete({ where: { id: photoId } })
    await deleteUpload(uploadsBaseDir(), photo.url)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
