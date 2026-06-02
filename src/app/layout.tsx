import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider, themeBootstrapScript } from '@/theme/ThemeContext'

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
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 하이드레이션 전에 data-theme을 박아서 다크/라이트 전환 시 플래시 방지 */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="bg-hud-bg-primary text-hud-text-primary min-h-screen">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
