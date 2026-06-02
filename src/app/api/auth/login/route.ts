import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { loginSchema } from '@/lib/validators'
import { verifyPassword } from '@/lib/password'
import { createSession, setSessionCookie } from '@/lib/session'
import { AuthError } from '@/lib/errors'
import { errorResponse } from '@/lib/auth-helpers'

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const json = await req.json()
    const { email, password } = loginSchema.parse(json)

    const agent = await prisma.agent.findUnique({ where: { email } })
    if (!agent) throw new AuthError('이메일 또는 비밀번호가 잘못되었습니다')
    if (agent.status !== 'active') throw new AuthError('계정이 비활성화되었습니다')
    const ok = await verifyPassword(password, agent.passwordHash)
    if (!ok) throw new AuthError('이메일 또는 비밀번호가 잘못되었습니다')

    const token = await createSession(agent.id)
    const res = NextResponse.json({
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
