import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Land Explorer',
  description: '네이버 부동산 탐색 + 내부 매물 관리',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="bg-hud-bg-primary text-hud-text-primary min-h-screen">
        {children}
      </body>
    </html>
  )
}
