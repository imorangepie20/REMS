'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Map, Building, Settings } from 'lucide-react'

const NAV = [
  { href: '/', label: '대시보드', icon: LayoutDashboard },
  { href: '/explore', label: '탐색', icon: Map },
  { href: '/listings', label: '내부 매물', icon: Building },
  { href: '/settings', label: '설정', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-56 bg-hud-bg-secondary border-r border-hud-border-secondary p-4 flex flex-col gap-1">
      <div className="text-hud-accent-primary font-bold text-lg mb-4 px-2">Land Explorer</div>
      {NAV.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-hud
              ${active
                ? 'bg-hud-accent-primary/20 text-hud-accent-primary'
                : 'text-hud-text-secondary hover:bg-hud-bg-hover hover:text-hud-text-primary'}`}
          >
            <Icon size={16} />
            {item.label}
          </Link>
        )
      })}
    </aside>
  )
}
