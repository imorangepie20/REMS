'use client'

import { Search } from 'lucide-react'
import type { ListingsQuery } from '@/lib/api/listings'

interface Props {
  query: ListingsQuery
  onChange: (next: Partial<ListingsQuery>) => void
}

const input = 'px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'

export function ListingFilters({ query, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-text-muted" />
        <input
          className={`${input} pl-9 w-64`}
          placeholder="제목·주소·단지명 검색"
          value={query.q ?? ''}
          onChange={(e) => onChange({ q: e.target.value || undefined, page: 1 })}
        />
      </div>
      <select
        className={input}
        value={query.dealType ?? ''}
        onChange={(e) => onChange({ dealType: (e.target.value || undefined) as ListingsQuery['dealType'], page: 1 })}
      >
        <option value="">거래유형 전체</option>
        <option value="sale">매매</option>
        <option value="jeonse">전세</option>
        <option value="wolse">월세</option>
      </select>
      <select
        className={input}
        value={query.status ?? ''}
        onChange={(e) => onChange({ status: (e.target.value || undefined) as ListingsQuery['status'], page: 1 })}
      >
        <option value="">상태 전체</option>
        <option value="active">거래중</option>
        <option value="contracted">거래완료</option>
        <option value="hidden">숨김</option>
      </select>
    </div>
  )
}
