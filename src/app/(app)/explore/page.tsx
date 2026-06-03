'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Map as MapIcon, Search } from 'lucide-react'
import { RegionPicker } from '@/components/explore/RegionPicker'
import { FilterBar } from '@/components/explore/FilterBar'
import { ComplexList } from '@/components/explore/ComplexList'
import { ArticleTable } from '@/components/explore/ArticleTable'
import { KakaoMap, type MapMarker } from '@/components/KakaoMap'
import Button from '@/components/common/Button'
import { apiFetch } from '@/lib/api-client'
import type {
  RegionEntry, NaverComplex, ComplexesResponse,
  TradeTypeCode, RealEstateTypeCode,
} from '@/lib/naver-types'

const DEFAULT_TRADE: TradeTypeCode[] = ['A1']
const DEFAULT_REAL_ESTATE: RealEstateTypeCode[] = ['A01']

export default function ExplorePage() {
  const params = useSearchParams()
  const router = useRouter()

  const eupCode = params.get('eup') ?? ''
  const tradeTypes = (params.get('trade') || DEFAULT_TRADE.join(',')).split(',').filter(Boolean) as TradeTypeCode[]
  const realEstateTypes = (params.get('realEstate') || DEFAULT_REAL_ESTATE.join(',')).split(',').filter(Boolean) as RealEstateTypeCode[]
  const selectedComplex = params.get('complex')

  const [region, setRegion] = useState<RegionEntry | null>(null)
  const [complexes, setComplexes] = useState<NaverComplex[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // URL의 eupCode로 region 복원 (DB lookup)
  useEffect(() => {
    if (!eupCode) { setRegion(null); return }
    let cancelled = false
    apiFetch<{ regions: RegionEntry[] }>(`/naver/regions?q=${encodeURIComponent(eupCode)}`)
      .then((r) => {
        if (cancelled) return
        const found = r.regions.find((x) => x.legalDivisionNumber === eupCode)
        if (found) setRegion(found)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [eupCode])

  const updateUrl = useCallback((next: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === '') sp.delete(k)
      else sp.set(k, v)
    }
    router.replace(`/explore?${sp.toString()}`)
  }, [params, router])

  const runSearch = useCallback(async () => {
    if (!eupCode) {
      setError('지역을 먼저 선택하세요')
      return
    }
    setLoading(true); setError(null)
    try {
      const qs = new URLSearchParams({
        eupCode,
        trade: tradeTypes.join(','),
        realEstate: realEstateTypes.join(','),
      })
      const r = await apiFetch<ComplexesResponse>(`/naver/complexes?${qs.toString()}`)
      setComplexes(r.complexes)
    } catch (e) {
      setError(e instanceof Error ? e.message : '검색 실패')
      setComplexes([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eupCode, tradeTypes.join(','), realEstateTypes.join(',')])

  const markers: MapMarker[] = complexes
    .filter((c) => c.latitude != null && c.longitude != null)
    .map((c) => ({ id: Number(c.complexNumber), lat: c.latitude!, lng: c.longitude!, title: c.complexName }))
  const mapCenter = region ? { lat: region.centerLat, lng: region.centerLng } : undefined

  const onSelectRegion = (r: RegionEntry) => {
    setRegion(r)
    updateUrl({ eup: r.legalDivisionNumber, complex: undefined })
  }
  const onTradeChange = (next: TradeTypeCode[]) => updateUrl({ trade: next.join(','), complex: undefined })
  const onRealEstateChange = (next: RealEstateTypeCode[]) => updateUrl({ realEstate: next.join(','), complex: undefined })
  const onSelectComplex = (c: NaverComplex) => updateUrl({ complex: c.complexNumber })
  const onMarkerClick = (id: number) => updateUrl({ complex: String(id) })

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-hud-border-secondary p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <RegionPicker selected={region} onSelect={onSelectRegion} />
          <FilterBar
            tradeTypes={tradeTypes}
            onTradeChange={onTradeChange}
            realEstateTypes={realEstateTypes}
            onRealEstateChange={onRealEstateChange}
          />
          <Button
            variant="primary"
            glow
            leftIcon={<Search size={14} />}
            onClick={runSearch}
            disabled={loading || !eupCode}
          >
            {loading ? '검색 중...' : '검색'}
          </Button>
        </div>
        {error && <p className="text-sm text-hud-accent-danger">{error}</p>}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <ComplexList
          complexes={complexes}
          loading={loading}
          selectedComplex={selectedComplex}
          onSelect={onSelectComplex}
        />
        <div className="flex-1 relative">
          {markers.length === 0 && !loading && (
            <div className="absolute inset-0 flex items-center justify-center text-hud-text-muted text-sm">
              <MapIcon size={16} className="mr-2" />
              {eupCode
                ? '"검색" 버튼을 눌러 단지를 불러오세요'
                : '지역을 선택하고 "검색" 버튼을 누르세요'}
            </div>
          )}
          <KakaoMap markers={markers} center={mapCenter} onMarkerClick={onMarkerClick} className="w-full h-full" />
        </div>
      </div>

      {selectedComplex && (
        <ArticleTable
          complexNumber={selectedComplex}
          tradeTypes={tradeTypes}
        />
      )}
    </div>
  )
}
