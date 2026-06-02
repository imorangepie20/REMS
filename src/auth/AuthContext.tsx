'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiFetch } from '@/lib/api-client'

export interface Me {
  agent: { id: number; email: string; name: string; role: 'owner' | 'member'; agencyId: number }
  agency: { id: number; name: string } | null
}

interface AuthContextValue {
  me: Me | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      const data = await apiFetch<Me>('/auth/me')
      setMe(data)
    } catch {
      setMe(null)
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try { await apiFetch<{ ok: true }>('/auth/logout', { method: 'POST' }) } catch {}
    setMe(null)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    refresh()
  }, [])

  return (
    <AuthContext.Provider value={{ me, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
