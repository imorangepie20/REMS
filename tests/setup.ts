/**
 * Vitest setup — 매 테스트 프로세스 시작 시 1회 실행.
 *
 * 핵심: DATABASE_URL을 land_explorer_test로 강제하여 dev DB(land_explorer)와
 * 격리한다. 기존에는 같은 DB를 공유하여 resetDb()가 사용자 데이터까지
 * 지워버렸다.
 *
 * 테스트 DB는 docker compose로 같은 postgres 인스턴스 안에 만든다.
 * 한 번만 생성 (CREATE DATABASE는 멱등 처리).
 */
import { execSync } from 'node:child_process'

const TEST_DB_NAME = 'land_explorer_test'
const TEST_DB_URL = `postgresql://app:app@localhost:5432/${TEST_DB_NAME}?schema=public`

// 1) 테스트 DB가 없으면 생성 (docker exec로)
function ensureTestDb(): void {
  try {
    execSync(
      `docker compose exec -T db psql -U app -d postgres -c "SELECT 1 FROM pg_database WHERE datname='${TEST_DB_NAME}';" -t`,
      { stdio: ['ignore', 'pipe', 'ignore'] },
    )
    const exists = execSync(
      `docker compose exec -T db psql -U app -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${TEST_DB_NAME}';"`,
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim()
    if (exists !== '1') {
      execSync(
        `docker compose exec -T db psql -U app -d postgres -c 'CREATE DATABASE "${TEST_DB_NAME}";'`,
        { stdio: 'inherit' },
      )
    }
  } catch (e) {
    console.error('테스트 DB 생성 실패. docker compose가 떠 있는지 확인하세요.', e)
    throw e
  }
}

// 2) 테스트 DB에 schema 적용 (db push, 멱등)
function applySchema(): void {
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: ['ignore', 'pipe', 'ignore'],
  })
}

ensureTestDb()
applySchema()

// 3) 이후 prisma client가 import될 때 이 URL을 사용하도록 환경변수 교체
process.env.DATABASE_URL = TEST_DB_URL
