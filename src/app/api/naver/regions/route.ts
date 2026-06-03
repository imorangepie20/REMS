import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { searchRegions as searchInMemory } from '@/lib/regions-data'
import { errorResponse, requireAuth } from '@/lib/auth-helpers'
import type { RegionEntry } from '@/lib/naver-types'

const LIMIT = 20

export async function GET(req: Request): Promise<NextResponse> {
  try {
    await requireAuth(req)
    const url = new URL(req.url)
    const q = (url.searchParams.get('q') ?? '').trim()

    // DB에 데이터 있으면 DB에서, 없으면 in-memory fallback (큐레이트 22동)
    const dbCount = await prisma.region.count()
    if (dbCount === 0) {
      return NextResponse.json({ regions: searchInMemory(q) })
    }

    const where = q
      ? {
          OR: [
            { sido: { contains: q } },
            { sigungu: { contains: q } },
            { eup: { contains: q } },
            { code: { contains: q } },
          ],
        }
      : {}

    const rows = await prisma.region.findMany({
      where,
      orderBy: [{ sido: 'asc' }, { sigungu: 'asc' }, { eup: 'asc' }],
      take: LIMIT,
    })

    const regions: RegionEntry[] = rows.map((r) => ({
      legalDivisionNumber: r.code,
      sido: r.sido,
      sigungu: r.sigungu,
      eup: r.eup,
      centerLat: r.latitude,
      centerLng: r.longitude,
    }))

    return NextResponse.json({ regions })
  } catch (err) {
    return errorResponse(err)
  }
}
