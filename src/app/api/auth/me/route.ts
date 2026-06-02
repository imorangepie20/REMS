import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, errorResponse } from '@/lib/auth-helpers'

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const agent = await requireAuth(req)
    const agency = await prisma.agency.findUnique({ where: { id: agent.agencyId } })
    return NextResponse.json({
      agent: {
        id: agent.id,
        email: agent.email,
        name: agent.name,
        role: agent.role,
        agencyId: agent.agencyId,
      },
      agency: agency ? { id: agency.id, name: agency.name } : null,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
