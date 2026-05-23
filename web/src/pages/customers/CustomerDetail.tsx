import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Users, Plus, Trash2, Edit3 } from 'lucide-react'
import Button from '../../components/common/Button'
import {
  getCustomer,
  deleteCustomer,
  listMatches,
  createMatch,
  updateMatch,
  deleteMatch,
} from '../../api/customers'
import { listListings } from '../../api/listings'

const typeLabels: Record<string, string> = {
  buyer: '매수', seller: '매도', tenant: '임차', landlord: '임대',
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

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const customerId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => getCustomer(customerId),
  })
  const { data: matches } = useQuery({
    queryKey: ['customer', customerId, 'matches'],
    queryFn: () => listMatches(customerId),
    enabled: !!customer,
  })
  const { data: listings } = useQuery({
    queryKey: ['listings', { matchPicker: true }],
    queryFn: () => listListings({ page: 1, limit: 100 }),
  })

  const [pickListing, setPickListing] = useState('')
  const [matchMemo, setMatchMemo] = useState('')

  const addMatch = useMutation({
    mutationFn: () =>
      createMatch(customerId, {
        listingId: Number(pickListing),
        memo: matchMemo || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer', customerId, 'matches'] })
      setPickListing('')
      setMatchMemo('')
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

  const delCustomer = useMutation({
    mutationFn: () => deleteCustomer(customerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      navigate('/customers', { replace: true })
    },
  })

  if (isLoading) return <p className="p-6 text-hud-text-muted">불러오는 중...</p>
  if (!customer) return <p className="p-6 text-hud-text-muted">고객을 찾을 수 없습니다.</p>

  const onAddMatch = (e: FormEvent) => {
    e.preventDefault()
    if (pickListing) addMatch.mutate()
  }

  return (
    <div className="p-6 text-hud-text-primary space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users size={24} className="text-hud-accent-primary" />
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          <span className="px-2 py-0.5 rounded text-xs bg-hud-accent-info/20 text-hud-accent-info">
            {typeLabels[customer.customerType]}
          </span>
        </div>
        <div className="flex gap-2">
          <Link to={`/customers/${customer.id}/edit`}>
            <Button variant="outline" leftIcon={<Edit3 size={16} />}>수정</Button>
          </Link>
          <Button
            variant="outline"
            leftIcon={<Trash2 size={16} />}
            onClick={() => { if (confirm('이 고객을 삭제할까요?')) delCustomer.mutate() }}
          >
            삭제
          </Button>
        </div>
      </div>

      <div className="hud-card rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-3">고객 정보</h2>
        <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-sm">
          <div><span className="text-hud-text-muted">전화: </span>{customer.phone ?? '-'}</div>
          <div><span className="text-hud-text-muted">희망 지역: </span>{customer.desiredArea ?? '-'}</div>
          <div><span className="text-hud-text-muted">예산: </span>{fmt(customer.budgetMin)} ~ {fmt(customer.budgetMax)}</div>
        </div>
        {customer.memo && (
          <div className="mt-3 pt-3 border-t border-hud-border-secondary text-sm whitespace-pre-wrap">
            <div className="text-hud-text-muted mb-1">메모</div>
            {customer.memo}
          </div>
        )}
      </div>

      <div className="hud-card rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-3">매칭 매물</h2>

        {/* Add new match */}
        <form onSubmit={onAddMatch} className="flex flex-wrap gap-2 mb-4">
          <select
            className="px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
            value={pickListing}
            onChange={(e) => setPickListing(e.target.value)}
          >
            <option value="">매물 선택</option>
            {(listings?.data ?? []).map((l) => (
              <option key={l.id} value={l.id}>{l.title} — {l.address}</option>
            ))}
          </select>
          <input
            className="flex-1 min-w-[200px] px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
            placeholder="메모 (선택)"
            value={matchMemo}
            onChange={(e) => setMatchMemo(e.target.value)}
          />
          <Button variant="primary" type="submit" disabled={!pickListing || addMatch.isPending} leftIcon={<Plus size={16} />}>
            매칭 추가
          </Button>
        </form>

        {/* Match table */}
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
    </div>
  )
}
