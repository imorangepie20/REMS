import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getListing, createListing, updateListing, uploadListingPhoto } from '../../api/listings'
import type { CreateListingRequest } from '@rems/shared'

const inputCls =
  'w-full px-3 py-2 border border-slate-300 rounded bg-white text-slate-900 placeholder:text-slate-400'

type FormState = {
  title: string
  dealType: 'sale' | 'jeonse' | 'wolse'
  propertyType: 'apartment' | 'officetel' | 'house' | 'commercial' | 'land'
  salePrice: string
  deposit: string
  monthlyRent: string
  areaM2: string
  address: string
  description: string
  status: 'active' | 'completed' | 'hidden'
}

const empty: FormState = {
  title: '',
  dealType: 'sale',
  propertyType: 'apartment',
  salePrice: '',
  deposit: '',
  monthlyRent: '',
  areaM2: '',
  address: '',
  description: '',
  status: 'active',
}

function toNumber(s: string): number | undefined {
  if (s.trim() === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

export default function ListingForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = id != null
  const listingId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [form, setForm] = useState<FormState>(empty)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useQuery({
    queryKey: ['listing', listingId],
    queryFn: async () => {
      const l = await getListing(listingId)
      setForm({
        title: l.title,
        dealType: l.dealType,
        propertyType: l.propertyType,
        salePrice: l.salePrice?.toString() ?? '',
        deposit: l.deposit?.toString() ?? '',
        monthlyRent: l.monthlyRent?.toString() ?? '',
        areaM2: l.areaM2.toString(),
        address: l.address,
        description: l.description ?? '',
        status: l.status,
      })
      setLoaded(true)
      return l
    },
    enabled: isEdit && !loaded,
  })

  const set = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }) as FormState)

  const save = useMutation({
    mutationFn: async () => {
      const payload: CreateListingRequest = {
        title: form.title,
        dealType: form.dealType,
        propertyType: form.propertyType,
        salePrice: toNumber(form.salePrice),
        deposit: toNumber(form.deposit),
        monthlyRent: toNumber(form.monthlyRent),
        areaM2: toNumber(form.areaM2) ?? 0,
        address: form.address,
        description: form.description || undefined,
      }
      const saved = isEdit
        ? await updateListing(listingId, { ...payload, status: form.status })
        : await createListing(payload)
      if (photoFile) await uploadListingPhoto(saved.id, photoFile)
      return saved
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['listings'] })
      qc.invalidateQueries({ queryKey: ['listing', saved.id] })
      navigate(`/listings/${saved.id}`, { replace: true })
    },
    onError: (e) => setError(e instanceof Error ? e.message : '저장 실패'),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    save.mutate()
  }

  return (
    <div className="p-6 text-slate-900">
      <h1 className="text-2xl font-semibold mb-4">{isEdit ? '매물 수정' : '매물 등록'}</h1>
      <form onSubmit={onSubmit} className="max-w-lg space-y-3">
        <input className={inputCls} placeholder="매물명" required value={form.title}
          onChange={(e) => set('title', e.target.value)} />
        <select className={inputCls} value={form.dealType}
          onChange={(e) => set('dealType', e.target.value)}>
          <option value="sale">매매</option>
          <option value="jeonse">전세</option>
          <option value="wolse">월세</option>
        </select>
        <select className={inputCls} value={form.propertyType}
          onChange={(e) => set('propertyType', e.target.value)}>
          <option value="apartment">아파트</option>
          <option value="officetel">오피스텔</option>
          <option value="house">주택</option>
          <option value="commercial">상가</option>
          <option value="land">토지</option>
        </select>
        {form.dealType === 'sale' && (
          <input className={inputCls} type="number" placeholder="매매가 (원)" value={form.salePrice}
            onChange={(e) => set('salePrice', e.target.value)} />
        )}
        {(form.dealType === 'jeonse' || form.dealType === 'wolse') && (
          <input className={inputCls} type="number" placeholder="보증금 (원)" value={form.deposit}
            onChange={(e) => set('deposit', e.target.value)} />
        )}
        {form.dealType === 'wolse' && (
          <input className={inputCls} type="number" placeholder="월세액 (원)" value={form.monthlyRent}
            onChange={(e) => set('monthlyRent', e.target.value)} />
        )}
        <input className={inputCls} type="number" step="0.01" placeholder="전용면적 (㎡)" required
          value={form.areaM2} onChange={(e) => set('areaM2', e.target.value)} />
        <input className={inputCls} placeholder="주소" required value={form.address}
          onChange={(e) => set('address', e.target.value)} />
        <textarea className={inputCls} placeholder="설명" rows={4} value={form.description}
          onChange={(e) => set('description', e.target.value)} />
        {isEdit && (
          <label className="block text-sm text-slate-700">
            거래 상태
            <select className={inputCls} value={form.status}
              onChange={(e) => set('status', e.target.value)}>
              <option value="active">거래중</option>
              <option value="completed">거래완료</option>
              <option value="hidden">숨김</option>
            </select>
          </label>
        )}
        <input type="file" accept="image/*"
          onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={save.isPending}
          className="w-full py-2 bg-blue-600 text-white rounded disabled:opacity-50">
          {save.isPending ? '저장 중...' : '저장'}
        </button>
      </form>
    </div>
  )
}
