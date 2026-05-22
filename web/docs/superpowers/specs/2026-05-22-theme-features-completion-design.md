# 테마 시스템 기능 완성 — 설계 문서

작성일: 2026-05-22

## 배경

HUD/Prism 두 테마와 ThemeContext, CSS 변수 시스템이 이미 작동한다. 그러나 다음이 미완성 또는 누락:

- Settings 페이지의 **Accent Color** 스와치와 **Font Size** 버튼은 UI만 있고 onClick 없음
- 자동(시간 기반) 다크/라이트 전환 없음
- 테마가 두 개뿐 (Forest 등 추가 옵션 없음)
- Header에서 빠른 전환 불가 (Settings 페이지 이동 필요)

이 문서는 위 네 가지를 완성하는 설계를 정리한다.

## 결정된 제약

| 항목 | 결정 |
|---|---|
| Accent 아키텍처 | 테마별 5개 preset (B안). 사용자가 임의 색 지정 불가. |
| Auto 전환 트리거 | 시간 기반 (07:00–19:00 → 라이트(prism), 그 외 → 다크(hud)) |
| 3번째 테마 | Forest — 깊은 숲 다크, 황금/에메랄드 액센트 |
| Polish 범위 | Header 원클릭 스위처만. Reduced motion / Reset 버튼 / 트랜지션 강화는 이번 범위 밖. |

## 상태 모델

ThemeContext가 노출하는 prefs:

```ts
type ThemeId = 'hud' | 'prism' | 'forest'
type ThemeMode = 'auto' | ThemeId
type AccentId = string  // 테마별 5개 중 하나
type FontSize = 'sm' | 'md' | 'lg'

interface ThemePrefs {
  mode: ThemeMode
  accent: Record<ThemeId, AccentId>
  fontSize: FontSize
}

interface ThemeContextValue {
  prefs: ThemePrefs
  resolvedTheme: ThemeId           // mode='auto'일 때 시간으로 도출됨
  setMode: (mode: ThemeMode) => void
  setAccent: (theme: ThemeId, accent: AccentId) => void
  setFontSize: (size: FontSize) => void
}
```

`resolvedTheme` 도출 규칙:

- `mode !== 'auto'` → `mode`를 그대로 사용
- `mode === 'auto'` → `getAutoTheme()`:
  - `const h = new Date().getHours()`
  - `7 <= h && h < 19` → `'prism'`
  - 그 외 → `'hud'`
  - Forest는 auto 결과로 절대 선택되지 않음 (사용자 명시 선택 전용)

## 자동 모드 시간 추적

`mode === 'auto'`인 동안 ThemeProvider 내부에서 1분 간격 interval로 `getAutoTheme()` 재계산. 결과가 바뀌면 state 업데이트. mode가 auto 아닌 값으로 바뀌면 interval clear.

엣지 케이스:
- 탭이 백그라운드에서 깨어났을 때 즉시 갱신되도록 `visibilitychange` 리스너로 보조
- 사용자가 시스템 시계를 수동 변경한 경우는 다음 분 단위 tick에서 자연스럽게 따라옴

## CSS 아키텍처

### 두 attribute가 root에 함께 적용

```html
<html data-theme="hud" data-accent="cyan" data-font-size="md">
```

### RGB 트리플렛 패턴으로 알파 파생 통합

기존에는 `--hud-glow-primary: rgba(0, 255, 204, 0.3)`처럼 각 알파 변종을 따로 적었다. Accent preset이 늘어나면 토큰 수가 폭증하므로 RGB 트리플렛을 도입:

