import { useState, useEffect, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Users, Plus, Search, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react'
import Button from '../../components/common/Button'
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  listMatches,
  createMatch,
  updateMatch,
  deleteMatch,
  type CustomerQuery,
} from '../../api/customers'
import { listListings } from '../../api/listings'
import type { Customer, CreateCustomerRequest } from '@rems/shared'

const typeLabels: Record<string, string> = {
  buyer: '매수', seller: '매도', tenant: '임차', landlord: '임대',
}
const typeBadgeColors: Record<string, string> = {
  buyer: 'bg-hud-accent-info/20 text-hud-accent-info',
  seller: 'bg-hud-accent-primary/20 text-hud-accent-primary',
  tenant: 'bg-hud-accent-secondary/20 text-hud-accent-secondary',
  landlord: 'bg-hud-accent-warning/20 text-hud-accent-warning',
}
const statusLabels: Record<string, string> = {
  suggested: '추천', interested: '관심', visited: '임장', contracted: '계약', rejected: '보류',
}
const statusColors: Record<string, string> = {
  suggested: 'bg-hud-bg-secondary text-hud-text-secondary',
  interested: 'bg-hud-accent-info/20 text-hud-accent-info',
  visited: 'bg-hud-accent-warning/20 text-hud-accent-warning',
  contracted: 'bg-hud-accent-success/20 text-hud-accent-success',
  rejected: 'bg-hud-text-muted/20 text-hud-text-muted',
}

function fmt(n: number | null): string {
  return n == null ? '-' : n.toLocaleString() + '원'
}

type CustomerType = 'buyer' | 'seller' | 'tenant' | 'landlord'
type FormState = {
  name: string
  phone: string
  customerType: CustomerType
  budgetMin: string
  budgetMax: string
  desiredArea: string
  memo: string
}
const emptyForm: FormState = {
  name: '', phone: '', customerType: 'buyer',
  budgetMin: '', budgetMax: '', desiredArea: '', memo: '',
}
function toNum(s: string): number | undefined {
  if (s.trim() === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}
function formToPayload(form: FormState): CreateCustomerRequest {
  return {
    name: form.name,
    phone: form.phone || undefined,
    customerType: form.customerType,
    budgetMin: toNum(form.budgetMin),
    budgetMax: toNum(form.budgetMax),
    desiredArea: form.desiredArea || undefined,
    memo: form.memo || undefined,
  }
}

const inputCls =
  'w-full px-3 py-2 bg-hud-bg-primary border border-hud-border-secondary rounded text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'

export default function CustomerList() {
  const [filter, setFilter] = useState<CustomerQuery>({})
  const [expandedId, setExpandedId] = useState<number | 'new' | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: ['customers', filter],
    queryFn: () => listCustomers(filter),
  })
  const customers = data?.data ?? []

  return (
    <div className="p-6 text-hud-text-primary">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users size={24} className="text-hud-accent-primary" />
          <h1 className="text-2xl font-bold">고객</h1>
          <span className="text-hud-text-muted text-sm">{data?.total ?? 0}명</span>
        </div>
        <Button
          variant="primary"
          glow
          leftIcon={<Plus size={16} />}
          onClick={() => setExpandedId(expandedId === 'new' ? null : 'new')}
        >
          고객 등록
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className="px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
          value={filter.customerType ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, customerType: e.target.value || undefined }))}
        >
          <option value="">유형 전체</option>
          <option value="buyer">매수</option>
          <option value="seller">매도</option>
          <option value="tenant">임차</option>
          <option value="landlord">임대</option>
        </select>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-text-muted" size={16} />
          <input
            className="w-full pl-10 pr-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
            placeholder="이름·전화·희망지역"
            value={filter.q ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value || undefined }))}
          />
        </div>
      </div>

      <div className="hud-card rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-hud-bg-secondary border-b border-hud-border-secondary">
            <tr className="text-left text-hud-text-secondary">
              <th className="w-8"></th>
              <th className="px-4 py-3 font-medium">이름</th>
              <th className="px-4 py-3 font-medium">유형</th>
              <th className="px-4 py-3 font-medium">전화</th>
              <th className="px-4 py-3 font-medium">예산</th>
              <th className="px-4 py-3 font-medium">희망 지역</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hud-border-secondary">
            {expandedId === 'new' && (
              <tr className="bg-hud-bg-primary/30">
                <td colSpan={6} className="p-0">
                  <NewCustomerPanel onClose={() => setExpandedId(null)} />
                </td>
              </tr>
            )}
            {isLoading ? (
              <tr><td colSpan={6} className="p-6 text-hud-text-muted">불러오는 중...</td></tr>
            ) : customers.length === 0 && expandedId !== 'new' ? (
              <tr><td colSpan={6} className="p-6 text-hud-text-muted">고객이 없습니다.</td></tr>
            ) : (
              customers.map((c) => (
                <CustomerRow
                  key={c.id}
                  customer={c}
                  expanded={expandedId === c.id}
                  onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CustomerRow({ customer, expanded, onToggle }: {
  customer: Customer; expanded: boolean; onToggle: () => void
}) {
  return (
    <>
      <tr className="hover:bg-hud-bg-hover transition-hud cursor-pointer" onClick={onToggle}>
        <td className="w-8 pl-4">
          {expanded
            ? <ChevronDown size={16} className="text-hud-text-muted" />
            : <ChevronRight size={16} className="text-hud-text-muted" />}
        </td>
        <td className="px-4 py-3 font-medium text-hud-accent-primary">{customer.name}</td>
        <td className="px-4 py-3">
          <span className={`inline-block px-2 py-0.5 rounded text-xs ${typeBadgeColors[customer.customerType]}`}>
            {typeLabels[customer.customerType]}
          </span>
        </td>
        <td className="px-4 py-3 text-hud-text-secondary">{customer.phone ?? '-'}</td>
        <td className="px-4 py-3 text-hud-text-secondary">
          {fmt(customer.budgetMin)} ~ {fmt(customer.budgetMax)}
        </td>
        <td className="px-4 py-3 text-hud-text-secondary">{customer.desiredArea ?? '-'}</td>
      </tr>
      {expanded && (
        <tr className="bg-hud-bg-primary/30">
          <td colSpan={6} className="p-0">
            <ExpandedPanel customerId={customer.id} onDeleted={onToggle} />
          </td>
        </tr>
      )}
    </>
  )
}

function NewCustomerPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }) as FormState)

  const save = useMutation({
    mutationFn: () => createCustomer(formToPayload(form)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      onClose()
    },
    onError: (e) => setError(e instanceof Error ? e.message : '저장 실패'),
  })

  const onSubmit = (e: FormEvent) => { e.preventDefault(); setError(null); save.mutate() }

  return (
    <form onSubmit={onSubmit} className="px-4 py-4 border-l-2 border-hud-accent-primary">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">새 고객</h3>
        <button type="button" onClick={onClose} className="text-hud-text-muted hover:text-hud-text-primary">
          <X size={16} />
        </button>
      </div>
      <FormFields form={form} set={set} />
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
      <div className="flex gap-2 mt-3">
        <Button variant="primary" type="submit" disabled={save.isPending || !form.name}>
          {save.isPending ? '저장 중...' : '저장'}
        </Button>
        <Button variant="ghost" type="button" onClick={onClose}>취소</Button>
      </div>
    </form>
  )
}

