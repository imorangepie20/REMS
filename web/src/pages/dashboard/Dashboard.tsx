import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Building, Users, CheckCircle2, Sparkles } from 'lucide-react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import StatCard from '../../components/common/StatCard'
import { getDashboardSummary } from '../../api/admin'
import { useAuth } from '../../auth/AuthContext'

ChartJS.register(ArcElement, Tooltip, Legend)

const statusLabels: Record<string, string> = {
  suggested: '추천', interested: '관심', visited: '임장', contracted: '계약', rejected: '보류',
}

export default function Dashboard() {
  const { agent } = useAuth()
  const isOwner = agent?.role === 'owner'
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary,
  })

  if (isLoading || !data) {
    return <div className="p-6 text-hud-text-muted">불러오는 중...</div>
  }

  const matchTotal = Object.values(data.matches.byStatus).reduce((a, b) => a + b, 0)

  const chartData = {
    labels: Object.keys(data.matches.byStatus).map((k) => statusLabels[k]),
    datasets: [
      {
        data: Object.values(data.matches.byStatus),
        backgroundColor: [
          'rgba(148, 163, 184, 0.6)',
          'rgba(59, 130, 246, 0.6)',
          'rgba(245, 158, 11, 0.6)',
          'rgba(34, 197, 94, 0.6)',
          'rgba(100, 116, 139, 0.4)',
        ],
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
      },
    ],
  }

  return (
    <div className="p-6 text-hud-text-primary space-y-6">
      <h1 className="text-2xl font-bold">대시보드</h1>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="거래중 매물"
          value={data.listings.active}
          icon={<Building size={20} />}
          variant="primary"
        />
        <StatCard
          title="거래완료"
          value={data.listings.completed}
          icon={<CheckCircle2 size={20} />}
          variant="secondary"
        />
        <StatCard
          title="내 고객"
          value={data.customers.mine}
          icon={<Users size={20} />}
          variant="default"
        />
        <StatCard
          title={isOwner ? '사무소 전체 고객' : '진행 중 매칭'}
          value={isOwner
            ? data.customers.agency
            : data.matches.byStatus.interested + data.matches.byStatus.visited}
          icon={<Sparkles size={20} />}
          variant="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="hud-card rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">매칭 상태 분포</h2>
          {matchTotal === 0 ? (
            <p className="text-hud-text-muted text-sm">매칭이 아직 없습니다.</p>
          ) : (
            <div className="max-w-xs mx-auto">
              <Doughnut data={chartData} options={{ plugins: { legend: { position: 'bottom', labels: { color: 'rgba(255,255,255,0.7)' } } } }} />
            </div>
          )}
        </div>

        <div className="hud-card rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">최근 매칭</h2>
          {data.matches.recent.length === 0 ? (
            <p className="text-hud-text-muted text-sm">최근 매칭이 없습니다.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.matches.recent.map((m) => (
                <li key={m.id} className="flex items-center justify-between border-b border-hud-border-secondary pb-2 last:border-0">
                  <div>
                    <Link to="/customers" className="text-hud-accent-primary hover:underline">{m.customerName}</Link>
                    <span className="text-hud-text-muted"> → </span>
                    <span>{m.listingTitle}</span>
                  </div>
                  <span className="text-xs text-hud-text-muted">{statusLabels[m.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