```css
[data-theme='hud'] {
  --hud-accent-primary: #00ffcc;
  --hud-accent-primary-rgb: 0 255 204;   /* NEW */
  --hud-on-accent: #0e1726;
  /* ... 기타 base 토큰 ... */

  /* primary 파생은 RGB 트리플렛 + alpha 로 통일 */
  --hud-glow-primary: rgb(var(--hud-accent-primary-rgb) / 0.3);
  --hud-glow-primary-strong: rgb(var(--hud-accent-primary-rgb) / 0.5);
  --hud-text-glow: rgb(var(--hud-accent-primary-rgb) / 0.5);
  --hud-shadow: 0 0 20px rgb(var(--hud-accent-primary-rgb) / 0.1);
  --hud-shadow-glow: 0 0 30px rgb(var(--hud-accent-primary-rgb) / 0.3);
  --hud-scrollbar-thumb: rgb(var(--hud-accent-primary-rgb) / 0.3);
  --hud-scrollbar-thumb-hover: rgb(var(--hud-accent-primary-rgb) / 0.5);
  --hud-card-bracket: rgb(var(--hud-accent-primary-rgb) / 0.5);
  --hud-border-primary: rgb(var(--hud-accent-primary-rgb) / 0.3);
  --hud-menu-active-bg: linear-gradient(90deg, rgb(var(--hud-accent-primary-rgb) / 0.1) 0%, transparent 100%);
  --hud-menu-active-border: var(--hud-accent-primary);
  --hud-chart-glow: rgb(var(--hud-accent-primary-rgb) / 0.3);
  --hud-pulse-glow-start: rgb(var(--hud-accent-primary-rgb) / 0.2);
  --hud-pulse-glow-end: rgb(var(--hud-accent-primary-rgb) / 0.4);
}
```

이렇게 하면 accent preset 한 곳에서 트리플렛만 갈아끼우면 위 13개 파생 토큰이 전부 동시 갱신.

> 참고: `rgb(R G B / A)` 공백 구분 문법은 모던 브라우저 전부에서 지원 (Chrome 65+, Safari 12.1+, Firefox 53+).

### Accent preset 블록 (테마별 5개 × 3 테마 = 15 블록)

각 preset 블록은 단 3개 변수만 override:

```css
[data-theme='hud'][data-accent='cyan'] {
  --hud-accent-primary: #22d3ee;
  --hud-accent-primary-rgb: 34 211 238;
  --hud-on-accent: #001018;
}
```

데모용 preset 정의 (id / hex / on-accent):

**HUD**
- `mint` `#00ffcc` / `#0e1726` (default)
- `cyan` `#22d3ee` / `#001018`
- `lime` `#84cc16` / `#0a1300`
- `gold` `#facc15` / `#1a1500`
- `magenta` `#ec4899` / `#1a0010`

**Prism**
- `magenta` `#d946ef` / `#ffffff` (default)
- `coral` `#ff6b4a` / `#ffffff`
- `sky` `#0ea5e9` / `#ffffff`
- `amber` `#f59e0b` / `#1a1100`
- `violet` `#8b5cf6` / `#ffffff`

**Forest**
- `emerald` `#10b981` / `#04140d` (default)
- `moss` `#65a30d` / `#0a1500`
- `gold` `#eab308` / `#1a1300`
- `pine` `#0f766e` / `#e6f5f2`
- `berry` `#be185d` / `#fff0f5`

`data-accent`가 없거나 default와 동일하면 base 테마 정의값이 그대로 사용됨.

### Forest 베이스 팔레트

```css
[data-theme='forest'] {
  --hud-bg-primary: #0a1410;
  --hud-bg-secondary: #0f1d18;
  --hud-bg-card: rgba(16, 32, 27, 0.85);
  --hud-bg-hover: rgba(34, 65, 52, 0.7);

  --hud-accent-primary: #10b981;
  --hud-accent-primary-rgb: 16 185 129;
  --hud-accent-secondary: #eab308;        /* 황금 액센트 */
  --hud-accent-warning: #f59e0b;
  --hud-accent-info: #14b8a6;
  --hud-accent-success: #84cc16;
  --hud-accent-danger: #dc2626;

  --hud-text-primary: #e8f3ec;
  --hud-text-secondary: #94b4a0;
  --hud-text-muted: #6b8a78;

  --hud-border-secondary: rgba(180, 220, 195, 0.12);
  --hud-on-accent: #04140d;

  --hud-grid-line-1: rgba(16, 185, 129, 0.05);
  --hud-grid-line-2: rgba(234, 179, 8, 0.04);

  /* 토글 토큰 */
  --hud-toggle-track: rgba(180, 220, 195, 0.18);
  --hud-toggle-thumb: #ffffff;

  /* primary 파생 (위 패턴과 동일하게 RGB 기반) */
  /* ... */
}
```

기존 HUD/Prism도 이 RGB 기반 패턴으로 동일하게 리팩토링.

