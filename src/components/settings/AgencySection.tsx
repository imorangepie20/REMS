'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Button from '@/components/common/Button'
import { apiFetch } from '@/lib/api-client'
import { useAuth } from '@/auth/AuthContext'

interface Agency {
  id: number
  name: string
  businessNumber: string | null
  phone: string | null
  address: string | null
}

const input = 'w-full px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'

export default function AgencySection() {
  const { me, refresh } = useAuth()
  const isOwner = me?.agent.role === 'owner'
  const [form, setForm] = useState({ name: '', businessNumber: '', phone: '', address: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // /me는 간단 필드만 — businessNumber/phone/address는 첫 PATCH 응답으로 채워짐
    if (me?.agency) setForm((f) => ({ ...f, name: me.agency!.name }))
    setLoading(false)
  }, [me])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null); setSuccess(false); setSaving(true)
    try {
      const updated = await apiFetch<Agency>('/agency', {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name,
          businessNumber: form.businessNumber || null,
          phone: form.phone || null,
          address: form.address || null,
        }),
      })
      setForm({
        name: updated.name,
        businessNumber: updated.businessNumber ?? '',
        phone: updated.phone ?? '',
        address: updated.address ?? '',
      })
      setSuccess(true)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-hud-text-muted">불러오는 중...</p>

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      <h2 className="text-lg font-semibold text-hud-text-primary">사무소 정보</h2>
      {!isOwner && <p className="text-sm text-hud-accent-warning">owner만 수정할 수 있습니다.</p>}
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">사무소 이름</label>
        <input className={input} value={form.name} disabled={!isOwner}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </div>
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">사업자등록번호</label>
        <input className={input} value={form.businessNumber} disabled={!isOwner}
          onChange={(e) => setForm((f) => ({ ...f, businessNumber: e.target.value }))} />
      </div>
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">전화</label>
        <input className={input} value={form.phone} disabled={!isOwner}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
      </div>
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">주소</label>
        <input className={input} value={form.address} disabled={!isOwner}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
      </div>
      {error && <p className="text-sm text-hud-accent-danger">{error}</p>}
      {success && <p className="text-sm text-hud-accent-success">저장되었습니다.</p>}
      {isOwner && (
        <Button variant="primary" type="submit" disabled={saving}>
          {saving ? '저장 중...' : '저장'}
        </Button>
      )}
    </form>
  )
}
