'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/common/Button'
import { apiFetch } from '@/lib/api-client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null); setLoading(true)
    try {
      await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      router.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 실패')
    } finally {
      setLoading(false)
    }
  }

  const input = 'w-full px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="hud-card hud-card-bottom rounded-lg p-8 w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-hud-accent-primary text-center">로그인</h1>
        <div>
          <label className="block text-xs text-hud-text-muted mb-1">이메일</label>
          <input type="email" required className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-hud-text-muted mb-1">비밀번호</label>
          <input type="password" required className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-hud-accent-danger">{error}</p>}
        <Button variant="primary" type="submit" fullWidth glow disabled={loading}>
          {loading ? '로그인 중...' : '로그인'}
        </Button>
        <p className="text-center text-sm text-hud-text-muted">
          계정이 없으세요?{' '}
          <Link href="/signup" className="text-hud-accent-primary hover:underline">가입하기</Link>
        </p>
      </form>
    </div>
  )
}
