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
  ctx: { params: Promise<{ id: string; cid: string }> },
): Promise<NextResponse> {
  try {
    const me = await requireAuth(req)
    const { id, cid } = await ctx.params
    const listingId = Number(id)
    const contractId = Number(cid)
    if (!Number.isFinite(listingId) || !Number.isFinite(contractId)) {
      throw new NotFoundError('없는 계약서입니다')
    }

    const contract = await prisma.listingContract.findUnique({
      where: { id: contractId },
      include: { listing: true },
    })
    if (!contract || contract.listingId !== listingId || contract.listing.agencyId !== me.agencyId) {
      throw new NotFoundError('없는 계약서입니다')
    }
    if (!canWriteListing(contract.listing, me)) {
      throw new ForbiddenError('본인 매물 또는 owner만 계약서를 삭제할 수 있습니다')
    }

    await prisma.listingContract.delete({ where: { id: contractId } })
    await deleteUpload(uploadsBaseDir(), contract.url)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
