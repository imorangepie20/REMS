import { NextResponse } from 'next/server'
import { searchRegions } from '@/lib/regions-data'
import { errorResponse, requireAuth } from '@/lib/auth-helpers'

export async function GET(req: Request): Promise<NextResponse> {
  try {
    await requireAuth(req)
    const url = new URL(req.url)
    const q = url.searchParams.get('q') ?? ''
    const regions = searchRegions(q)
    return NextResponse.json({ regions })
  } catch (err) {
    return errorResponse(err)
  }
}
