'use client'

import { useState, type FormEvent } from 'react'
import Button from '@/components/common/Button'
import { apiFetch } from '@/lib/api-client'
import { useAuth } from '@/auth/AuthContext'

const input = 'w-full px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'

export default function AccountSection() {
  const { me, refresh } = useAuth()
  const [name, setName] = useState(me?.agent.name ?? '')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!me) return null

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null); setSuccess(false); setSaving(true)
    try {
      await apiFetch(`/agents/${me.agent.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, phone: phone || null }),
      })
      setSuccess(true)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      <h2 className="text-lg font-semibold text-hud-text-primary">내 계정</h2>
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">이메일 (변경 불가)</label>
        <input className={input + ' opacity-60'} value={me.agent.email} disabled />
      </div>
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">이름</label>
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">전화</label>
        <input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      {error && <p className="text-sm text-hud-accent-danger">{error}</p>}
      {success && <p className="text-sm text-hud-accent-success">저장되었습니다.</p>}
      <Button variant="primary" type="submit" disabled={saving}>{saving ? '저장 중...' : '저장'}</Button>
    </form>
  )
}
