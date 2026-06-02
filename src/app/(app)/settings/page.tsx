'use client'

import { useState } from 'react'
import { Building2, User, KeyRound, Users, Palette } from 'lucide-react'

const SECTIONS = [
  { key: 'agency', label: '사무소 정보', icon: Building2 },
  { key: 'account', label: '내 계정', icon: User },
  { key: 'password', label: '비밀번호 변경', icon: KeyRound },
  { key: 'agents', label: '중개사 관리', icon: Users, ownerOnly: true },
  { key: 'appearance', label: '외관', icon: Palette },
] as const

type SectionKey = typeof SECTIONS[number]['key']

export default function SettingsPage() {
  const [current, setCurrent] = useState<SectionKey>('agency')

  return (
    <div className="flex min-h-full">
      <nav className="w-56 border-r border-hud-border-secondary p-4 space-y-1">
        <h2 className="text-sm font-semibold text-hud-text-primary mb-3 px-2">설정</h2>
        {SECTIONS.map((s) => {
          const Icon = s.icon
          const active = s.key === current
          return (
            <button
              key={s.key}
              onClick={() => setCurrent(s.key)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-hud
                ${active
                  ? 'bg-hud-accent-primary/20 text-hud-accent-primary'
                  : 'text-hud-text-secondary hover:bg-hud-bg-hover hover:text-hud-text-primary'}`}
            >
              <Icon size={16} />
              {s.label}
            </button>
          )
        })}
      </nav>

      <div className="flex-1 p-6">
        {current === 'agency' && <p className="text-hud-text-muted">사무소 정보 (Task 22에서 구현)</p>}
        {current === 'account' && <p className="text-hud-text-muted">내 계정 (Task 22에서 구현)</p>}
        {current === 'password' && <p className="text-hud-text-muted">비밀번호 변경 (Task 22에서 구현)</p>}
        {current === 'agents' && <p className="text-hud-text-muted">중개사 관리 (Task 23에서 구현)</p>}
        {current === 'appearance' && <p className="text-hud-text-muted">외관 설정은 후속 작업에서 추가됩니다.</p>}
      </div>
    </div>
  )
}
