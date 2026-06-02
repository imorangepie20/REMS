'use client'

import { useState } from 'react'
import { Building2, User, KeyRound, Users, Palette } from 'lucide-react'
import AgencySection from '@/components/settings/AgencySection'
import AccountSection from '@/components/settings/AccountSection'
import PasswordSection from '@/components/settings/PasswordSection'
import AgentsSection from '@/components/settings/AgentsSection'
import AppearanceSection from '@/components/settings/AppearanceSection'

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
        {current === 'agency' && <AgencySection />}
        {current === 'account' && <AccountSection />}
        {current === 'password' && <PasswordSection />}
        {current === 'agents' && <AgentsSection />}
        {current === 'appearance' && <AppearanceSection />}
      </div>
    </div>
  )
}
