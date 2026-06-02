'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/common/Button'
import { apiFetch } from '@/lib/api-client'

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    agencyName: '', name: '', email: '', password: '', phone: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null); setLoading(true)
    try {
      await apiFetch('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          agency: { name: form.agencyName },
          owner: { name: form.name, email: form.email, password: form.password, phone: form.phone || undefined },
        }),
      })
      router.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : '가입 실패')
    } finally {
      setLoading(false)
    }
  }

  const input = 'w-full px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="hud-card hud-card-bottom rounded-lg p-8 w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-hud-accent-primary text-center">사무소 가입</h1>
        <div>
          <label className="block text-xs text-hud-text-muted mb-1">사무소 이름 *</label>
          <input required className={input} value={form.agencyName} onChange={(e) => set('agencyName', e.target.value)} />
        </div>
        <div className="border-t border-hud-border-secondary pt-4">
          <p className="text-xs text-hud-text-muted mb-3">대표 계정</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-hud-text-muted mb-1">이름 *</label>
              <input required className={input} value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-hud-text-muted mb-1">이메일 *</label>
              <input type="email" required className={input} value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-hud-text-muted mb-1">비밀번호 (8자 이상) *</label>
              <input type="password" required minLength={8} className={input} value={form.password} onChange={(e) => set('password', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-hud-text-muted mb-1">전화 (선택)</label>
              <input className={input} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="010-0000-0000" />
            </div>
          </div>
        </div>
        {error && <p className="text-sm text-hud-accent-danger">{error}</p>}
        <Button variant="primary" type="submit" fullWidth glow disabled={loading}>
          {loading ? '가입 중...' : '가입하기'}
        </Button>
        <p className="text-center text-sm text-hud-text-muted">
          이미 계정이 있으세요?{' '}
          <Link href="/login" className="text-hud-accent-primary hover:underline">로그인</Link>
        </p>
      </form>
    </div>
  )
}
