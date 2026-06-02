'use client'

import {
  tradeTypeCodes, tradeTypeLabel,
  realEstateTypeCodes, realEstateTypeLabel,
} from '@/lib/naver-codes'
import type { TradeTypeCode, RealEstateTypeCode } from '@/lib/naver-types'

interface Props {
  tradeTypes: TradeTypeCode[]
  onTradeChange: (next: TradeTypeCode[]) => void
  realEstateTypes: RealEstateTypeCode[]
  onRealEstateChange: (next: RealEstateTypeCode[]) => void
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
}

export function FilterBar({ tradeTypes, onTradeChange, realEstateTypes, onRealEstateChange }: Props) {
  return (
    <div className="flex flex-wrap gap-4">
      <FilterGroup label="거래유형">
        {tradeTypeCodes.map((code) => (
          <ToggleChip
            key={code}
            active={tradeTypes.includes(code)}
            onClick={() => {
              const next = toggle(tradeTypes, code)
              if (next.length === 0) return  // 최소 1개 유지
              onTradeChange(next)
            }}
          >{tradeTypeLabel(code)}</ToggleChip>
        ))}
      </FilterGroup>
      <FilterGroup label="매물종류">
        {realEstateTypeCodes.map((code) => (
          <ToggleChip
            key={code}
            active={realEstateTypes.includes(code)}
            onClick={() => {
              const next = toggle(realEstateTypes, code)
              if (next.length === 0) return
              onRealEstateChange(next)
            }}
          >{realEstateTypeLabel(code)}</ToggleChip>
        ))}
      </FilterGroup>
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-hud-text-muted mr-1">{label}</span>
      {children}
    </div>
  )
}

function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded text-xs transition-hud border ${
        active
          ? 'bg-hud-accent-primary/20 border-hud-accent-primary text-hud-accent-primary'
          : 'bg-hud-bg-secondary border-hud-border-secondary text-hud-text-secondary hover:border-hud-accent-primary/50'
      }`}
    >{children}</button>
  )
}
