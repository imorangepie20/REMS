'use client'

import Link from 'next/link'
import type { ListingSummary } from '@/lib/api/listings'
import { formatPrice as formatPriceNumber } from '@/lib/naver-codes'

const dealLabels: Record<string, string> = { sale: '매매', jeonse: '전세', wolse: '월세' }
const dealColors: Record<string, string> = {
  sale: 'bg-hud-accent-primary/20 text-hud-accent-primary',
  jeonse: 'bg-hud-accent-info/20 text-hud-accent-info',
  wolse: 'bg-hud-accent-warning/20 text-hud-accent-warning',
}
const statusLabels: Record<string, string> = { active: '거래중', contracted: '거래완료', hidden: '숨김' }
const statusColors: Record<string, string> = {
  active: 'bg-hud-accent-success/20 text-hud-accent-success',
  contracted: 'bg-hud-bg-secondary text-hud-text-muted',
  hidden: 'bg-hud-bg-secondary text-hud-text-muted',
}

function formatPrice(won: string | null): string {
  if (won == null) return '-'
  const n = Number(won)
  if (!Number.isFinite(n)) return '-'
  return formatPriceNumber(n)
}

interface Props {
  rows: ListingSummary[]
  loading: boolean
}

export function ListingTable({ rows, loading }: Props) {
  if (loading) return <p className="p-6 text-hud-text-muted">불러오는 중...</p>
  if (rows.length === 0) return <p className="p-6 text-hud-text-muted">매물이 없습니다.</p>
  return (
    <table className="w-full text-sm">
      <thead className="bg-hud-bg-secondary border-b border-hud-border-secondary text-left text-hud-text-secondary">
        <tr>
          <th className="px-4 py-3 font-medium">제목</th>
          <th className="px-4 py-3 font-medium">거래</th>
          <th className="px-4 py-3 font-medium">가격</th>
          <th className="px-4 py-3 font-medium">면적</th>
          <th className="px-4 py-3 font-medium">상태</th>
          <th className="px-4 py-3 font-medium">주소</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-hud-border-secondary">
        {rows.map((r) => (
          <tr key={r.id} className="hover:bg-hud-bg-hover transition-hud">
            <td className="px-4 py-3">
              <Link href={`/listings/${r.id}`} className="text-hud-accent-primary hover:underline">
                {r.title}
              </Link>
              {r.complexName && <div className="text-xs text-hud-text-muted">{r.complexName}</div>}
            </td>
            <td className="px-4 py-3">
              <span className={`text-xs px-2 py-0.5 rounded ${dealColors[r.dealType]}`}>
                {dealLabels[r.dealType]}
              </span>
            </td>
            <td className="px-4 py-3 font-mono text-hud-text-primary">
              {r.dealType === 'sale' && formatPrice(r.salePrice)}
              {r.dealType === 'jeonse' && formatPrice(r.deposit)}
              {r.dealType === 'wolse' && `${formatPrice(r.deposit)} / 월 ${formatPrice(r.monthlyRent)}`}
            </td>
            <td className="px-4 py-3 text-hud-text-secondary">{r.areaM2}㎡</td>
            <td className="px-4 py-3">
              <span className={`text-xs px-2 py-0.5 rounded ${statusColors[r.status]}`}>
                {statusLabels[r.status]}
              </span>
            </td>
            <td className="px-4 py-3 text-hud-text-secondary truncate max-w-xs">{r.address}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
