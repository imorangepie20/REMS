'use client'

import { useTheme, THEMES, type ThemeName } from '@/theme/ThemeContext'
import { Check } from 'lucide-react'

export default function AppearanceSection() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-hud-text-primary mb-1">외관</h2>
        <p className="text-sm text-hud-text-muted">테마를 선택하면 즉시 반영되고, 다음 방문 시에도 유지됩니다.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {THEMES.map((t) => {
          const active = t.value === theme
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTheme(t.value as ThemeName)}
              className={`hud-card rounded-lg p-4 text-left transition-hud ${
                active
                  ? 'ring-2 ring-hud-accent-primary border-hud-accent-primary'
                  : 'hover:border-hud-accent-primary/50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-hud-text-primary">{t.label}</span>
                {active && <Check size={16} className="text-hud-accent-primary" />}
              </div>
              <ThemeSwatch theme={t.value} />
              <p className="text-xs text-hud-text-muted mt-3">{t.description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ThemeSwatch({ theme }: { theme: ThemeName }) {
  const palette = theme === 'hud'
    ? { bg: '#0a0e1a', card: '#1f2937', text: '#f1f5f9', accent: '#06b6d4' }
    : { bg: '#e5e7eb', card: '#ffffff', text: '#000000', accent: '#0891b2' }
  return (
    <div className="flex h-16 rounded overflow-hidden border border-hud-border-secondary">
      <div className="flex-1 flex items-center justify-center font-mono text-xs"
           style={{ background: palette.bg, color: palette.text }}>
        Aa
      </div>
      <div className="flex-1 flex items-center justify-center font-mono text-xs"
           style={{ background: palette.card, color: palette.text }}>
        카드
      </div>
      <div className="w-8" style={{ background: palette.accent }} />
    </div>
  )
}
