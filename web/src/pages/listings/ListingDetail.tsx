import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Building, MapPin, Ruler, Edit3, Trash2, ArrowLeft } from 'lucide-react'
import Button from '../../components/common/Button'
import { getListing, deleteListing } from '../../api/listings'
import { KakaoMap } from '../../components/KakaoMap'

const dealLabels: Record<string, string> = { sale: '매매', jeonse: '전세', wolse: '월세' }
const dealBadgeColors: Record<string, string> = {
  sale: 'bg-hud-accent-primary/20 text-hud-accent-primary',
  jeonse: 'bg-hud-accent-info/20 text-hud-accent-info',
  wolse: 'bg-hud-accent-warning/20 text-hud-accent-warning',
}
const propertyLabels: Record<string, string> = {
  apartment: '아파트', officetel: '오피스텔', house: '주택', commercial: '상가', land: '토지',
}
const statusLabels: Record<string, string> = { active: '거래중', completed: '거래완료', hidden: '숨김' }
const statusColors: Record<string, string> = {
  active: 'bg-hud-accent-success/20 text-hud-accent-success',
  completed: 'bg-hud-text-muted/20 text-hud-text-muted',
  hidden: 'bg-hud-bg-secondary text-hud-text-muted',
}

function fmt(n: number | null | undefined): string {
  return n == null ? '-' : n.toLocaleString() + '원'
}

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>()
  const listingId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: listing, isLoading, isError } = useQuery({
    queryKey: ['listing', listingId],
    queryFn: () => getListing(listingId),
  })

  const del = useMutation({
    mutationFn: () => deleteListing(listingId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['listings'] })
      navigate('/listings', { replace: true })
    },
  })

  if (isLoading) return <p className="p-6 text-hud-text-muted">불러오는 중...</p>
  if (isError || !listing) return <p className="p-6 text-hud-text-muted">매물을 찾을 수 없습니다.</p>

  return (
    <div className="p-6 text-hud-text-primary space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link to="/listings" className="text-hud-text-muted hover:text-hud-text-primary">
          <ArrowLeft size={20} />
        </Link>
        <Building size={24} className="text-hud-accent-primary" />
        <h1 className="text-2xl font-bold">{listing.title}</h1>
        <span className={`px-2 py-0.5 rounded text-xs ${dealBadgeColors[listing.dealType]}`}>
          {dealLabels[listing.dealType]}
        </span>
        <span className={`px-2 py-0.5 rounded text-xs ${statusColors[listing.status]}`}>
          {statusLabels[listing.status]}
        </span>
        <div className="ml-auto flex gap-2">
          <Link to={`/listings/${listing.id}/edit`}>
            <Button variant="outline" leftIcon={<Edit3 size={16} />}>수정</Button>
          </Link>
          <Button
            variant="outline"
            leftIcon={<Trash2 size={16} />}
            onClick={() => { if (confirm('이 매물을 삭제할까요?')) del.mutate() }}
          >
            삭제
          </Button>
        </div>
      </div>

      {listing.photos.length > 0 && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {listing.photos.map((p) => (
            <div key={p.id} className="hud-card rounded-lg overflow-hidden aspect-[4/3]">
              <img src={p.url} alt="매물 사진" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="hud-card rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">매물 정보</h2>
          <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
            <div>
              <div className="text-xs text-hud-text-muted mb-1">매물 종류</div>
              <div>{propertyLabels[listing.propertyType]}</div>
            </div>
            <div>
              <div className="text-xs text-hud-text-muted mb-1 flex items-center gap-1">
                <Ruler size={12} /> 전용면적
              </div>
              <div>{listing.areaM2}㎡</div>
            </div>
            {listing.salePrice != null && (
              <div>
                <div className="text-xs text-hud-text-muted mb-1">매매가</div>
                <div className="font-mono text-hud-accent-primary">{fmt(listing.salePrice)}</div>
              </div>
            )}
            {listing.deposit != null && (
              <div>
                <div className="text-xs text-hud-text-muted mb-1">보증금</div>
                <div className="font-mono text-hud-accent-primary">{fmt(listing.deposit)}</div>
              </div>
            )}
            {listing.monthlyRent != null && (
              <div>
                <div className="text-xs text-hud-text-muted mb-1">월세</div>
                <div className="font-mono text-hud-accent-primary">{fmt(listing.monthlyRent)}</div>
              </div>
            )}
            <div className="col-span-2">
              <div className="text-xs text-hud-text-muted mb-1 flex items-center gap-1">
                <MapPin size={12} /> 주소
              </div>
              <div>{listing.address} {listing.addressDetail ?? ''}</div>
            </div>
          </div>
          {listing.description && (
            <div className="pt-3 border-t border-hud-border-secondary">
              <div className="text-xs text-hud-text-muted mb-2">설명</div>
              <p className="text-sm whitespace-pre-wrap">{listing.description}</p>
            </div>
          )}
        </div>

        {listing.latitude != null && listing.longitude != null && (
          <div className="hud-card rounded-lg overflow-hidden">
            <KakaoMap
              markers={[{
                id: listing.id,
                lat: listing.latitude,
                lng: listing.longitude,
                title: listing.title,
              }]}
              className="w-full h-full min-h-[300px]"
            />
          </div>
        )}
      </div>
    </div>
  )
}
