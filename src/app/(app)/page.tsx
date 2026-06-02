export default function Dashboard() {
  return (
    <div className="p-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-hud-accent-primary mb-4">대시보드</h1>
      <p className="text-hud-text-secondary mb-8">
        Phase 2 (Auth & Multi-tenancy) 진행 중. 통계·차트는 Phase 5에서 추가됩니다.
      </p>
      <div className="hud-card hud-card-bottom rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-2">진행 상태</h2>
        <ul className="text-sm text-hud-text-secondary space-y-1">
          <li>✓ Phase 1 Foundation</li>
          <li>· Phase 2 Auth (진행 중)</li>
          <li>· Phase 3 Naver Explore</li>
          <li>· Phase 4 Internal Listings</li>
          <li>· Phase 5 Export + Chart</li>
        </ul>
      </div>
    </div>
  )
}
