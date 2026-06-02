'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building, Plus } from 'lucide-react'
import Button from '@/components/common/Button'
import { ListingFilters } from '@/components/listings/ListingFilters'
import { ListingTable } from '@/components/listings/ListingTable'
import { listListings, type ListingsQuery, type ListingsResponse } from '@/lib/api/listings'

export default function ListingsPage() {
  const [query, setQuery] = useState<ListingsQuery>({ page: 1, limit: 20 })
  const [data, setData] = useState<ListingsResponse>({ data: [], total: 0, page: 1, limit: 20 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    listListings(query)
      .then((r) => { if (!cancelled) setData(r) })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [query])

  const change = (next: Partial<ListingsQuery>) => setQuery((q) => ({ ...q, ...next }))
  const totalPages = Math.max(1, Math.ceil(data.total / (query.limit ?? 20)))

  return (
    <div className="p-6 text-hud-text-primary">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building size={24} className="text-hud-accent-primary" />
          <h1 className="text-2xl font-bold">내부 매물</h1>
          <span className="text-hud-text-muted text-sm">{data.total}건</span>
        </div>
        <Link href="/listings/new">
          <Button variant="primary" glow leftIcon={<Plus size={16} />}>매물 등록</Button>
        </Link>
      </div>

      <div className="mb-4">
        <ListingFilters query={query} onChange={change} />
      </div>

      {error && <p className="text-sm text-hud-accent-danger mb-4">{error}</p>}

      <div className="hud-card rounded-lg overflow-hidden">
        <ListingTable rows={data.data} loading={loading} />
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            className="px-3 py-1 text-sm text-hud-text-secondary disabled:opacity-30"
            disabled={(query.page ?? 1) <= 1}
            onClick={() => change({ page: (query.page ?? 1) - 1 })}
          >이전</button>
          <span className="text-sm text-hud-text-muted">{query.page ?? 1} / {totalPages}</span>
          <button
            className="px-3 py-1 text-sm text-hud-text-secondary disabled:opacity-30"
            disabled={(query.page ?? 1) >= totalPages}
            onClick={() => change({ page: (query.page ?? 1) + 1 })}
          >다음</button>
        </div>
      )}
    </div>
  )
}
