import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { changePasswordSchema } from '@/lib/validators'
import { hashPassword, verifyPassword } from '@/lib/password'
import { requireAuth, errorResponse } from '@/lib/auth-helpers'
import { AuthError } from '@/lib/errors'

export async function PATCH(req: Request): Promise<NextResponse> {
  try {
    const me = await requireAuth(req)
    const { current, next } = changePasswordSchema.parse(await req.json())

    const agent = await prisma.agent.findUnique({ where: { id: me.id } })
    if (!agent) throw new AuthError()
    const ok = await verifyPassword(current, agent.passwordHash)
    if (!ok) throw new AuthError('현재 비밀번호가 올바르지 않습니다')

    const nextHash = await hashPassword(next)
    await prisma.agent.update({ where: { id: me.id }, data: { passwordHash: nextHash } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
