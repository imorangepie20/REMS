import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAgentSchema } from '@/lib/validators'
import { hashPassword } from '@/lib/password'
import { requireAuth, requireOwner, errorResponse } from '@/lib/auth-helpers'
import { ConflictError } from '@/lib/errors'

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const me = await requireAuth(req)
    const agents = await prisma.agent.findMany({
      where: { agencyId: me.agencyId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, email: true, name: true, phone: true,
        role: true, status: true, createdAt: true,
      },
    })
    return NextResponse.json(agents)
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const me = await requireOwner(req)
    const input = createAgentSchema.parse(await req.json())

    const existing = await prisma.agent.findUnique({ where: { email: input.email } })
    if (existing) throw new ConflictError('이미 가입된 이메일입니다')

    const passwordHash = await hashPassword(input.password)
    const agent = await prisma.agent.create({
      data: {
        agencyId: me.agencyId,
        email: input.email,
        name: input.name,
        phone: input.phone ?? null,
        passwordHash,
        role: 'member',
      },
      select: {
        id: true, email: true, name: true, phone: true,
        role: true, status: true, createdAt: true,
      },
    })
    return NextResponse.json(agent)
  } catch (err) {
    return errorResponse(err)
  }
}
