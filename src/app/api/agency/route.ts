import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { updateAgencySchema } from '@/lib/validators'
import { requireOwner, errorResponse } from '@/lib/auth-helpers'

export async function PATCH(req: Request): Promise<NextResponse> {
  try {
    const me = await requireOwner(req)
    const data = updateAgencySchema.parse(await req.json())
    const updated = await prisma.agency.update({ where: { id: me.agencyId }, data })
    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      businessNumber: updated.businessNumber,
      phone: updated.phone,
      address: updated.address,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
