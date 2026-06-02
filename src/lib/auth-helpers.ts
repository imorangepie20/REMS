import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getSessionAgent, type SessionAgent } from './session'
import { AuthError, ForbiddenError, ConflictError, NotFoundError } from './errors'

export async function requireAuth(req: Request): Promise<SessionAgent> {
  const agent = await getSessionAgent(req)
  if (!agent) throw new AuthError()
  return agent
}

export async function requireOwner(req: Request): Promise<SessionAgent> {
  const agent = await requireAuth(req)
  if (agent.role !== 'owner') throw new ForbiddenError('owner 권한이 필요합니다')
  return agent
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: 'VALIDATION', message: '입력값이 올바르지 않습니다', details: err.issues } },
      { status: 400 },
    )
  }
  if (err instanceof AuthError) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: err.message } }, { status: 401 })
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: err.message } }, { status: 403 })
  }
  if (err instanceof NotFoundError) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: err.message } }, { status: 404 })
  }
  if (err instanceof ConflictError) {
    return NextResponse.json({ error: { code: 'CONFLICT', message: err.message } }, { status: 409 })
  }
  console.error(err)
  return NextResponse.json({ error: { code: 'INTERNAL', message: '서버 오류' } }, { status: 500 })
}
