'use client'

import { Building, Users, Calendar } from 'lucide-react'
import type { NaverComplex } from '@/lib/naver-types'

interface Props {
  complexes: NaverComplex[]
  loading: boolean
  selectedComplex: string | null
  onSelect: (c: NaverComplex) => void
}

export function ComplexList({ complexes, loading, selectedComplex, onSelect }: Props) {
  return (
    <aside className="w-80 border-r border-hud-border-secondary overflow-auto">
      <div className="p-3 border-b border-hud-border-secondary text-xs text-hud-text-muted">
        단지 {loading ? '...' : complexes.length}곳
      </div>
      {loading ? (
        <p className="p-4 text-sm text-hud-text-muted">불러오는 중...</p>
      ) : complexes.length === 0 ? (
        <p className="p-4 text-sm text-hud-text-muted">표시할 단지가 없습니다.</p>
      ) : (
        <ul>
          {complexes.map((c) => {
            const active = c.complexNumber === selectedComplex
            return (
              <li key={c.complexNumber}>
                <button
                  type="button"
                  onClick={() => onSelect(c)}
                  className={`w-full text-left p-3 border-b border-hud-border-secondary transition-hud
                    ${active
                      ? 'bg-hud-accent-primary/10 border-l-2 border-l-hud-accent-primary'
                      : 'hover:bg-hud-bg-hover'}`}
                >
                  <div className="flex items-start gap-2">
                    <Building size={14} className="text-hud-accent-primary mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-hud-text-primary truncate">{c.complexName}</div>
                      <div className="text-xs text-hud-text-muted truncate">{c.address}</div>
                      <div className="flex gap-3 mt-1 text-xs text-hud-text-secondary">
                        {c.householdCount != null && (
                          <span className="flex items-center gap-1">
                            <Users size={10} />{c.householdCount.toLocaleString()}세대
                          </span>
                        )}
                        {c.builtYear != null && (
                          <span className="flex items-center gap-1">
                            <Calendar size={10} />{c.builtYear}년
                          </span>
                        )}
                        {c.totalArticleCount != null && c.totalArticleCount > 0 && (
                          <span className="text-hud-accent-primary">매물 {c.totalArticleCount}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
