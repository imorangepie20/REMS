export default function Home() {
  return (
    <main className="p-12 max-w-3xl mx-auto">
      <h1 className="text-4xl font-bold text-hud-accent-primary mb-4">
        Land Explorer
      </h1>
      <p className="text-hud-text-secondary mb-8">
        Phase 1 (Foundation) 셋업 완료. Phase 2부터 인증·도메인 모델이 추가됩니다.
      </p>
      <div className="hud-card hud-card-bottom rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-2">상태</h2>
        <ul className="text-sm text-hud-text-secondary space-y-1">
          <li>✓ Next.js 15 App Router</li>
          <li>✓ Tailwind + HUD 테마</li>
          <li>✓ Postgres 16 (Docker)</li>
          <li>✓ Prisma 5</li>
          <li>✓ Vitest</li>
        </ul>
      </div>
    </main>
  )
}
