import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { User, Phone, MapPin, FileText } from 'lucide-react'
import Button from '../../components/common/Button'
import { getCustomer, createCustomer, updateCustomer } from '../../api/customers'
import type { CreateCustomerRequest } from '@rems/shared'

const inputCls =
  'w-full pl-12 pr-4 py-3 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'
const plainCls =
  'w-full px-4 py-3 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'

type FormState = {
  name: string
  phone: string
  customerType: 'buyer' | 'seller' | 'tenant' | 'landlord'
  budgetMin: string
  budgetMax: string
  desiredArea: string
  memo: string
}

const empty: FormState = {
  name: '', phone: '', customerType: 'buyer',
  budgetMin: '', budgetMax: '', desiredArea: '', memo: '',
}

function toNum(s: string): number | undefined {
  if (s.trim() === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

export default function CustomerForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = id != null
  const customerId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [form, setForm] = useState<FormState>(empty)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useQuery({
    queryKey: ['customer', customerId],
    queryFn: async () => {
      const c = await getCustomer(customerId)
      setForm({
        name: c.name,
        phone: c.phone ?? '',
        customerType: c.customerType,
        budgetMin: c.budgetMin?.toString() ?? '',
        budgetMax: c.budgetMax?.toString() ?? '',
        desiredArea: c.desiredArea ?? '',
        memo: c.memo ?? '',
      })
      setLoaded(true)
      return c
    },
    enabled: isEdit && !loaded,
  })

  const set = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }) as FormState)

  const save = useMutation({
    mutationFn: async () => {
      const payload: CreateCustomerRequest = {
        name: form.name,
        phone: form.phone || undefined,
        customerType: form.customerType,
        budgetMin: toNum(form.budgetMin),
        budgetMax: toNum(form.budgetMax),
        desiredArea: form.desiredArea || undefined,
        memo: form.memo || undefined,
      }
      return isEdit ? updateCustomer(customerId, payload) : createCustomer(payload)
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['customer', saved.id] })
      navigate(`/customers/${saved.id}`, { replace: true })
    },
    onError: (e) => setError(e instanceof Error ? e.message : '저장 실패'),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    save.mutate()
  }

  return (
    <div className="p-6 text-hud-text-primary max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{isEdit ? '고객 수정' : '고객 등록'}</h1>
      <form onSubmit={onSubmit} className="hud-card rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm text-hud-text-secondary mb-2">이름</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
            <input required className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-sm text-hud-text-secondary mb-2">전화</label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
            <input className={inputCls} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="010-0000-0000" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-hud-text-secondary mb-2">유형</label>
          <select className={plainCls} value={form.customerType} onChange={(e) => set('customerType', e.target.value)}>
            <option value="buyer">매수</option>
            <option value="seller">매도</option>
            <option value="tenant">임차</option>
            <option value="landlord">임대</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-hud-text-secondary mb-2">예산 최소 (원)</label>
            <input type="number" className={plainCls} value={form.budgetMin} onChange={(e) => set('budgetMin', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-hud-text-secondary mb-2">예산 최대 (원)</label>
            <input type="number" className={plainCls} value={form.budgetMax} onChange={(e) => set('budgetMax', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-sm text-hud-text-secondary mb-2">희망 지역</label>
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
            <input className={inputCls} value={form.desiredArea} onChange={(e) => set('desiredArea', e.target.value)} placeholder="예: 강남구, 서초구" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-hud-text-secondary mb-2">메모</label>
          <div className="relative">
            <FileText className="absolute left-4 top-4 text-hud-text-muted" size={18} />
            <textarea
              className="w-full pl-12 pr-4 py-3 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
              rows={4}
              value={form.memo}
              onChange={(e) => set('memo', e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button variant="primary" fullWidth glow type="submit" disabled={save.isPending}>
          {save.isPending ? '저장 중...' : '저장'}
        </Button>
      </form>
    </div>
  )
}