### Font size

```css
html[data-font-size='sm'] { font-size: 14px; }
html[data-font-size='md'] { font-size: 16px; }   /* default */
html[data-font-size='lg'] { font-size: 18px; }
```

Tailwind의 rem 기반 클래스가 모두 자동 스케일된다. 단, hardcoded `px` 사이즈는 영향 안 받음 (의도된 동작 — 아이콘/그리드는 그대로).

## 컴포넌트 동작

### `src/themes/index.ts`

```ts
export type ThemeId = 'hud' | 'prism' | 'forest'
export type ThemeMode = 'auto' | ThemeId
export type FontSize = 'sm' | 'md' | 'lg'

export interface AccentPreset { id: string; name: string; color: string }
export interface ThemeOption {
  id: ThemeId
  name: string
  description: string
  accents: AccentPreset[]      // 첫 번째 = default
}

export const themes: ThemeOption[] = [ /* 3개 정의, 각 5 accents */ ]

export const STORAGE_KEYS = {
  mode: 'hud-admin-theme-mode',
  accent: 'hud-admin-theme-accent',
  fontSize: 'hud-admin-font-size',
  legacy: 'hud-admin-theme',     // 1회 마이그레이션용
}

export function getAutoTheme(): ThemeId {
  const h = new Date().getHours()
  return (h >= 7 && h < 19) ? 'prism' : 'hud'
}

export function applyPrefs(prefs, resolvedTheme) {
  const html = document.documentElement
  html.setAttribute('data-theme', resolvedTheme)
  html.setAttribute('data-accent', prefs.accent[resolvedTheme])
  html.setAttribute('data-font-size', prefs.fontSize)
}

export function getStoredPrefs(): ThemePrefs { /* 마이그레이션 + 기본값 */ }
```

### `src/themes/initTheme.ts`

```ts
import { applyPrefs, getStoredPrefs, getAutoTheme } from './index'

const prefs = getStoredPrefs()
const resolved = prefs.mode === 'auto' ? getAutoTheme() : prefs.mode
applyPrefs(prefs, resolved)
```

(FOUC 방지: 첫 paint 전에 모든 attribute 적용)

### `src/context/ThemeContext.tsx`

- `prefs` state 보유
- `resolvedTheme` useMemo로 도출
- useEffect: prefs 변경 시 attribute 갱신 + localStorage 저장
- useEffect: `mode==='auto'`일 때만 60초 interval + `visibilitychange` 리스너 등록; resolved 변경 시 state 갱신
- `setMode`, `setAccent`, `setFontSize` 노출

### Setter 동작 명세

- `setMode(mode)`: prefs.mode를 그대로 갱신. 다른 prefs는 건드리지 않음.
- `setAccent(theme, accent)`: `prefs.accent[theme]` 갱신. 현재 resolvedTheme과 무관하게 모든 테마에 대해 호출 가능 (UI는 보통 resolvedTheme만 노출하지만 API는 일반화).
- `setFontSize(size)`: 그대로 갱신.

### Auto 토글 동작 (Settings 페이지)

- 토글 OFF로 전환: 현재 `resolvedTheme`(auto가 시간 기준으로 도출한 값)을 mode로 고정. 즉, "지금 보이는 그대로 유지"가 직관적.
- 테마 카드 클릭: 클릭된 테마를 mode로 설정. 결과적으로 auto는 자동 해제됨 (mode가 'auto'가 아니게 되므로).
- 토글 ON으로 전환: mode='auto'로 변경. resolvedTheme이 즉시 재계산됨.

### `src/pages/Settings.tsx` (Appearance 섹션)

레이아웃:

1. **Mode 선택 토글** — `Auto · System time` 토글 스위치. ON이면 mode='auto', OFF면 mode='수동선택된 테마'
2. **Color Theme 카드 그리드** — 3장 (HUD/Prism/Forest). Auto이고 매칭되는 카드에 보조 표시 ("현재 적용 중"). 카드 클릭은 mode를 그 테마로 즉시 설정 (auto 자동 해제됨).
3. **Accent Color** — `resolvedTheme`의 5개 preset 스와치. 현재 선택된 것에 ring. 클릭 시 `setAccent(resolvedTheme, id)`.
4. **Font Size** — Small/Medium/Large 버튼. 현재 활성 상태 표시. 클릭 시 `setFontSize`.

