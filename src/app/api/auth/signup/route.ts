import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { signupSchema } from '@/lib/validators'
import { hashPassword } from '@/lib/password'
import { createSession, setSessionCookie } from '@/lib/session'
import { ConflictError } from '@/lib/errors'
import { errorResponse } from '@/lib/auth-helpers'

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const json = await req.json()
    const input = signupSchema.parse(json)

    const existing = await prisma.agent.findUnique({ where: { email: input.owner.email } })
    if (existing) throw new ConflictError('이미 가입된 이메일입니다')

    const passwordHash = await hashPassword(input.owner.password)

    const { agency, agent } = await prisma.$transaction(async (tx) => {
      const agency = await tx.agency.create({ data: { name: input.agency.name } })
      const agent = await tx.agent.create({
        data: {
          agencyId: agency.id,
          email: input.owner.email,
          name: input.owner.name,
          phone: input.owner.phone ?? null,
          passwordHash,
          role: 'owner',
        },
      })
      return { agency, agent }
    })

    const token = await createSession(agent.id)
    const res = NextResponse.json({
      agency: { id: agency.id, name: agency.name },
      agent: {
        id: agent.id,
        email: agent.email,
        name: agent.name,
        role: agent.role,
        agencyId: agent.agencyId,
      },
    })
    return setSessionCookie(res, token)
  } catch (err) {
    return errorResponse(err)
  }
}
