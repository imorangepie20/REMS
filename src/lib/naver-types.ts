export type TradeTypeCode = 'A1' | 'B1' | 'B2'
export type RealEstateTypeCode = 'A01' | 'A02' | 'A03' | 'B03' | 'C01' | 'D01'

export interface RegionEntry {
  legalDivisionNumber: string  // 10자리 법정동 코드
  sido: string                 // 시도명 (예: "경기도")
  sigungu: string              // 시군구명 (예: "수원시 장안구")
  eup: string                  // 읍면동명 (예: "정자동")
  centerLat: number            // 지도 중심 위도
  centerLng: number            // 지도 중심 경도
}

export interface NaverComplex {
  complexNumber: string
  complexName: string
  address: string
  latitude: number | null
  longitude: number | null
  householdCount: number | null
  builtYear: number | null
  complexType: string | null
  totalArticleCount: number | null
}

export interface NaverArticle {
  articleNo: string
  tradeType: TradeTypeCode
  price: number | null         // 매매가 또는 보증금 (원)
  monthlyRent: number | null   // 월세 (원, A1/B1이면 null)
  pyeongName: string | null    // 평형명 "84A" 등
  exclusiveArea: number | null // 전용면적 m²
  floor: string | null         // "15" / "고" / "중" / "저"
  direction: string | null     // "남" 등
  registeredAt: string | null  // ISO date
  brokerName: string | null
}

export interface ComplexesResponse {
  complexes: NaverComplex[]
  total: number
}

export interface ArticlesResponse {
  articles: NaverArticle[]
  total: number
  hasMore: boolean
}
