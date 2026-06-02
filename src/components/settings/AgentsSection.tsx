'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Button from '@/components/common/Button'
import { apiFetch } from '@/lib/api-client'
import { useAuth } from '@/auth/AuthContext'

interface Agent {
  id: number
  email: string
  name: string
  phone: string | null
  role: 'owner' | 'member'
  status: 'active' | 'suspended'
  createdAt: string
}

const input = 'w-full px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'

export default function AgentsSection() {
  const { me } = useAuth()
  const isOwner = me?.agent.role === 'owner'
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' })
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = async () => {
    setLoading(true)
    try {
      const list = await apiFetch<Agent[]>('/agents')
      setAgents(list)
    } finally {
      setLoading(false)
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload() }, [])

  const onAdd = async (e: FormEvent) => {
    e.preventDefault()
    setError(null); setAdding(true)
    try {
      await apiFetch('/agents', { method: 'POST', body: JSON.stringify(form) })
      setForm({ name: '', email: '', password: '', phone: '' })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '추가 실패')
    } finally {
      setAdding(false)
    }
  }

  const toggleStatus = async (a: Agent) => {
    if (a.id === me?.agent.id) return
    try {
      await apiFetch(`/agents/${a.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: a.status === 'active' ? 'suspended' : 'active' }),
      })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 변경 실패')
    }
  }

  if (!isOwner) {
    return <p className="text-hud-accent-warning text-sm">owner만 접근할 수 있습니다.</p>
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-lg font-semibold text-hud-text-primary">중개사 관리</h2>

      <form onSubmit={onAdd} className="hud-card rounded-lg p-4 grid grid-cols-2 gap-3">
        <div className="col-span-2 text-sm font-semibold text-hud-text-secondary">새 중개사 추가</div>
        <input className={input} placeholder="이름 *" required value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <input className={input} placeholder="이메일 *" type="email" required value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        <input className={input} placeholder="비밀번호 (8자 이상) *" type="password" required minLength={8} value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
        <input className={input} placeholder="전화 (선택)" value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        {error && <p className="col-span-2 text-sm text-hud-accent-danger">{error}</p>}
        <div className="col-span-2">
          <Button variant="primary" type="submit" disabled={adding}>
            {adding ? '추가 중...' : '추가'}
          </Button>
        </div>
      </form>

      {loading ? (
        <p className="text-hud-text-muted text-sm">불러오는 중...</p>
      ) : (
        <table className="w-full text-sm hud-card rounded-lg overflow-hidden">
          <thead className="bg-hud-bg-secondary border-b border-hud-border-secondary text-left text-hud-text-secondary">
            <tr>
              <th className="px-4 py-2 font-medium">이름</th>
              <th className="px-4 py-2 font-medium">이메일</th>
              <th className="px-4 py-2 font-medium">역할</th>
              <th className="px-4 py-2 font-medium">상태</th>
              <th className="px-4 py-2 font-medium w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hud-border-secondary">
            {agents.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2">{a.name}</td>
                <td className="px-4 py-2 text-hud-text-secondary">{a.email}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${a.role === 'owner'
                    ? 'bg-hud-accent-primary/20 text-hud-accent-primary'
                    : 'bg-hud-bg-secondary text-hud-text-secondary'}`}>
                    {a.role}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${a.status === 'active'
                    ? 'bg-hud-accent-success/20 text-hud-accent-success'
                    : 'bg-hud-accent-warning/20 text-hud-accent-warning'}`}>
                    {a.status === 'active' ? '활성' : '비활성'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  {a.id !== me?.agent.id && (
                    <button onClick={() => toggleStatus(a)} className="text-xs text-hud-accent-primary hover:underline">
                      {a.status === 'active' ? '비활성화' : '활성화'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