function ExpandedPanel({ customerId, onDeleted }: { customerId: number; onDeleted: () => void }) {
  const qc = useQueryClient()
  const { data: customer } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => getCustomer(customerId),
  })

  const [form, setForm] = useState<FormState | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name,
        phone: customer.phone ?? '',
        customerType: customer.customerType as CustomerType,
        budgetMin: customer.budgetMin?.toString() ?? '',
        budgetMax: customer.budgetMax?.toString() ?? '',
        desiredArea: customer.desiredArea ?? '',
        memo: customer.memo ?? '',
      })
    }
  }, [customer])

  const set = (k: keyof FormState, v: string) =>
    setForm((f) => (f ? ({ ...f, [k]: v }) as FormState : f))

  const save = useMutation({
    mutationFn: () => updateCustomer(customerId, formToPayload(form!)),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['customer', saved.id] })
    },
    onError: (e) => setError(e instanceof Error ? e.message : '저장 실패'),
  })

  const del = useMutation({
    mutationFn: () => deleteCustomer(customerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      onDeleted()
    },
  })

  if (!form) {
    return <div className="p-4 text-hud-text-muted text-sm">불러오는 중...</div>
  }

  return (
    <div className="px-4 py-4 border-l-2 border-hud-accent-primary space-y-5">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">고객 정보</h3>
          <button
            type="button"
            onClick={() => { if (confirm('이 고객을 삭제할까요?')) del.mutate() }}
            className="text-hud-text-muted hover:text-hud-accent-danger flex items-center gap-1 text-xs"
          >
            <Trash2 size={14} /> 삭제
          </button>
        </div>
        <FormFields form={form} set={set} />
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        <div className="flex gap-2 mt-3">
          <Button variant="primary" onClick={() => { setError(null); save.mutate() }} disabled={save.isPending || !form.name}>
            {save.isPending ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>

      <div className="border-t border-hud-border-secondary pt-4">
        <h3 className="text-sm font-semibold mb-3">매칭 매물</h3>
        <MatchesPanel customerId={customerId} />
      </div>
    </div>
  )
}

