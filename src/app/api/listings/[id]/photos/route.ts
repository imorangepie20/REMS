import { NextResponse } from 'next/server'
import path from 'node:path'
import { prisma } from '@/lib/db'
import { requireAuth, errorResponse } from '@/lib/auth-helpers'
import { NotFoundError, ForbiddenError } from '@/lib/errors'
import { canWriteListing } from '@/lib/listing-helpers'
import { saveUpload, UPLOADS_ROOT } from '@/lib/uploads'

const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

function uploadsBaseDir(): string {
  return process.env.UPLOADS_BASE_DIR ?? UPLOADS_ROOT
}

export async function POST(
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
      throw new ForbiddenError('본인 매물 또는 owner만 사진을 추가할 수 있습니다')
    }

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: { code: 'VALIDATION', message: 'file 필드가 필요합니다' } }, { status: 400 })
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: { code: 'UNSUPPORTED_TYPE', message: 'jpg/png/webp만 허용됩니다' } }, { status: 415 })
    }
    const buf = Buffer.from(await file.arrayBuffer())
    if (buf.byteLength > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: { code: 'TOO_LARGE', message: '5MB 이하만 허용됩니다' } }, { status: 413 })
    }
    const caption = String(form.get('caption') ?? '')
    const originalName = file instanceof File ? file.name : 'photo.bin'

    const saved = await saveUpload({
      baseDir: uploadsBaseDir(),
      relativeDir: path.posix.join('listings', String(targetId), 'photos'),
      filename: originalName,
      data: buf,
    })

    const lastOrder = await prisma.listingPhoto.aggregate({
      where: { listingId: targetId },
      _max: { sortOrder: true },
    })
    const created = await prisma.listingPhoto.create({
      data: {
        listingId: targetId,
        url: saved.url,
        caption: caption || null,
        sortOrder: (lastOrder._max.sortOrder ?? -1) + 1,
      },
    })
    return NextResponse.json(created)
  } catch (err) {
    return errorResponse(err)
  }
}
