import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { updateAgentSchema } from '@/lib/validators'
import { requireAuth, errorResponse } from '@/lib/auth-helpers'
import { ForbiddenError, NotFoundError } from '@/lib/errors'

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const me = await requireAuth(req)
    const { id } = await ctx.params
    const targetId = Number(id)
    if (!Number.isFinite(targetId)) throw new NotFoundError('없는 사용자입니다')

    const target = await prisma.agent.findUnique({ where: { id: targetId } })
    if (!target || target.agencyId !== me.agencyId) throw new NotFoundError('없는 사용자입니다')

    const input = updateAgentSchema.parse(await req.json())

    const wantsManageFields = input.role !== undefined || input.status !== undefined
    const isSelf = me.id === targetId
    const isOwner = me.role === 'owner'

    if (wantsManageFields) {
      if (!isOwner) throw new ForbiddenError('owner 권한이 필요합니다')
      if (isSelf) throw new ForbiddenError('자신의 role/status는 변경할 수 없습니다')
    } else {
      // 프로필(name/phone)만 수정 — 본인 또는 owner
      if (!isSelf && !isOwner) throw new ForbiddenError('타인의 정보는 owner만 수정할 수 있습니다')
    }

    const updated = await prisma.agent.update({
      where: { id: targetId },
      data: {
        name: input.name,
        phone: input.phone === undefined ? undefined : input.phone,
        role: input.role,
        status: input.status,
      },
      select: { id: true, email: true, name: true, phone: true, role: true, status: true, createdAt: true },
    })
    return NextResponse.json(updated)
  } catch (err) {
    return errorResponse(err)
  }
}