function FormFields({ form, set }: {
  form: FormState; set: (k: keyof FormState, v: string) => void
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">이름 *</label>
        <input required className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">전화</label>
        <input className={inputCls} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="010-0000-0000" />
      </div>
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">유형</label>
        <select className={inputCls} value={form.customerType} onChange={(e) => set('customerType', e.target.value)}>
          <option value="buyer">매수</option>
          <option value="seller">매도</option>
          <option value="tenant">임차</option>
          <option value="landlord">임대</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">희망 지역</label>
        <input className={inputCls} value={form.desiredArea} onChange={(e) => set('desiredArea', e.target.value)} placeholder="예: 강남구, 서초구" />
      </div>
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">예산 최소 (원)</label>
        <input type="number" className={inputCls} value={form.budgetMin} onChange={(e) => set('budgetMin', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-hud-text-muted mb-1">예산 최대 (원)</label>
        <input type="number" className={inputCls} value={form.budgetMax} onChange={(e) => set('budgetMax', e.target.value)} />
      </div>
      <div className="md:col-span-2">
        <label className="block text-xs text-hud-text-muted mb-1">메모</label>
        <textarea
          className={inputCls}
          rows={2}
          value={form.memo}
          onChange={(e) => set('memo', e.target.value)}
        />
      </div>
    </div>
  )
}

function MatchesPanel({ customerId }: { customerId: number }) {
  const qc = useQueryClient()
  const { data: matches } = useQuery({
    queryKey: ['customer', customerId, 'matches'],
    queryFn: () => listMatches(customerId),
  })
  const { data: listings } = useQuery({
    queryKey: ['listings', { matchPicker: true }],
    queryFn: () => listListings({ page: 1, limit: 100 }),
  })
  const [pickListing, setPickListing] = useState('')
  const [matchMemo, setMatchMemo] = useState('')

  const addMatch = useMutation({
    mutationFn: () => createMatch(customerId, {
      listingId: Number(pickListing),
      memo: matchMemo || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer', customerId, 'matches'] })
      setPickListing(''); setMatchMemo('')
    },
  })
  const changeStatus = useMutation({
    mutationFn: ({ matchId, status }: { matchId: number; status: string }) =>
      updateMatch(customerId, matchId, { status: status as 'suggested' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer', customerId, 'matches'] }),
  })
  const removeMatch = useMutation({
    mutationFn: (matchId: number) => deleteMatch(customerId, matchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer', customerId, 'matches'] }),
  })

  const onAddMatch = (e: FormEvent) => {
    e.preventDefault()
    if (pickListing) addMatch.mutate()
  }

  return (
    <div>
      <form onSubmit={onAddMatch} className="flex flex-wrap gap-2 mb-3">
        <select
          className={`${inputCls} max-w-xs`}
          value={pickListing}
          onChange={(e) => setPickListing(e.target.value)}
        >
          <option value="">매물 선택</option>
          {(listings?.data ?? []).map((l) => (
            <option key={l.id} value={l.id}>{l.title} — {l.address}</option>
          ))}
        </select>
        <input
          className={`${inputCls} flex-1 min-w-[180px]`}
          placeholder="메모 (선택)"
          value={matchMemo}
          onChange={(e) => setMatchMemo(e.target.value)}
        />
        <Button variant="primary" type="submit" disabled={!pickListing || addMatch.isPending} leftIcon={<Plus size={14} />}>
          매칭 추가
        </Button>
      </form>

      {(matches ?? []).length === 0 ? (
        <p className="text-hud-text-muted text-sm">매칭된 매물이 없습니다.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-hud-border-secondary">
            <tr className="text-left text-hud-text-secondary">
              <th className="py-2 font-medium">매물</th>
              <th className="py-2 font-medium">상태</th>
              <th className="py-2 font-medium">메모</th>
              <th className="py-2 font-medium w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hud-border-secondary">
            {(matches ?? []).map((m) => (
              <tr key={m.id}>
                <td className="py-2">
                  {m.listing ? (
                    <Link to={`/listings/${m.listing.id}`} className="text-hud-accent-primary hover:underline">
                      {m.listing.title}
                    </Link>
                  ) : `#${m.listingId}`}
                  {m.listing && <div className="text-xs text-hud-text-muted">{m.listing.address}</div>}
                </td>
                <td className="py-2">
                  <select
                    className={`px-2 py-1 rounded text-xs border-0 ${statusColors[m.status]} focus:outline-none`}
                    value={m.status}
                    onChange={(e) => changeStatus.mutate({ matchId: m.id, status: e.target.value })}
                  >
                    {Object.entries(statusLabels).map(([v, label]) => (
                      <option key={v} value={v}>{label}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2 text-hud-text-secondary">{m.memo ?? '-'}</td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => { if (confirm('매칭을 해제할까요?')) removeMatch.mutate(m.id) }}
                    className="text-hud-text-muted hover:text-hud-accent-warning transition-hud"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
