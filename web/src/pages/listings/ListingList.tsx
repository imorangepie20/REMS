import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { listListings, type ListingQuery } from '../../api/listings'
import { KakaoMap, type MapMarker } from '../../components/KakaoMap'

const dealLabels: Record<string, string> = { sale: '매매', jeonse: '전세', wolse: '월세' }

export default function ListingList() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<ListingQuery>({})
  const [view, setView] = useState<'list' | 'map'>('list')
  const { data, isLoading } = useQuery({
    queryKey: ['listings', filter],
    queryFn: () => listListings(filter),
  })

  const listings = data?.data ?? []
  const markers: MapMarker[] = listings
    .filter((l) => l.latitude != null && l.longitude != null)
    .map((l) => ({ id: l.id, lat: l.latitude!, lng: l.longitude!, title: l.title }))

  return (
    <div className="p-6 text-slate-900">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">매물</h1>
        <Link to="/listings/new" className="px-4 py-2 bg-blue-600 text-white rounded">
          매물 등록
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className="px-3 py-2 border border-slate-300 rounded bg-white"
          value={filter.dealType ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, dealType: e.target.value || undefined }))}
        >
          <option value="">거래유형 전체</option>
          <option value="sale">매매</option>
          <option value="jeonse">전세</option>
          <option value="wolse">월세</option>
        </select>
        <input
          className="px-3 py-2 border border-slate-300 rounded bg-white"
          placeholder="제목·주소 검색"
          value={filter.q ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value || undefined }))}
        />
        <button
          className="px-3 py-2 border border-slate-300 rounded bg-white"
          onClick={() => setView((v) => (v === 'list' ? 'map' : 'list'))}
        >
          {view === 'list' ? '지도 보기' : '목록 보기'}
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-500">불러오는 중...</p>
      ) : view === 'map' ? (
        <KakaoMap
          markers={markers}
          onMarkerClick={(id) => navigate(`/listings/${id}`)}
          className="w-full h-[500px] rounded border border-slate-200"
        />
      ) : listings.length === 0 ? (
        <p className="text-slate-500">매물이 없습니다.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <Link
              key={l.id}
              to={`/listings/${l.id}`}
              className="block border border-slate-200 rounded-lg p-4 bg-white hover:shadow"
            >
              <div className="text-sm text-blue-600">{dealLabels[l.dealType]}</div>
              <div className="font-semibold">{l.title}</div>
              <div className="text-sm text-slate-600">{l.address}</div>
              <div className="text-sm text-slate-500">{l.areaM2}㎡</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
