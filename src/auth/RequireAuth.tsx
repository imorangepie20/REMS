'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthContext'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !me) router.replace('/login')
  }, [loading, me, router])

  if (loading) {
    return <div className="p-12 text-hud-text-muted">로딩 중...</div>
  }
  if (!me) return null
  return <>{children}</>
}
