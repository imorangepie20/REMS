import { randomBytes } from 'node:crypto'
import type { NextResponse } from 'next/server'
import { prisma } from './db'

export const SESSION_COOKIE = 'le_session'
const SESSION_TTL_DAYS = 30
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

export async function createSession(agentId: number): Promise<string> {
  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await prisma.session.create({ data: { agentId, token, expiresAt } })
  return token
}

export function setSessionCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  })
  return res
}

export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}

export function getSessionTokenFromRequest(req: Request): string | null {
  const cookie = req.headers.get('cookie') ?? ''
  const m = cookie.match(/(?:^|;\s*)le_session=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

export interface SessionAgent {
  id: number
  agencyId: number
  email: string
  name: string
  role: 'owner' | 'member'
  status: 'active' | 'suspended'
}

export async function getSessionAgent(req: Request): Promise<SessionAgent | null> {
  const token = getSessionTokenFromRequest(req)
  if (!token) return null
  const session = await prisma.session.findUnique({
    where: { token },
    include: { agent: true },
  })
  if (!session) return null
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }
  if (session.agent.status !== 'active') return null
  const a = session.agent
  return {
    id: a.id,
    agencyId: a.agencyId,
    email: a.email,
    name: a.name,
    role: a.role,
    status: a.status,
  }
}

export async function destroySession(token: string): Promise<void> {
  await prisma.session.delete({ where: { token } }).catch(() => {})
}
