import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getListing, deleteListing } from '../../api/listings'
import { KakaoMap } from '../../components/KakaoMap'

const dealLabels: Record<string, string> = { sale: '매매', jeonse: '전세', wolse: '월세' }

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

  if (isLoading) return <p className="p-6 text-slate-500">불러오는 중...</p>
  if (isError || !listing) return <p className="p-6 text-slate-500">매물을 찾을 수 없습니다.</p>

  return (
    <div className="p-6 text-slate-900 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{listing.title}</h1>
        <div className="flex gap-2">
          <Link
            to={`/listings/${listing.id}/edit`}
            className="px-3 py-2 border border-slate-300 rounded bg-white"
          >
            수정
          </Link>
          <button
            className="px-3 py-2 border border-red-300 text-red-600 rounded bg-white"
            onClick={() => {
              if (confirm('이 매물을 삭제할까요?')) del.mutate()
            }}
          >
            삭제
          </button>
        </div>
      </div>

      <div className="grid gap-1 text-sm">
        <div>거래유형: {dealLabels[listing.dealType]}</div>
        {listing.salePrice != null && <div>매매가: {listing.salePrice.toLocaleString()}원</div>}
        {listing.deposit != null && <div>보증금: {listing.deposit.toLocaleString()}원</div>}
        {listing.monthlyRent != null && (
          <div>월세: {listing.monthlyRent.toLocaleString()}원</div>
        )}
        <div>면적: {listing.areaM2}㎡</div>
        <div>주소: {listing.address} {listing.addressDetail ?? ''}</div>
        {listing.description && <div className="mt-2 whitespace-pre-wrap">{listing.description}</div>}
      </div>

      {listing.photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {listing.photos.map((p) => (
            <img key={p.id} src={p.url} alt="매물 사진" className="w-40 h-32 object-cover rounded" />
          ))}
        </div>
      )}

      {listing.latitude != null && listing.longitude != null && (
        <KakaoMap
          markers={[
            {
              id: listing.id,
              lat: listing.latitude,
              lng: listing.longitude,
              title: listing.title,
            },
          ]}
          className="w-full h-80 rounded border border-slate-200"
        />
      )}
    </div>
  )
}
