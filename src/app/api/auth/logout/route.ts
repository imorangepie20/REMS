import { NextResponse } from 'next/server'
import { clearSessionCookie, destroySession, getSessionTokenFromRequest } from '@/lib/session'

export async function POST(req: Request): Promise<NextResponse> {
  const token = getSessionTokenFromRequest(req)
  if (token) {
    await destroySession(token)
  }
  const res = NextResponse.json({ ok: true })
  return clearSessionCookie(res)
}
