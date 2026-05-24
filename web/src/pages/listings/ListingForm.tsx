import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Building, MapPin, Ruler, FileText, ImagePlus, ArrowLeft } from 'lucide-react'
import Button from '../../components/common/Button'
import { getListing, createListing, updateListing, uploadListingPhoto } from '../../api/listings'
import type { CreateListingRequest } from '@rems/shared'

const inputCls =
  'w-full px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'
const iconInputCls =
  'w-full pl-10 pr-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'

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
  title: '', dealType: 'sale', propertyType: 'apartment',
  salePrice: '', deposit: '', monthlyRent: '',
  areaM2: '', address: '', description: '', status: 'active',
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
    <div className="p-6 text-hud-text-primary max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/listings" className="text-hud-text-muted hover:text-hud-text-primary">
          <ArrowLeft size={20} />
        </Link>
        <Building size={24} className="text-hud-accent-primary" />
        <h1 className="text-2xl font-bold">{isEdit ? '매물 수정' : '매물 등록'}</h1>
      </div>

      <form onSubmit={onSubmit} className="hud-card rounded-lg p-6 space-y-5">
        <div>
          <label className="block text-xs text-hud-text-muted mb-1">매물명 *</label>
          <input required className={inputCls} placeholder="예: 강남 아파트 30평"
            value={form.title} onChange={(e) => set('title', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-hud-text-muted mb-1">거래유형</label>
            <select className={inputCls} value={form.dealType}
              onChange={(e) => set('dealType', e.target.value)}>
              <option value="sale">매매</option>
              <option value="jeonse">전세</option>
              <option value="wolse">월세</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-hud-text-muted mb-1">매물 종류</label>
            <select className={inputCls} value={form.propertyType}
              onChange={(e) => set('propertyType', e.target.value)}>
              <option value="apartment">아파트</option>
              <option value="officetel">오피스텔</option>
              <option value="house">주택</option>
              <option value="commercial">상가</option>
              <option value="land">토지</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {form.dealType === 'sale' && (
            <div>
              <label className="block text-xs text-hud-text-muted mb-1">매매가 (원)</label>
              <input type="number" className={inputCls} placeholder="150000000"
                value={form.salePrice} onChange={(e) => set('salePrice', e.target.value)} />
            </div>
          )}
          {(form.dealType === 'jeonse' || form.dealType === 'wolse') && (
            <div>
              <label className="block text-xs text-hud-text-muted mb-1">보증금 (원)</label>
              <input type="number" className={inputCls} placeholder="50000000"
                value={form.deposit} onChange={(e) => set('deposit', e.target.value)} />
            </div>
          )}
          {form.dealType === 'wolse' && (
            <div>
              <label className="block text-xs text-hud-text-muted mb-1">월세액 (원)</label>
              <input type="number" className={inputCls} placeholder="1000000"
                value={form.monthlyRent} onChange={(e) => set('monthlyRent', e.target.value)} />
            </div>
          )}
          <div>
            <label className="block text-xs text-hud-text-muted mb-1">전용면적 (㎡) *</label>
            <div className="relative">
              <Ruler size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-text-muted" />
              <input required type="number" step="0.01" className={iconInputCls} placeholder="99"
                value={form.areaM2} onChange={(e) => set('areaM2', e.target.value)} />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs text-hud-text-muted mb-1">주소 *</label>
          <div className="relative">
            <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-text-muted" />
            <input required className={iconInputCls} placeholder="서울특별시 강남구 ..."
              value={form.address} onChange={(e) => set('address', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-xs text-hud-text-muted mb-1">설명</label>
          <div className="relative">
            <FileText size={16} className="absolute left-3 top-3 text-hud-text-muted" />
            <textarea className="w-full pl-10 pr-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-sm text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
              rows={4} placeholder="매물 특징, 옵션 등"
              value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
        </div>

        {isEdit && (
          <div>
            <label className="block text-xs text-hud-text-muted mb-1">거래 상태</label>
            <select className={inputCls} value={form.status}
              onChange={(e) => set('status', e.target.value)}>
              <option value="active">거래중</option>
              <option value="completed">거래완료</option>
              <option value="hidden">숨김</option>
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs text-hud-text-muted mb-2">사진</label>
          <label className="flex items-center gap-2 px-3 py-2 bg-hud-bg-secondary border border-dashed border-hud-border-secondary rounded-lg cursor-pointer hover:border-hud-accent-primary transition-hud text-sm text-hud-text-secondary">
            <ImagePlus size={18} />
            <span>{photoFile ? photoFile.name : '이미지 선택 (jpg, png, webp · 최대 5MB)'}</span>
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        {error && <p className="text-sm text-hud-accent-danger">{error}</p>}

        <div className="flex gap-2">
          <Button variant="primary" type="submit" disabled={save.isPending} fullWidth glow>
            {save.isPending ? '저장 중...' : '저장'}
          </Button>
          <Link to="/listings">
            <Button variant="ghost" type="button">취소</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
