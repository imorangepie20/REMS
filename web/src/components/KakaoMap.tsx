import { useEffect, useRef } from 'react'

const KEY = import.meta.env.VITE_KAKAO_MAP_KEY as string | undefined

let sdkPromise: Promise<void> | null = null

/** 카카오맵 SDK를 한 번만 로드한다 */
function loadKakaoSdk(): Promise<void> {
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise<void>((resolve, reject) => {
    if (!KEY) {
      reject(new Error('VITE_KAKAO_MAP_KEY 미설정'))
      return
    }
    if (window.kakao?.maps) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KEY}&autoload=false`
    script.async = true
    script.onload = () => window.kakao.maps.load(() => resolve())
    script.onerror = () => reject(new Error('카카오맵 SDK 로드 실패'))
    document.head.appendChild(script)
  })
  return sdkPromise
}

export interface MapMarker {
  id: number
  lat: number
  lng: number
  title: string
}

interface KakaoMapProps {
  markers: MapMarker[]
  center?: { lat: number; lng: number }
  level?: number
  onMarkerClick?: (id: number) => void
  className?: string
}

const SEOUL = { lat: 37.5665, lng: 126.978 }

export function KakaoMap({
  markers,
  center,
  level = 5,
  onMarkerClick,
  className,
}: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    loadKakaoSdk()
      .then(() => {
        if (cancelled || !containerRef.current) return
        const kakao = window.kakao
        const c = center ?? markers[0] ?? SEOUL
        const map = new kakao.maps.Map(containerRef.current, {
          center: new kakao.maps.LatLng(c.lat, c.lng),
          level,
        })
        markers.forEach((m) => {
          const marker = new kakao.maps.Marker({
            position: new kakao.maps.LatLng(m.lat, m.lng),
            title: m.title,
          })
          marker.setMap(map)
          if (onMarkerClick) {
            kakao.maps.event.addListener(marker, 'click', () => onMarkerClick(m.id))
          }
        })
      })
      .catch((e) => console.warn('지도를 표시할 수 없습니다:', e.message))
    return () => {
      cancelled = true
    }
  }, [markers, center, level, onMarkerClick])

  if (!KEY) {
    return (
      <div className={className ?? 'w-full h-96'}>
        <div className="flex h-full items-center justify-center bg-slate-100 text-slate-500 text-sm">
          카카오맵 키(VITE_KAKAO_MAP_KEY)가 설정되지 않았습니다
        </div>
      </div>
    )
  }
  return <div ref={containerRef} className={className ?? 'w-full h-96'} />
}
