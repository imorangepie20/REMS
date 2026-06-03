/**
 * Dev/시연용 기본 계정을 만든다 (idempotent — 이미 존재하면 갱신).
 * 사용: `npm run seed`
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const DEFAULT_AGENCY = 'Dev사무소'
const DEFAULT_EMAIL = 'dev@example.com'
const DEFAULT_PASSWORD = 'pw12345678'
const DEFAULT_NAME = '관리자'

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)

  const existing = await prisma.agent.findUnique({ where: { email: DEFAULT_EMAIL } })

  if (existing) {
    await prisma.agent.update({
      where: { id: existing.id },
      data: { passwordHash, name: DEFAULT_NAME, role: 'owner', status: 'active' },
    })
    console.log(`✓ 기존 계정 갱신: ${DEFAULT_EMAIL} (agency #${existing.agencyId})`)
    return
  }

  const agency = await prisma.agency.create({ data: { name: DEFAULT_AGENCY } })
  const agent = await prisma.agent.create({
    data: {
      agencyId: agency.id,
      email: DEFAULT_EMAIL,
      name: DEFAULT_NAME,
      passwordHash,
      role: 'owner',
    },
  })
  console.log(`✓ 신규 생성: agency #${agency.id} (${agency.name}) + owner #${agent.id} (${agent.email})`)
  console.log(`  로그인: ${DEFAULT_EMAIL} / ${DEFAULT_PASSWORD}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
