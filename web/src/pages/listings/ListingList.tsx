import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { Building, Plus, Search, Map as MapIcon, List as ListIcon } from 'lucide-react'
import Button from '../../components/common/Button'
import { listListings, type ListingQuery } from '../../api/listings'
import { KakaoMap, type MapMarker } from '../../components/KakaoMap'

const dealLabels: Record<string, string> = { sale: '매매', jeonse: '전세', wolse: '월세' }
const dealBadgeColors: Record<string, string> = {
  sale: 'bg-hud-accent-primary/20 text-hud-accent-primary',
  jeonse: 'bg-hud-accent-info/20 text-hud-accent-info',
  wolse: 'bg-hud-accent-warning/20 text-hud-accent-warning',
}
const propertyLabels: Record<string, string> = {
  apartment: '아파트', officetel: '오피스텔', house: '주택', commercial: '상가', land: '토지',
}

function formatPrice(l: { dealType: string; salePrice: number | null; deposit: number | null; monthlyRent: number | null }): string {
  const w = (n: number) => {
    if (n >= 100_000_000) {
      const eok = Math.floor(n / 100_000_000)
      const man = Math.floor((n % 100_000_000) / 10_000)
      return man > 0 ? `${eok}억 ${man.toLocaleString()}만` : `${eok}억`
    }
    if (n >= 10_000) return `${Math.floor(n / 10_000).toLocaleString()}만`
    return n.toLocaleString()
  }
  if (l.dealType === 'sale' && l.salePrice != null) return w(l.salePrice)
  if (l.dealType === 'jeonse' && l.deposit != null) return w(l.deposit)
  if (l.dealType === 'wolse' && l.deposit != null && l.monthlyRent != null) {
    return `${w(l.deposit)} / ${w(l.monthlyRent)}`
  }
  return '-'
}

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
    <div className="p-6 text-hud-text-primary">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building size={24} className="text-hud-accent-primary" />
          <h1 className="text-2xl font-bold">매물</h1>
          <span className="text-hud-text-muted text-sm">{data?.total ?? 0}건</span>
        </div>
        <Link to="/listings/new">
          <Button variant="primary" glow leftIcon={<Plus size={16} />}>
            매물 등록
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className="px-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
          value={filter.dealType ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, dealType: e.target.value || undefined }))}
        >
          <option value="">거래유형 전체</option>
          <option value="sale">매매</option>
          <option value="jeonse">전세</option>
          <option value="wolse">월세</option>
        </select>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-text-muted" size={16} />
          <input
            className="w-full pl-10 pr-3 py-2 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
            placeholder="제목·주소 검색"
            value={filter.q ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value || undefined }))}
          />
        </div>
        <Button
          variant="outline"
          leftIcon={view === 'list' ? <MapIcon size={16} /> : <ListIcon size={16} />}
          onClick={() => setView((v) => (v === 'list' ? 'map' : 'list'))}
        >
          {view === 'list' ? '지도 보기' : '목록 보기'}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-hud-text-muted">불러오는 중...</p>
      ) : view === 'map' ? (
        <div className="hud-card rounded-lg overflow-hidden">
          <KakaoMap
            markers={markers}
            onMarkerClick={(id) => navigate(`/listings/${id}`)}
            className="w-full h-[600px]"
          />
        </div>
      ) : listings.length === 0 ? (
        <div className="hud-card rounded-lg p-12 text-center">
          <p className="text-hud-text-muted">매물이 없습니다.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => {
            const photo = l.photos?.[0]
            return (
              <Link
                key={l.id}
                to={`/listings/${l.id}`}
                className="hud-card hud-card-bottom rounded-lg overflow-hidden group hover:border-hud-accent-primary transition-hud"
              >
                <div className="aspect-[16/10] bg-hud-bg-secondary border-b border-hud-border-secondary overflow-hidden">
                  {photo ? (
                    <img src={photo.url} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-hud-text-muted">
                      <Building size={40} />
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${dealBadgeColors[l.dealType]}`}>
                      {dealLabels[l.dealType]}
                    </span>
                    <span className="text-xs text-hud-text-muted">{propertyLabels[l.propertyType]}</span>
                  </div>
                  <h3 className="font-semibold text-hud-text-primary line-clamp-1">{l.title}</h3>
                  <p className="text-sm text-hud-text-secondary line-clamp-1">{l.address}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-hud-accent-primary font-mono text-sm font-semibold">{formatPrice(l)}</span>
                    <span className="text-xs text-hud-text-muted">{l.areaM2}㎡</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
