'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemeName = 'hud' | 'light'

export const THEMES: { value: ThemeName; label: string; description: string }[] = [
  { value: 'hud', label: 'HUD 다크', description: '진한 네이비 배경 + 시안 액센트 (기본)' },
  { value: 'light', label: '라이트', description: '회색 배경 + 검정 글씨' },
]

const STORAGE_KEY = 'le-theme'
const DEFAULT_THEME: ThemeName = 'hud'

interface ThemeContextValue {
  theme: ThemeName
  setTheme: (next: ThemeName) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readInitial(): ThemeName {
  if (typeof document === 'undefined') return DEFAULT_THEME
  const fromAttr = document.documentElement.getAttribute('data-theme') as ThemeName | null
  if (fromAttr === 'hud' || fromAttr === 'light') return fromAttr
  return DEFAULT_THEME
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(readInitial)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem(STORAGE_KEY, theme) } catch {}
  }, [theme])

  const setTheme = (next: ThemeName) => {
    setThemeState(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

/**
 * 하이드레이션 전에 실행되어 HTML에 data-theme 속성을 미리 박는 인라인 스크립트.
 * 다크↔라이트 전환 시 플래시 방지.
 */
export const themeBootstrapScript = `
(function(){
  try {
    var t = localStorage.getItem('${STORAGE_KEY}');
    if (t !== 'hud' && t !== 'light') t = '${DEFAULT_THEME}';
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', '${DEFAULT_THEME}');
  }
})();
`.trim()
