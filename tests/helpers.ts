import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/password'

export async function resetDb(): Promise<void> {
  // 외래키 의존 순서 역방향
  await prisma.listingContract.deleteMany()
  await prisma.listingPhoto.deleteMany()
  await prisma.internalListing.deleteMany()
  await prisma.session.deleteMany()
  await prisma.agent.deleteMany()
  await prisma.agency.deleteMany()
}

export interface SignupResult {
  agencyId: number
  agentId: number
  cookie: string  // "le_session=..." (테스트에서 fetch 헤더로 사용)
}

export async function signupAgent(
  fetcher: (req: Request) => Promise<Response>,
  overrides: Partial<{ agencyName: string; name: string; email: string; password: string }> = {},
): Promise<SignupResult> {
  const payload = {
    agency: { name: overrides.agencyName ?? '테스트사무소' },
    owner: {
      name: overrides.name ?? '홍길동',
      email: overrides.email ?? `test-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`,
      password: overrides.password ?? 'pw12345678',
    },
  }
  const res = await fetcher(new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }))
  if (res.status !== 200) {
    throw new Error(`signup failed: ${res.status} ${await res.text()}`)
  }
  const body = await res.json()
  const setCookie = res.headers.get('set-cookie') ?? ''
  // "le_session=...; Path=/; HttpOnly; ..." → "le_session=..."
  const match = setCookie.match(/le_session=[^;]+/)
  if (!match) throw new Error(`no session cookie in: ${setCookie}`)
  return { agencyId: body.agency.id, agentId: body.agent.id, cookie: match[0] }
}

export async function addMember(agencyId: number, overrides: Partial<{ name: string; email: string; password: string }> = {}): Promise<{ id: number; email: string; password: string }> {
  const email = overrides.email ?? `member-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
  const password = overrides.password ?? 'member1234'
  const agent = await prisma.agent.create({
    data: {
      agencyId,
      name: overrides.name ?? '멤버',
      email,
      passwordHash: await hashPassword(password),
      role: 'member',
    },
  })
  return { id: agent.id, email, password }
}