### `src/components/layout/Header.tsx`

알림 종 옆에 **Palette 아이콘 버튼**. 클릭 시 드롭다운:

```
┌──────────────────────────┐
│ 🌓 Auto · Light        ✓ │   ← mode가 auto일 때만 체크
│ ─────────────────────────│
│ ◐ HUD Dark               │
│ ◑ Prism Bright           │
│ 🌲 Forest                │
└──────────────────────────┘
```

- "Auto" 선택 → `setMode('auto')`
- 다른 테마 선택 → `setMode(themeId)`
- 현재 mode에 체크마크. mode가 auto면 Auto 행에 추가로 "· Light" / "· Dark" 부제 표시
- 외부 클릭 시 닫힘 (기존 알림 드롭다운 패턴과 동일)

## 저장 / 마이그레이션

```
localStorage:
  hud-admin-theme-mode      → 'auto' | 'hud' | 'prism' | 'forest'
  hud-admin-theme-accent    → '{"hud":"mint","prism":"magenta","forest":"emerald"}'
  hud-admin-font-size       → 'sm' | 'md' | 'lg'
```

마이그레이션: `getStoredPrefs()`가 새 키들이 모두 없으면 legacy `hud-admin-theme` 읽어와서 mode로 채우고, 채운 후 legacy 키 제거. 한 번만 발생.

기본값:
- mode: `'auto'`
- accent: 각 테마의 첫 번째 preset (mint / magenta / emerald)
- fontSize: `'md'`

## 영향 받는 파일

| 파일 | 변경 성격 |
|---|---|
| `src/themes/index.ts` | 큰 폭 확장 (타입, 메타, resolver, 마이그레이션) |
| `src/themes/initTheme.ts` | 새 applyPrefs 시그니처에 맞춰 갱신 |
| `src/themes/tokens.ts` | 변경 없음 (AccentKey는 차트 팔레트용으로 유지) |
| `src/context/ThemeContext.tsx` | 큰 폭 확장 (prefs 객체, interval, setter 세 개) |
| `src/index.css` | RGB 트리플렛으로 리팩토링 + Forest 블록 + 15 accent preset 블록 + font-size 블록 |
| `src/pages/Settings.tsx` | Appearance 섹션 wiring (mode 토글, 3카드, accent onClick, font onClick) |
| `src/components/layout/Header.tsx` | Palette 드롭다운 추가 |
| `index.html` | `<html data-theme="hud" data-accent="mint" data-font-size="md">` 기본값 설정 |
| `tailwind.config.js` | 변경 없음 |

## 비범위 (명시적으로 안 함)

- 사용자 임의 색 지정 (HEX 입력 / 컬러 피커) — preset만 제공
- Reduced motion 토글
- Reset to defaults 버튼
- 트랜지션 강화 (카드/보더에 transition 추가)
- 일출/일몰 계산 (07-19 고정)
- prefers-color-scheme 미디어 쿼리 (시간 기반으로 의도적으로 대체)
- Forest를 auto 결과에 포함 (사용자 명시 선택 전용)
- 테마별 폰트 family 변경

## 검증 기준

구현 완료 시 다음이 모두 성립:

1. 빌드 통과, TypeScript strict 통과
2. Settings → Appearance에서 3개 테마 카드 모두 동작; Auto 토글 ON/OFF 정상; 각 테마에서 5개 accent 모두 적용됨; Font Size 3단계 시각 변화
3. Header의 Palette 드롭다운에서 4가지 옵션 모두 동작; mode가 auto일 때 부제 "Light"/"Dark" 표시
4. 페이지 리로드 후 직전 prefs 복원 (모든 prefs)
5. mode='auto'에서 시스템 시계를 07시 전후로 변경 시 1분 내 자동 전환
6. legacy `hud-admin-theme` 키만 있는 사용자가 새 빌드 처음 열 때 mode가 그 값으로 마이그레이션됨
7. Forest 테마에서 글자 가독성/contrast 문제 없음
8. accent 변경 시 primary 파생 13개 토큰이 모두 일관되게 갱신 (glow, scrollbar, bracket 등)
