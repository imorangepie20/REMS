'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-client'
import { tradeTypeLabel, formatPrice } from '@/lib/naver-codes'
import type {
  NaverArticle, ArticlesResponse, TradeTypeCode,
} from '@/lib/naver-types'

interface Props {
  complexNumber: string
  tradeTypes: TradeTypeCode[]
}

export function ArticleTable({ complexNumber, tradeTypes }: Props) {
  const [articles, setArticles] = useState<NaverArticle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    apiFetch<ArticlesResponse>('/naver/articles', {
      method: 'POST',
      body: JSON.stringify({ complexNumber, tradeTypes }),
    })
      .then((r) => { if (!cancelled) setArticles(r.articles) })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [complexNumber, tradeTypes.join(',')])

  return (
    <div className="border-t border-hud-border-secondary max-h-[40vh] overflow-auto">
      <div className="px-4 py-2 border-b border-hud-border-secondary bg-hud-bg-secondary text-xs text-hud-text-muted">
        매물 {loading ? '...' : articles.length}건
      </div>
      {error && <p className="p-3 text-sm text-hud-accent-danger">{error}</p>}
      {!loading && articles.length === 0 && !error ? (
        <p className="p-4 text-sm text-hud-text-muted">매물이 없습니다.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-hud-bg-secondary text-left text-xs text-hud-text-muted">
            <tr>
              <th className="px-3 py-1.5 font-medium">매물번호</th>
              <th className="px-3 py-1.5 font-medium">유형</th>
              <th className="px-3 py-1.5 font-medium">평형</th>
              <th className="px-3 py-1.5 font-medium">가격</th>
              <th className="px-3 py-1.5 font-medium">면적</th>
              <th className="px-3 py-1.5 font-medium">층</th>
              <th className="px-3 py-1.5 font-medium">향</th>
              <th className="px-3 py-1.5 font-medium">등록</th>
              <th className="px-3 py-1.5 font-medium">중개사</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hud-border-secondary">
            {articles.map((a) => (
              <tr key={a.articleNo} className="hover:bg-hud-bg-hover">
                <td className="px-3 py-1.5 font-mono text-xs text-hud-text-muted">{a.articleNo}</td>
                <td className="px-3 py-1.5">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-hud-accent-primary/20 text-hud-accent-primary">
                    {tradeTypeLabel(a.tradeType)}
                  </span>
                </td>
                <td className="px-3 py-1.5">{a.pyeongName ?? '-'}</td>
                <td className="px-3 py-1.5 font-mono text-hud-accent-primary">
                  {formatPrice(a.price)}
                  {a.monthlyRent != null && a.monthlyRent > 0 && (
                    <span className="text-hud-text-muted"> / 월 {formatPrice(a.monthlyRent)}</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-hud-text-secondary">{a.exclusiveArea ?? '-'}㎡</td>
                <td className="px-3 py-1.5 text-hud-text-secondary">{a.floor ?? '-'}</td>
                <td className="px-3 py-1.5 text-hud-text-secondary">{a.direction ?? '-'}</td>
                <td className="px-3 py-1.5 text-xs text-hud-text-muted">{a.registeredAt ?? '-'}</td>
                <td className="px-3 py-1.5 text-xs text-hud-text-muted">{a.brokerName ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
