'use client'

import { useAuth } from '@/auth/AuthContext'
import { LogOut } from 'lucide-react'

export function TopBar() {
  const { me, logout } = useAuth()
  if (!me) return null
  return (
    <header className="h-14 bg-hud-bg-secondary border-b border-hud-border-secondary px-6 flex items-center justify-between">
      <div className="text-sm text-hud-text-muted">
        {me.agency?.name ?? '사무소 없음'}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-hud-text-secondary">{me.agent.name} · {me.agent.role}</span>
        <button
          onClick={logout}
          className="text-hud-text-muted hover:text-hud-accent-danger transition-hud"
          aria-label="로그아웃"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
