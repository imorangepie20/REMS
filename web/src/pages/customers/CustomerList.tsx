import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Users, Plus, Search } from 'lucide-react'
import Button from '../../components/common/Button'
import { listCustomers, type CustomerQuery } from '../../api/customers'

const typeLabels: Record<string, string> = {
  buyer: '매수',
  seller: '매도',
  tenant: '임차',
  landlord: '임대',
}
const typeBadgeColors: Record<string, string> = {
  buyer: 'bg-hud-accent-info/20 text-hud-accent-info',
  seller: 'bg-hud-accent-primary/20 text-hud-accent-primary',
  tenant: 'bg-hud-accent-secondary/20 text-hud-accent-secondary',
  landlord: 'bg-hud-accent-warning/20 text-hud-accent-warning',
}

function fmt(n: number | null): string {
  if (n == null) return '-'
  return n.toLocaleString() + '원'
}

export default function CustomerList() {
  const [filter, setFilter] = useState<CustomerQuery>({})
  const { data, isLoading } = useQuery({
    queryKey: ['customers', filter],
    queryFn: () => listCustomers(filter),
  })
  const customers = data?.data ?? []

  return (
    <div className="p-6 text-hud-text-primary">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users size={24} className="text-hud-accent-primary" />
          <h1 className="text-2xl font-bold">고객</h1>
          <span className="text-hud-text-muted text-sm">{data?.total ?? 0}명</span>
        </div>
        <Link to="/customers/new">
          <Button variant="primary" glow leftIcon={<Plus size={16} />}>
            고객 등록
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className="px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
          value={filter.customerType ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, customerType: e.target.value || undefined }))}
        >
          <option value="">유형 전체</option>
          <option value="buyer">매수</option>
          <option value="seller">매도</option>
          <option value="tenant">임차</option>
          <option value="landlord">임대</option>
        </select>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-text-muted" size={16} />
          <input
            className="w-full pl-10 pr-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
            placeholder="이름·전화·희망지역"
            value={filter.q ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value || undefined }))}
          />
        </div>
      </div>

      <div className="hud-card rounded-lg overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-hud-text-muted">불러오는 중...</p>
        ) : customers.length === 0 ? (
          <p className="p-6 text-hud-text-muted">고객이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-hud-bg-secondary border-b border-hud-border-secondary">
              <tr className="text-left text-hud-text-secondary">
                <th className="px-4 py-3 font-medium">이름</th>
                <th className="px-4 py-3 font-medium">유형</th>
                <th className="px-4 py-3 font-medium">전화</th>
                <th className="px-4 py-3 font-medium">예산</th>
                <th className="px-4 py-3 font-medium">희망 지역</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hud-border-secondary">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-hud-bg-hover transition-hud">
                  <td className="px-4 py-3">
                    <Link to={`/customers/${c.id}`} className="text-hud-accent-primary hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${typeBadgeColors[c.customerType]}`}>
                      {typeLabels[c.customerType]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-hud-text-secondary">{c.phone ?? '-'}</td>
                  <td className="px-4 py-3 text-hud-text-secondary">
                    {fmt(c.budgetMin)} ~ {fmt(c.budgetMax)}
                  </td>
                  <td className="px-4 py-3 text-hud-text-secondary">{c.desiredArea ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
