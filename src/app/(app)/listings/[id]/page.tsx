'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building, ArrowLeft, Edit3, Trash2, FileText, Upload, X } from 'lucide-react'
import Button from '@/components/common/Button'
import { PhotoGallery } from '@/components/listings/PhotoGallery'
import { useAuth } from '@/auth/AuthContext'
import {
  getListing, deleteListing, uploadPhoto, deletePhoto,
  uploadContract, deleteContract,
  type ListingDetail,
} from '@/lib/api/listings'

const dealLabels: Record<string, string> = { sale: '매매', jeonse: '전세', wolse: '월세' }
const statusLabels: Record<string, string> = { active: '거래중', contracted: '거래완료', hidden: '숨김' }

function fmt(won: string | null): string {
  if (!won) return '-'
  const n = Number(won)
  if (!Number.isFinite(n)) return '-'
  if (n < 100_000_000) return `${Math.floor(n / 10_000).toLocaleString()}만원`
  const eok = Math.floor(n / 100_000_000)
  const man = Math.floor((n % 100_000_000) / 10_000)
  return man > 0 ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억원`
}

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { me } = useAuth()
  const id = Number(params.id)
  const [data, setData] = useState<ListingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = async () => {
    try {
      setLoading(true)
      setData(await getListing(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { reload() }, [id])

  if (loading) return <p className="p-12 text-hud-text-muted">불러오는 중...</p>
  if (error) return <p className="p-12 text-hud-accent-danger">{error}</p>
  if (!data) return <p className="p-12 text-hud-text-muted">없음</p>

  const canEdit = me?.agent.id === data.createdById || me?.agent.role === 'owner'

  const onDelete = async () => {
    if (!confirm('이 매물을 삭제할까요?')) return
    await deleteListing(id)
    router.replace('/listings')
  }

  const onPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    for (const f of Array.from(files)) {
      await uploadPhoto(id, f)
    }
    e.target.value = ''
    await reload()
  }

  const onPhotoDelete = async (pid: number) => {
    await deletePhoto(id, pid)
    await reload()
  }

  const onContractUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    for (const f of Array.from(files)) {
      await uploadContract(id, f)
    }
    e.target.value = ''
    await reload()
  }

  const onContractDelete = async (cid: number) => {
    if (!confirm('이 계약서를 삭제할까요?')) return
    await deleteContract(id, cid)
    await reload()
  }

  return (
    <div className="p-6 text-hud-text-primary space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/listings" className="text-hud-text-muted hover:text-hud-text-primary">
          <ArrowLeft size={20} />
        </Link>
        <Building size={24} className="text-hud-accent-primary" />
        <h1 className="text-2xl font-bold">{data.title}</h1>
        <span className="px-2 py-0.5 rounded text-xs bg-hud-accent-primary/20 text-hud-accent-primary">
          {dealLabels[data.dealType]}
        </span>
        <span className="px-2 py-0.5 rounded text-xs bg-hud-bg-secondary text-hud-text-muted">
          {statusLabels[data.status]}
        </span>
        {canEdit && (
          <div className="ml-auto flex gap-2">
            <Link href={`/listings/${id}/edit`}>
              <Button variant="outline" leftIcon={<Edit3 size={16} />}>수정</Button>
            </Link>
            <Button variant="outline" leftIcon={<Trash2 size={16} />} onClick={onDelete}>삭제</Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="hud-card rounded-lg p-6 space-y-3">
          <h2 className="text-lg font-semibold mb-2">기본 정보</h2>
          <Row label="단지">{data.complexName ?? '-'}</Row>
          <Row label="동/호/층">{[data.dong, data.ho, data.floor].filter(Boolean).join(' / ') || '-'}</Row>
          <Row label="평형">{data.pyeongType ?? '-'}</Row>
          <Row label="향">{data.direction ?? '-'}</Row>
          <Row label="전용/공급">{data.areaM2}㎡{data.supplyAreaM2 ? ` / ${data.supplyAreaM2}㎡` : ''}</Row>
          <Row label="주소">{data.address}{data.addressDetail ? ` ${data.addressDetail}` : ''}</Row>
        </div>

        <div className="hud-card rounded-lg p-6 space-y-3">
          <h2 className="text-lg font-semibold mb-2">거래 정보</h2>
          {data.dealType === 'sale' && <Row label="매매가">{fmt(data.salePrice)}</Row>}
          {data.dealType === 'jeonse' && <Row label="보증금">{fmt(data.deposit)}</Row>}
          {data.dealType === 'wolse' && (
            <>
              <Row label="보증금">{fmt(data.deposit)}</Row>
              <Row label="월세">{fmt(data.monthlyRent)}</Row>
            </>
          )}
          <Row label="관리비">{data.maintenanceFee != null ? `${data.maintenanceFee.toLocaleString()}원/월` : '-'}</Row>
          <Row label="수수료율">{data.commissionRate != null ? `${data.commissionRate}%` : '-'}</Row>
          <Row label="입주가능일">{data.availableMoveInDate ? new Date(data.availableMoveInDate).toLocaleDateString() : '-'}</Row>
        </div>
      </div>

      <div className="hud-card rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-semibold mb-2">소유자 / 메모</h2>
        <Row label="소유자">{data.ownerName ?? '-'}</Row>
        <Row label="소유자 전화">{data.ownerPhone ?? '-'}</Row>
        {data.ownerMemo != null && <Row label="소유자 메모">{data.ownerMemo}</Row>}
        {data.description && (
          <div>
            <div className="text-xs text-hud-text-muted mb-1">설명</div>
            <p className="text-sm whitespace-pre-wrap">{data.description}</p>
          </div>
        )}
        {data.privateMemo != null && (
          <div>
            <div className="text-xs text-hud-text-muted mb-1">비공개 메모</div>
            <p className="text-sm whitespace-pre-wrap">{data.privateMemo}</p>
          </div>
        )}
      </div>

      <div className="hud-card rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">사진 ({data.photos.length})</h2>
          {canEdit && (
            <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-hud-accent-primary/20 text-hud-accent-primary rounded text-sm hover:bg-hud-accent-primary/30 transition-hud">
              <Upload size={14} />
              사진 추가
              <input type="file" multiple accept="image/*" className="hidden" onChange={onPhotoUpload} />
            </label>
          )}
        </div>
        <PhotoGallery photos={data.photos} canEdit={canEdit} onDelete={onPhotoDelete} />
      </div>

      <div className="hud-card rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">계약서 ({data.contracts.length})</h2>
          {canEdit && (
            <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-hud-accent-primary/20 text-hud-accent-primary rounded text-sm hover:bg-hud-accent-primary/30 transition-hud">
              <Upload size={14} />
              계약서 추가
              <input type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={onContractUpload} />
            </label>
          )}
        </div>
        {data.contracts.length === 0 ? (
          <p className="text-sm text-hud-text-muted">계약서 없음</p>
        ) : (
          <ul className="space-y-2">
            {data.contracts.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-sm">
                <FileText size={14} className="text-hud-accent-primary" />
                <a href={c.url} target="_blank" rel="noreferrer" className="text-hud-accent-primary hover:underline flex-1">{c.filename}</a>
                <span className="text-xs text-hud-text-muted">{new Date(c.uploadedAt).toLocaleDateString()}</span>
                {canEdit && (
                  <button onClick={() => onContractDelete(c.id)} className="text-hud-text-muted hover:text-hud-accent-danger">
                    <X size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 text-sm">
      <div className="text-hud-text-muted col-span-1">{label}</div>
      <div className="col-span-2">{children}</div>
    </div>
  )
}
