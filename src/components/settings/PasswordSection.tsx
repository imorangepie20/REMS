'use client'

import { useState, type FormEvent } from 'react'
import Button from '@/components/common/Button'
import { apiFetch } from '@/lib/api-client'

const input = 'w-full px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'

export default function PasswordSection() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null); setSuccess(false)
    if (next !== confirm) {
      setError('새 비밀번호 확인이 일치하지 않습니다')
      return
    }
    setSaving(true)
    try {
      await apiFetch('/auth/password', {
        method: 'PATCH',
        body: JSON.stringify({ current, next }),
      })
      setCurrent(''); setNext(''); setConfirm('')
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      <h2 className="text-lg font-semibold text-hud-text-primary">비밀번호 변경</h2>
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">현재 비밀번호</label>
        <input type="password" required className={input} value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">새 비밀번호 (8자 이상)</label>
        <input type="password" required minLength={8} className={input} value={next} onChange={(e) => setNext(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">새 비밀번호 확인</label>
        <input type="password" required minLength={8} className={input} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && <p className="text-sm text-hud-accent-danger">{error}</p>}
      {success && <p className="text-sm text-hud-accent-success">변경되었습니다.</p>}
      <Button variant="primary" type="submit" disabled={saving}>{saving ? '저장 중...' : '변경'}</Button>
    </form>
  )
}
