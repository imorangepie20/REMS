'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, Search, X } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import type { RegionEntry } from '@/lib/naver-types'

interface Props {
  selected: RegionEntry | null
  onSelect: (r: RegionEntry) => void
}

export function RegionPicker({ selected, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RegionEntry[]>([])
  const [loading, setLoading] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await apiFetch<{ regions: RegionEntry[] }>(`/naver/regions?q=${encodeURIComponent(query)}`)
        setResults(res.regions)
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => clearTimeout(t)
  }, [open, query])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary hover:border-hud-accent-primary transition-hud min-w-[180px]"
      >
        <MapPin size={16} className="text-hud-accent-primary" />
        {selected ? (
          <span className="truncate">
            {selected.sigungu} <span className="text-hud-text-muted">{selected.eup}</span>
          </span>
        ) : (
          <span className="text-hud-text-muted">지역 선택</span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-80 hud-card rounded-lg shadow-hud z-50">
          <div className="p-3 border-b border-hud-border-secondary relative">
            <Search size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-hud-text-muted" />
            <input
              autoFocus
              className="w-full pl-7 pr-7 py-1.5 bg-hud-bg-primary border border-hud-border-secondary rounded text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary"
              placeholder="시군구 또는 동 검색..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-5 top-1/2 -translate-y-1/2 text-hud-text-muted hover:text-hud-text-primary">
                <X size={12} />
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-auto p-1">
            {loading ? (
              <p className="text-xs text-hud-text-muted p-3">검색 중...</p>
            ) : results.length === 0 ? (
              <p className="text-xs text-hud-text-muted p-3">결과 없음</p>
            ) : (
              results.map((r) => (
                <button
                  key={r.legalDivisionNumber}
                  onClick={() => { onSelect(r); setOpen(false); setQuery('') }}
                  className="w-full text-left px-3 py-2 rounded text-sm hover:bg-hud-bg-hover transition-hud"
                >
                  <div className="text-hud-text-primary">{r.sigungu} <span className="text-hud-accent-primary">{r.eup}</span></div>
                  <div className="text-xs text-hud-text-muted">{r.sido} · {r.legalDivisionNumber}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
