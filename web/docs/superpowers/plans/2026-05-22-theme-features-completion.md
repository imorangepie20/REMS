# Theme Features Completion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the unfinished theme system features — wire Accent Color picker and Font Size, add time-based auto switching, add a third "Forest" theme, and a Header palette dropdown.

**Architecture:** Two HTML data attributes (`data-theme`, `data-accent`) on `<html>` drive the CSS variable cascade. A new RGB triplet token (`--hud-accent-primary-rgb`) is the single source from which 13 alpha-of-primary derivatives are computed via `rgb(R G B / A)` — so accent presets only need to override 3 variables. `data-font-size` controls root `font-size` for rem-based scaling. ThemeProvider owns a single `ThemePrefs` object and computes `resolvedTheme` from mode (with a 60s interval for `mode='auto'`).

**Tech Stack:** React 18 + TypeScript + Vite 6 + Tailwind 3 (existing). No test framework in repo — verification is via `tsc --noEmit`, `vite build`, and manual dev-server smoke tests.

**Spec reference:** [docs/superpowers/specs/2026-05-22-theme-features-completion-design.md](../specs/2026-05-22-theme-features-completion-design.md)

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/themes/index.ts` | Types, theme/accent metadata, storage helpers, time resolver, applyPrefs | Rewrite |
| `src/themes/initTheme.ts` | Boot-time attribute application (FOUC prevention) | Rewrite (small) |
| `src/themes/tokens.ts` | Chart palette AccentKey list (unchanged) | No change |
| `src/context/ThemeContext.tsx` | Prefs state, resolvedTheme derivation, auto interval, setters | Rewrite |
| `src/index.css` | All CSS variables, accent preset blocks, font-size blocks | Refactor + add Forest + add 12 preset blocks + add font-size blocks |
| `src/pages/Settings.tsx` | Appearance section wiring (mode toggle, 3 theme cards, accent click, font click) | Rewrite Appearance section |
| `src/components/layout/Header.tsx` | New Palette dropdown next to notifications | Add dropdown |
| `index.html` | Default `<html>` data attributes | Update line 2 |

---

## Task 1: Foundation — Types, Theme Metadata, Storage Helpers

**Files:**
- Rewrite: `src/themes/index.ts`

**Goal:** Define all types and theme/accent metadata. Provide `getStoredPrefs()` with one-time legacy migration. Provide `applyPrefs()` that sets all three data attributes. Keep legacy `applyTheme(theme)`, `getStoredTheme()`, `THEME_STORAGE_KEY` exports as shims so `ThemeContext.tsx` (untouched until Task 2) still compiles. Keep `preview` field on `ThemeOption` (derived from `accents`) so `Settings.tsx` (untouched until Task 5) still compiles.

- [ ] **Step 1: Rewrite `src/themes/index.ts`**

```ts
export type ThemeId = 'hud' | 'prism' | 'forest'
export type ThemeMode = 'auto' | ThemeId
export type FontSize = 'sm' | 'md' | 'lg'

export interface AccentPreset {
    id: string
    name: string
    color: string
}

export interface ThemeOption {
    id: ThemeId
    name: string
    description: string
    accents: AccentPreset[]
    /** Legacy field — derived from accents. To be removed when Settings is rewritten. */
    preview: string[]
}

export interface ThemePrefs {
    mode: ThemeMode
    accent: Record<ThemeId, string>
    fontSize: FontSize
}

const hudAccents: AccentPreset[] = [
    { id: 'mint', name: 'Mint', color: '#00ffcc' },
    { id: 'cyan', name: 'Cyan', color: '#22d3ee' },
    { id: 'lime', name: 'Lime', color: '#84cc16' },
    { id: 'gold', name: 'Gold', color: '#facc15' },
    { id: 'magenta', name: 'Magenta', color: '#ec4899' },
]

const prismAccents: AccentPreset[] = [
    { id: 'magenta', name: 'Magenta', color: '#d946ef' },
    { id: 'coral', name: 'Coral', color: '#ff6b4a' },
    { id: 'sky', name: 'Sky', color: '#0ea5e9' },
    { id: 'amber', name: 'Amber', color: '#f59e0b' },
    { id: 'violet', name: 'Violet', color: '#8b5cf6' },
]

const forestAccents: AccentPreset[] = [
    { id: 'emerald', name: 'Emerald', color: '#10b981' },
    { id: 'moss', name: 'Moss', color: '#65a30d' },
    { id: 'gold', name: 'Gold', color: '#eab308' },
    { id: 'pine', name: 'Pine', color: '#0f766e' },
    { id: 'berry', name: 'Berry', color: '#be185d' },
]

export const themes: ThemeOption[] = [
    {
        id: 'hud',
        name: 'HUD Dark',
        description: '네온 악센트의 다크 HUD 스타일',
        accents: hudAccents,
        preview: hudAccents.map((a) => a.color),
    },
    {
        id: 'prism',
        name: 'Prism Bright',
        description: '화려하고 밝은 프리즘 컬러 톤',
        accents: prismAccents,
        preview: prismAccents.map((a) => a.color),
    },
    {
        id: 'forest',
        name: 'Forest',
        description: '깊은 숲의 다크 — 황금/에메랄드 액센트',
        accents: forestAccents,
        preview: forestAccents.map((a) => a.color),
    },
]

export const STORAGE_KEYS = {
    mode: 'hud-admin-theme-mode',
    accent: 'hud-admin-theme-accent',
    fontSize: 'hud-admin-font-size',
    legacy: 'hud-admin-theme',
} as const

/** Legacy export — kept until Task 2 rewrites ThemeContext. */
export const THEME_STORAGE_KEY = STORAGE_KEYS.legacy

const THEME_IDS: ThemeId[] = ['hud', 'prism', 'forest']
const MODE_VALUES: ThemeMode[] = ['auto', 'hud', 'prism', 'forest']
const FONT_SIZES: FontSize[] = ['sm', 'md', 'lg']

export function isThemeId(value: unknown): value is ThemeId {
    return typeof value === 'string' && (THEME_IDS as string[]).includes(value)
}

export function isMode(value: unknown): value is ThemeMode {
    return typeof value === 'string' && (MODE_VALUES as string[]).includes(value)
}

export function isFontSize(value: unknown): value is FontSize {
    return typeof value === 'string' && (FONT_SIZES as string[]).includes(value)
}

export function getAutoTheme(now: Date = new Date()): ThemeId {
    const h = now.getHours()
    return h >= 7 && h < 19 ? 'prism' : 'hud'
}

function defaultAccents(): Record<ThemeId, string> {
    return {
        hud: hudAccents[0].id,
        prism: prismAccents[0].id,
        forest: forestAccents[0].id,
    }
}

function defaultPrefs(): ThemePrefs {
    return { mode: 'auto', accent: defaultAccents(), fontSize: 'md' }
}

function validAccentForTheme(theme: ThemeId, id: unknown): string {
    const presets = themes.find((t) => t.id === theme)?.accents ?? []
    const fallback = presets[0]?.id ?? ''
    if (typeof id !== 'string') return fallback
    return presets.some((p) => p.id === id) ? id : fallback
}

function parseAccent(raw: string | null): Record<ThemeId, string> {
    const def = defaultAccents()
    if (!raw) return def
    try {
        const obj = JSON.parse(raw) as Partial<Record<ThemeId, unknown>>
        return {
            hud: validAccentForTheme('hud', obj.hud) || def.hud,
            prism: validAccentForTheme('prism', obj.prism) || def.prism,
            forest: validAccentForTheme('forest', obj.forest) || def.forest,
        }
    } catch {
        return def
    }
}

export function getStoredPrefs(): ThemePrefs {
    try {
        const modeRaw = localStorage.getItem(STORAGE_KEYS.mode)
        const accentRaw = localStorage.getItem(STORAGE_KEYS.accent)
        const fontRaw = localStorage.getItem(STORAGE_KEYS.fontSize)

        const noNewKeys = modeRaw === null && accentRaw === null && fontRaw === null
        if (noNewKeys) {
            const legacy = localStorage.getItem(STORAGE_KEYS.legacy)
            if (isThemeId(legacy)) {
                const migrated: ThemePrefs = {
                    mode: legacy,
                    accent: defaultAccents(),
                    fontSize: 'md',
                }
                savePrefs(migrated)
                localStorage.removeItem(STORAGE_KEYS.legacy)
                return migrated
            }
        }

        return {
            mode: isMode(modeRaw) ? modeRaw : 'auto',
            accent: parseAccent(accentRaw),
            fontSize: isFontSize(fontRaw) ? fontRaw : 'md',
        }
    } catch {
        return defaultPrefs()
    }
}

export function savePrefs(prefs: ThemePrefs) {
    try {
        localStorage.setItem(STORAGE_KEYS.mode, prefs.mode)
        localStorage.setItem(STORAGE_KEYS.accent, JSON.stringify(prefs.accent))
        localStorage.setItem(STORAGE_KEYS.fontSize, prefs.fontSize)
    } catch {
        // ignore quota / private-mode errors
    }
}

export function resolveTheme(prefs: ThemePrefs, now?: Date): ThemeId {
    return prefs.mode === 'auto' ? getAutoTheme(now) : prefs.mode
}

export function applyPrefs(prefs: ThemePrefs, resolved: ThemeId) {
    const html = document.documentElement
    html.setAttribute('data-theme', resolved)
    html.setAttribute('data-accent', prefs.accent[resolved])
    html.setAttribute('data-font-size', prefs.fontSize)
}

/** Legacy shim — kept until Task 2 rewrites ThemeContext to use the prefs API. */
export function applyTheme(theme: ThemeId) {
    const prefs = getStoredPrefs()
    const next: ThemePrefs = { ...prefs, mode: theme }
    savePrefs(next)
    applyPrefs(next, theme)
}

/** Legacy shim — kept until Task 2. Returns the user-selected mode if it's a concrete theme, else current auto resolution. */
export function getStoredTheme(): ThemeId {
    const prefs = getStoredPrefs()
    return resolveTheme(prefs)
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: exit code 0, no output.

- [ ] **Step 3: Build**

Run: `npx vite build`
Expected: `✓ built in ...`. No errors.

- [ ] **Step 4: Manual smoke test**

Run dev server: `npx vite --port 12000` (in background) and open http://localhost:12000/settings → Appearance.
Expected: 3 theme cards now visible (HUD Dark, Prism Bright, Forest). HUD card shows mint/cyan/lime/gold/magenta swatches. Clicking Forest changes `<html>` attribute but visual stays HUD-ish (no CSS yet) — that's fine. Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add src/themes/index.ts
git commit -m "feat(theme): types and metadata for 3 themes with accent presets"
```

---

## Task 2: Rewrite ThemeContext with Full Prefs API

**Files:**
- Rewrite: `src/context/ThemeContext.tsx`

**Goal:** Replace single-theme state with `ThemePrefs` object. Compute `resolvedTheme`. Run a 60-second interval for `mode === 'auto'` (cleared otherwise). Listen to `visibilitychange` to catch wake-from-background. Expose new setters (`setMode`, `setAccent`, `setFontSize`) AND legacy `{ theme, setTheme }` shim so `Settings.tsx` (rewritten in Task 5) keeps compiling.

- [ ] **Step 1: Rewrite `src/context/ThemeContext.tsx`**

```tsx
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react'
import {
    applyPrefs,
    getStoredPrefs,
    resolveTheme,
    savePrefs,
    type FontSize,
    type ThemeId,
    type ThemeMode,
    type ThemePrefs,
} from '../themes'

interface ThemeContextValue {
    prefs: ThemePrefs
    resolvedTheme: ThemeId
    setMode: (mode: ThemeMode) => void
    setAccent: (theme: ThemeId, accent: string) => void
    setFontSize: (size: FontSize) => void
    /** Legacy alias for resolvedTheme — kept until Task 5. */
    theme: ThemeId
    /** Legacy alias for setMode — kept until Task 5. */
    setTheme: (theme: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const AUTO_INTERVAL_MS = 60_000

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [prefs, setPrefs] = useState<ThemePrefs>(getStoredPrefs)
    const [autoTick, setAutoTick] = useState(0)

    const resolvedTheme = useMemo(
        () => resolveTheme(prefs),
        // autoTick deliberately included so getHours() is re-read on each tick
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [prefs, autoTick],
    )

    // Apply attributes + persist on any prefs change
    useEffect(() => {
        applyPrefs(prefs, resolvedTheme)
        savePrefs(prefs)
    }, [prefs, resolvedTheme])

    // Auto-mode interval + visibility re-check
    const tickRef = useRef<number | null>(null)
    useEffect(() => {
        if (prefs.mode !== 'auto') {
            if (tickRef.current !== null) {
                window.clearInterval(tickRef.current)
                tickRef.current = null
            }
            return
        }
        tickRef.current = window.setInterval(() => {
            setAutoTick((t) => t + 1)
        }, AUTO_INTERVAL_MS)
        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                setAutoTick((t) => t + 1)
            }
        }
        document.addEventListener('visibilitychange', onVisible)
        return () => {
            if (tickRef.current !== null) {
                window.clearInterval(tickRef.current)
                tickRef.current = null
            }
            document.removeEventListener('visibilitychange', onVisible)
        }
    }, [prefs.mode])

    const setMode = useCallback((mode: ThemeMode) => {
        setPrefs((p) => ({ ...p, mode }))
    }, [])

    const setAccent = useCallback((theme: ThemeId, accent: string) => {
        setPrefs((p) => ({ ...p, accent: { ...p.accent, [theme]: accent } }))
    }, [])

    const setFontSize = useCallback((size: FontSize) => {
        setPrefs((p) => ({ ...p, fontSize: size }))
    }, [])

    const setTheme = useCallback(
        (t: ThemeId) => {
            setMode(t)
        },
        [setMode],
    )

    const value: ThemeContextValue = {
        prefs,
        resolvedTheme,
        setMode,
        setAccent,
        setFontSize,
        theme: resolvedTheme,
        setTheme,
    }

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
    const ctx = useContext(ThemeContext)
    if (!ctx) {
        throw new Error('useTheme must be used within ThemeProvider')
    }
    return ctx
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: exit code 0. (`Settings.tsx` still uses `{ theme, setTheme }` which we preserved as legacy alias.)

- [ ] **Step 3: Build**

Run: `npx vite build`
Expected: success.

- [ ] **Step 4: Manual smoke test**

Run: `npx vite --port 12000` and open the app. Open DevTools → Application → Local Storage and clear `hud-admin-theme*` keys, then reload.
Expected: `<html>` has `data-theme="hud"|"prism"` (depending on current hour ≥7 && <19), `data-accent="mint"|"magenta"`, `data-font-size="md"`. Local storage shows three keys: `hud-admin-theme-mode='auto'`, `hud-admin-theme-accent` (JSON), `hud-admin-font-size='md'`. Existing theme toggle in Settings still flips between HUD and Prism.

Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add src/context/ThemeContext.tsx
git commit -m "feat(theme): ThemeContext owns full prefs with auto-mode interval"
```

---

## Task 3: CSS Refactor — RGB Triplet for HUD and Prism Base Themes

**Files:**
- Modify: `src/index.css` (HUD `:root,[data-theme='hud']` block and `[data-theme='prism']` block)

**Goal:** Introduce `--hud-accent-primary-rgb` to both themes. Replace 13 alpha-of-primary tokens with `rgb(var(--hud-accent-primary-rgb) / A)` form. Visual result must be identical (verify by eye). This is a pure refactor — no Forest, no presets, no font-size yet.

Tokens to convert in **HUD** (primary = #00ffcc → `0 255 204`):
- `--hud-border-primary`
- `--hud-grid-line-1`, `--hud-grid-line-2`
- `--hud-card-bracket`
- `--hud-scrollbar-thumb`, `--hud-scrollbar-thumb-hover`
- `--hud-shadow`, `--hud-shadow-glow`
- `--hud-glow-primary`, `--hud-glow-primary-strong`
- `--hud-text-glow`
- `--hud-menu-active-bg` (gradient stop)
- `--hud-chart-glow`
- `--hud-pulse-glow-start`, `--hud-pulse-glow-end`

Tokens to convert in **Prism** (primary = #d946ef → `217 70 239`):
Only the subset of Prism tokens that already use rgba(217, 70, 239, …):
- `--hud-border-primary`
- `--hud-grid-line-1` (uses 217,70,239 — converted; `--hud-grid-line-2` uses 14,165,233 which is info — leave as-is)
- `--hud-scrollbar-thumb`, `--hud-scrollbar-thumb-hover` (note thumb-hover uses coral in Prism — leave as-is if so)
- `--hud-shadow`, `--hud-shadow-glow`
- `--hud-glow-primary`, `--hud-glow-primary-strong`
- `--hud-text-glow`
- `--hud-menu-active-bg` (first gradient stop only — second stop uses info)
- `--hud-pulse-glow-start` (uses 217,70,239)

**Do not touch**: `--hud-chart-glow` (info-based in Prism), `--hud-card-bracket` (coral in Prism), `--hud-shadow-pink` (pink/coral), `--hud-glow-info`, `--hud-glow-orange`, etc.

- [ ] **Step 1: Edit HUD block in `src/index.css`**

Inside the `:root, [data-theme='hud']` block, add the RGB triplet immediately after `--hud-accent-primary` and replace the listed tokens. Resulting block (relevant lines only):

```css
:root,
[data-theme='hud'] {
  --hud-bg-primary: #0e1726;
  --hud-bg-secondary: #141b2d;
  --hud-bg-card: rgba(20, 27, 45, 0.8);
  --hud-bg-hover: rgba(30, 40, 60, 0.9);
  --hud-accent-primary: #00ffcc;
  --hud-accent-primary-rgb: 0 255 204;
  --hud-accent-secondary: #ff1493;
  --hud-accent-warning: #ffa500;
  --hud-accent-info: #6366f1;
  --hud-accent-success: #10b981;
  --hud-accent-danger: #ef4444;
  --hud-text-primary: #ffffff;
  --hud-text-secondary: #a0aec0;
  --hud-text-muted: #64748b;
  --hud-border-primary: rgb(var(--hud-accent-primary-rgb) / 0.3);
  --hud-border-secondary: rgba(255, 255, 255, 0.1);
  --hud-on-accent: #0e1726;
  --hud-grid-line-1: rgb(var(--hud-accent-primary-rgb) / 0.03);
  --hud-grid-line-2: rgb(var(--hud-accent-primary-rgb) / 0.03);
  --hud-card-bracket: rgb(var(--hud-accent-primary-rgb) / 0.5);
  --hud-scrollbar-track: rgba(20, 27, 45, 0.5);
  --hud-scrollbar-thumb: rgb(var(--hud-accent-primary-rgb) / 0.3);
  --hud-scrollbar-thumb-hover: rgb(var(--hud-accent-primary-rgb) / 0.5);
  --hud-shadow: 0 0 20px rgb(var(--hud-accent-primary-rgb) / 0.1);
  --hud-shadow-glow: 0 0 30px rgb(var(--hud-accent-primary-rgb) / 0.3);
  --hud-shadow-pink: 0 0 20px rgba(255, 20, 147, 0.3);
  --hud-glow-primary: rgb(var(--hud-accent-primary-rgb) / 0.3);
  --hud-glow-pink: rgba(255, 20, 147, 0.3);
  --hud-glow-orange: rgba(255, 165, 0, 0.3);
  --hud-text-glow: rgb(var(--hud-accent-primary-rgb) / 0.5);
  --hud-menu-active-bg: linear-gradient(90deg, rgb(var(--hud-accent-primary-rgb) / 0.1) 0%, transparent 100%);
  --hud-menu-active-border: var(--hud-accent-primary);
  --hud-chart-glow: rgb(var(--hud-accent-primary-rgb) / 0.3);
  --hud-pulse-glow-start: rgb(var(--hud-accent-primary-rgb) / 0.2);
  --hud-pulse-glow-end: rgb(var(--hud-accent-primary-rgb) / 0.4);
  --hud-chart-track: rgba(255, 255, 255, 0.1);
  --hud-glow-primary-strong: rgb(var(--hud-accent-primary-rgb) / 0.5);
  --hud-glow-info: rgba(99, 102, 241, 0.3);
  --hud-glow-info-strong: rgba(99, 102, 241, 0.5);
  --hud-overlay-bg: rgba(0, 0, 0, 0.85);
  --hud-overlay-text: #ffffff;
  --hud-overlay-text-muted: rgba(255, 255, 255, 0.6);
  --hud-overlay-control: rgba(255, 255, 255, 0.1);
  --hud-overlay-control-hover: rgba(255, 255, 255, 0.2);
  --hud-surface-elevated: rgba(20, 27, 45, 0.95);
  --hud-surface-muted: rgba(30, 40, 60, 0.6);
  --hud-media-chrome-bg: rgba(24, 24, 24, 0.95);
  --hud-media-chrome-text: #ffffff;
  --hud-media-chrome-muted: rgba(255, 255, 255, 0.5);
  --hud-media-chrome-track: rgba(255, 255, 255, 0.1);
  --hud-media-chrome-art: rgba(34, 34, 34, 1);
  --hud-media-chrome-play-bg: #ffffff;
  --hud-media-chrome-play-text: #0e1726;
  --hud-toggle-track: rgba(255, 255, 255, 0.18);
  --hud-toggle-thumb: #ffffff;
}
```

- [ ] **Step 2: Edit Prism block in `src/index.css`**

```css
[data-theme='prism'] {
  --hud-bg-primary: #fff5fa;
  --hud-bg-secondary: #ffffff;
  --hud-bg-card: rgba(255, 255, 255, 0.92);
  --hud-bg-hover: rgba(217, 70, 239, 0.1);
  --hud-accent-primary: #d946ef;
  --hud-accent-primary-rgb: 217 70 239;
  --hud-accent-secondary: #ff6b4a;
  --hud-accent-warning: #f59e0b;
  --hud-accent-info: #0ea5e9;
  --hud-accent-success: #10b981;
  --hud-accent-danger: #f43f5e;
  --hud-text-primary: #1e1b4b;
  --hud-text-secondary: #5b21b6;
  --hud-text-muted: #7c6f9a;
  --hud-border-primary: rgb(var(--hud-accent-primary-rgb) / 0.45);
  --hud-border-secondary: rgba(30, 27, 75, 0.12);
  --hud-on-accent: #ffffff;
  --hud-grid-line-1: rgb(var(--hud-accent-primary-rgb) / 0.08);
  --hud-grid-line-2: rgba(14, 165, 233, 0.08);
  --hud-card-bracket: rgba(255, 107, 74, 0.65);
  --hud-scrollbar-track: rgb(var(--hud-accent-primary-rgb) / 0.08);
  --hud-scrollbar-thumb: rgb(var(--hud-accent-primary-rgb) / 0.35);
  --hud-scrollbar-thumb-hover: rgba(255, 107, 74, 0.55);
  --hud-shadow: 0 4px 24px rgb(var(--hud-accent-primary-rgb) / 0.12);
  --hud-shadow-glow: 0 0 32px rgb(var(--hud-accent-primary-rgb) / 0.28);
  --hud-shadow-pink: 0 0 24px rgba(255, 107, 74, 0.28);
  --hud-glow-primary: rgb(var(--hud-accent-primary-rgb) / 0.35);
  --hud-glow-pink: rgba(255, 107, 74, 0.35);
  --hud-glow-orange: rgba(245, 158, 11, 0.35);
  --hud-text-glow: rgb(var(--hud-accent-primary-rgb) / 0.4);
  --hud-menu-active-bg: linear-gradient(90deg, rgb(var(--hud-accent-primary-rgb) / 0.14) 0%, rgba(14, 165, 233, 0.06) 100%);
  --hud-menu-active-border: var(--hud-accent-primary);
  --hud-chart-glow: rgba(14, 165, 233, 0.35);
  --hud-pulse-glow-start: rgb(var(--hud-accent-primary-rgb) / 0.2);
  --hud-pulse-glow-end: rgba(255, 107, 74, 0.35);
  --hud-chart-track: rgba(30, 27, 75, 0.12);
  --hud-glow-primary-strong: rgb(var(--hud-accent-primary-rgb) / 0.45);
  --hud-glow-info: rgba(14, 165, 233, 0.35);
  --hud-glow-info-strong: rgba(14, 165, 233, 0.5);
  --hud-overlay-bg: rgba(30, 27, 75, 0.88);
  --hud-overlay-text: #ffffff;
  --hud-overlay-text-muted: rgba(255, 255, 255, 0.75);
  --hud-overlay-control: rgba(255, 255, 255, 0.15);
  --hud-overlay-control-hover: rgba(255, 255, 255, 0.25);
  --hud-surface-elevated: rgba(255, 255, 255, 0.96);
  --hud-surface-muted: rgb(var(--hud-accent-primary-rgb) / 0.08);
  --hud-media-chrome-bg: rgba(30, 27, 75, 0.94);
  --hud-media-chrome-text: #ffffff;
  --hud-media-chrome-muted: rgba(255, 255, 255, 0.55);
  --hud-media-chrome-track: rgba(255, 255, 255, 0.12);
  --hud-media-chrome-art: rgba(49, 46, 129, 1);
  --hud-media-chrome-play-bg: #ffffff;
  --hud-media-chrome-play-text: #1e1b4b;
  --hud-toggle-track: rgba(30, 27, 75, 0.22);
  --hud-toggle-thumb: #ffffff;
}
```

- [ ] **Step 3: Build**

Run: `npx vite build`
Expected: success.

- [ ] **Step 4: Manual visual regression check**

Run: `npx vite --port 12000`. Open http://localhost:12000/. Verify Dashboard looks identical to before in HUD. Click into Settings → Appearance, switch to Prism, verify Prism also looks identical. The brackets, glows, scrollbars, button hover glows must visually match the previous behavior.

Pay attention to:
- Card corner brackets (top + bottom)
- Menu-active gradient on sidebar
- Scrollbar color on long pages
- Chart-glow on Widgets/Analytics circular progress
- HudCard shadow

Stop dev server when satisfied.

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "refactor(css): derive primary alpha tokens from RGB triplet"
```

---

## Task 4: Forest Theme + 12 Accent Preset Blocks + Font-Size Blocks

**Files:**
- Modify: `src/index.css` (append after Prism block; keep existing global styles below)

**Goal:** Add Forest base palette, all 12 non-default accent preset overrides (4 per theme — the first preset of each theme is the default and matches base), and the 3 font-size rules.

- [ ] **Step 1: Append Forest base block in `src/index.css`**

Insert immediately after the closing `}` of `[data-theme='prism']` and before the `/* Global Styles */` block:

```css
/* ── Forest: 깊은 숲 다크 ── */
[data-theme='forest'] {
  --hud-bg-primary: #0a1410;
  --hud-bg-secondary: #0f1d18;
  --hud-bg-card: rgba(16, 32, 27, 0.85);
  --hud-bg-hover: rgba(34, 65, 52, 0.7);
  --hud-accent-primary: #10b981;
  --hud-accent-primary-rgb: 16 185 129;
  --hud-accent-secondary: #eab308;
  --hud-accent-warning: #f59e0b;
  --hud-accent-info: #14b8a6;
  --hud-accent-success: #84cc16;
  --hud-accent-danger: #dc2626;
  --hud-text-primary: #e8f3ec;
  --hud-text-secondary: #94b4a0;
  --hud-text-muted: #6b8a78;
  --hud-border-primary: rgb(var(--hud-accent-primary-rgb) / 0.3);
  --hud-border-secondary: rgba(180, 220, 195, 0.12);
  --hud-on-accent: #04140d;
  --hud-grid-line-1: rgb(var(--hud-accent-primary-rgb) / 0.05);
  --hud-grid-line-2: rgba(234, 179, 8, 0.04);
  --hud-card-bracket: rgba(234, 179, 8, 0.55);
  --hud-scrollbar-track: rgba(15, 29, 24, 0.5);
  --hud-scrollbar-thumb: rgb(var(--hud-accent-primary-rgb) / 0.3);
  --hud-scrollbar-thumb-hover: rgb(var(--hud-accent-primary-rgb) / 0.5);
  --hud-shadow: 0 0 20px rgb(var(--hud-accent-primary-rgb) / 0.1);
  --hud-shadow-glow: 0 0 30px rgb(var(--hud-accent-primary-rgb) / 0.3);
  --hud-shadow-pink: 0 0 20px rgba(234, 179, 8, 0.3);
  --hud-glow-primary: rgb(var(--hud-accent-primary-rgb) / 0.3);
  --hud-glow-pink: rgba(234, 179, 8, 0.3);
  --hud-glow-orange: rgba(245, 158, 11, 0.3);
  --hud-text-glow: rgb(var(--hud-accent-primary-rgb) / 0.5);
  --hud-menu-active-bg: linear-gradient(90deg, rgb(var(--hud-accent-primary-rgb) / 0.12) 0%, transparent 100%);
  --hud-menu-active-border: var(--hud-accent-primary);
  --hud-chart-glow: rgb(var(--hud-accent-primary-rgb) / 0.3);
  --hud-pulse-glow-start: rgb(var(--hud-accent-primary-rgb) / 0.2);
  --hud-pulse-glow-end: rgb(var(--hud-accent-primary-rgb) / 0.4);
  --hud-chart-track: rgba(232, 243, 236, 0.1);
  --hud-glow-primary-strong: rgb(var(--hud-accent-primary-rgb) / 0.5);
  --hud-glow-info: rgba(20, 184, 166, 0.3);
  --hud-glow-info-strong: rgba(20, 184, 166, 0.5);
  --hud-overlay-bg: rgba(0, 10, 6, 0.88);
  --hud-overlay-text: #ffffff;
  --hud-overlay-text-muted: rgba(255, 255, 255, 0.65);
  --hud-overlay-control: rgba(255, 255, 255, 0.12);
  --hud-overlay-control-hover: rgba(255, 255, 255, 0.22);
  --hud-surface-elevated: rgba(15, 29, 24, 0.95);
  --hud-surface-muted: rgba(34, 65, 52, 0.5);
  --hud-media-chrome-bg: rgba(18, 28, 22, 0.95);
  --hud-media-chrome-text: #ffffff;
  --hud-media-chrome-muted: rgba(255, 255, 255, 0.55);
  --hud-media-chrome-track: rgba(255, 255, 255, 0.1);
  --hud-media-chrome-art: rgba(28, 44, 36, 1);
  --hud-media-chrome-play-bg: #ffffff;
  --hud-media-chrome-play-text: #04140d;
  --hud-toggle-track: rgba(180, 220, 195, 0.18);
  --hud-toggle-thumb: #ffffff;
}
```

- [ ] **Step 2: Append accent preset blocks (12 total)**

Immediately after the Forest block:

```css
/* ── Accent presets (default preset of each theme matches base; only non-default overrides listed) ── */

[data-theme='hud'][data-accent='cyan']    { --hud-accent-primary: #22d3ee; --hud-accent-primary-rgb: 34 211 238;  --hud-on-accent: #001018; }
[data-theme='hud'][data-accent='lime']    { --hud-accent-primary: #84cc16; --hud-accent-primary-rgb: 132 204 22;  --hud-on-accent: #0a1300; }
[data-theme='hud'][data-accent='gold']    { --hud-accent-primary: #facc15; --hud-accent-primary-rgb: 250 204 21;  --hud-on-accent: #1a1500; }
[data-theme='hud'][data-accent='magenta'] { --hud-accent-primary: #ec4899; --hud-accent-primary-rgb: 236 72 153;  --hud-on-accent: #1a0010; }

[data-theme='prism'][data-accent='coral']  { --hud-accent-primary: #ff6b4a; --hud-accent-primary-rgb: 255 107 74;  --hud-on-accent: #ffffff; }
[data-theme='prism'][data-accent='sky']    { --hud-accent-primary: #0ea5e9; --hud-accent-primary-rgb: 14 165 233;  --hud-on-accent: #ffffff; }
[data-theme='prism'][data-accent='amber']  { --hud-accent-primary: #f59e0b; --hud-accent-primary-rgb: 245 158 11;  --hud-on-accent: #1a1100; }
[data-theme='prism'][data-accent='violet'] { --hud-accent-primary: #8b5cf6; --hud-accent-primary-rgb: 139 92 246;  --hud-on-accent: #ffffff; }

[data-theme='forest'][data-accent='moss']  { --hud-accent-primary: #65a30d; --hud-accent-primary-rgb: 101 163 13;  --hud-on-accent: #0a1500; }
[data-theme='forest'][data-accent='gold']  { --hud-accent-primary: #eab308; --hud-accent-primary-rgb: 234 179 8;   --hud-on-accent: #1a1300; }
[data-theme='forest'][data-accent='pine']  { --hud-accent-primary: #0f766e; --hud-accent-primary-rgb: 15 118 110;  --hud-on-accent: #e6f5f2; }
[data-theme='forest'][data-accent='berry'] { --hud-accent-primary: #be185d; --hud-accent-primary-rgb: 190 24 93;   --hud-on-accent: #fff0f5; }
```

- [ ] **Step 3: Append font-size rules**

Immediately after the accent preset blocks:

```css
/* ── Font size scale (rem-based Tailwind classes scale automatically) ── */
html[data-font-size='sm'] { font-size: 14px; }
html[data-font-size='md'] { font-size: 16px; }
html[data-font-size='lg'] { font-size: 18px; }
```

- [ ] **Step 4: Build**

Run: `npx vite build`
Expected: success. Confirm CSS size grew (was ~43 kB; expect ~45–47 kB).

- [ ] **Step 5: Manual smoke test**

Run: `npx vite --port 12000`. In DevTools console, run:
```js
document.documentElement.setAttribute('data-theme', 'forest')
```
Expected: page turns deep green-dark with emerald accents, golden card brackets visible. Cards, sidebar, header all look coherent and readable.

Then test an accent preset:
```js
document.documentElement.setAttribute('data-accent', 'berry')
```
Expected: primary glow/buttons/brackets shift to magenta-rose. Sidebar logo gradient (uses primary + info) reflects the change.

Test font-size:
```js
document.documentElement.setAttribute('data-font-size', 'lg')
```
Expected: all rem-based text scales up. Icons stay the same size.

Reset:
```js
document.documentElement.setAttribute('data-theme', 'hud')
document.documentElement.setAttribute('data-accent', 'mint')
document.documentElement.setAttribute('data-font-size', 'md')
```

Stop dev server.

- [ ] **Step 6: Commit**

```bash
git add src/index.css
git commit -m "feat(theme): Forest theme + 12 accent presets + font-size scale"
```

---

## Task 5: Wire Settings Appearance Section

**Files:**
- Modify: `src/pages/Settings.tsx` (Appearance section, lines 153–233)

**Goal:** Replace the static appearance UI with a fully-wired one: Auto toggle, 3 theme cards (with current-active indicator), 5-accent picker keyed to `resolvedTheme`, 3-button font size picker.

- [ ] **Step 1: Update imports in `src/pages/Settings.tsx`**

Replace the top imports block (currently lines 1–20) with:

```tsx
import { useState } from 'react'
import {
    User,
    Bell,
    Lock,
    Palette,
    Globe,
    Shield,
    CreditCard,
    Mail,
    Smartphone,
    Save,
    Check,
} from 'lucide-react'
import HudCard from '../components/common/HudCard'
import Button from '../components/common/Button'
import { useTheme } from '../context/ThemeContext'
import { themes, type FontSize, type ThemeId } from '../themes'
import { useThemeColors } from '../hooks/useThemeColors'
import { chartAccentSequence } from '../themes/tokens'
```

- [ ] **Step 2: Update the destructure inside the `Settings` component**

Replace the existing block:
```tsx
const [activeSection, setActiveSection] = useState('profile')
const { theme, setTheme } = useTheme()
const colors = useThemeColors()
const accentSwatches = chartAccentSequence.map((key) => ({
    key,
    value: colors[key],
}))
```

with:

```tsx
const [activeSection, setActiveSection] = useState('profile')
const { prefs, resolvedTheme, setMode, setAccent, setFontSize } = useTheme()
const colors = useThemeColors()
const chartSwatches = chartAccentSequence.map((key) => ({ key, value: colors[key] }))
const currentTheme = themes.find((t) => t.id === resolvedTheme)!
const currentAccentId = prefs.accent[resolvedTheme]
const isAuto = prefs.mode === 'auto'

const fontSizeOptions: { id: FontSize; label: string }[] = [
    { id: 'sm', label: 'Small' },
    { id: 'md', label: 'Medium' },
    { id: 'lg', label: 'Large' },
]

const handleThemeCardClick = (id: ThemeId) => {
    setMode(id)
}

const handleAutoToggle = () => {
    if (isAuto) {
        // OFF: lock in whatever's currently resolved
        setMode(resolvedTheme)
    } else {
        setMode('auto')
    }
}
```

- [ ] **Step 3: Replace the entire `activeSection === 'appearance'` block**

Find `{activeSection === 'appearance' && (` (around line 153) and replace the contents (everything up to the matching `)}` that closes the appearance section, line ~233) with:

```tsx
{activeSection === 'appearance' && (
    <HudCard title="Appearance" subtitle="Customize the look and feel">
        <div className="space-y-6">
            {/* Auto mode toggle */}
            <div className="flex items-center justify-between p-4 bg-hud-bg-primary rounded-lg">
                <div>
                    <p className="text-sm text-hud-text-primary">Auto · System time</p>
                    <p className="text-xs text-hud-text-muted mt-0.5">
                        07:00–19:00 라이트, 그 외 다크. 수동으로 테마를 고르면 자동 해제됩니다.
                    </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isAuto}
                        onChange={handleAutoToggle}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-hud-toggle-track peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-hud-toggle-thumb after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-hud-accent-primary"></div>
                </label>
            </div>

            {/* Theme cards */}
            <div>
                <label className="block text-sm text-hud-text-secondary mb-3">Color Theme</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {themes.map((option) => {
                        const isResolved = resolvedTheme === option.id
                        const isManualChoice = !isAuto && prefs.mode === option.id
                        return (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => handleThemeCardClick(option.id)}
                                className={`relative text-left p-4 rounded-xl border-2 transition-hud ${isResolved
                                    ? 'border-hud-accent-primary bg-hud-accent-primary/10 shadow-hud-glow'
                                    : 'border-hud-border-secondary bg-hud-bg-primary hover:border-hud-border-primary'
                                    }`}
                            >
                                {isResolved && (
                                    <span className="absolute top-3 right-3 text-hud-accent-primary">
                                        <Check size={18} />
                                    </span>
                                )}
                                <p className="text-sm font-semibold text-hud-text-primary pr-6">
                                    {option.name}
                                </p>
                                <p className="text-xs text-hud-text-muted mt-1 mb-3">
                                    {option.description}
                                </p>
                                <div className="flex gap-1.5">
                                    {option.accents.map((accent) => (
                                        <span
                                            key={accent.id}
                                            className="h-6 flex-1 rounded-md border border-hud-border-secondary"
                                            style={{ backgroundColor: accent.color }}
                                            title={accent.name}
                                        />
                                    ))}
                                </div>
                                {isAuto && isResolved && (
                                    <p className="text-[10px] uppercase tracking-wider text-hud-accent-primary mt-2">
                                        Auto · 현재 적용 중
                                    </p>
                                )}
                                {!isAuto && isManualChoice && (
                                    <p className="text-[10px] uppercase tracking-wider text-hud-accent-primary mt-2">
                                        수동 선택
                                    </p>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Accent presets for the resolved theme */}
            <div>
                <label className="block text-sm text-hud-text-secondary mb-3">
                    Accent Color <span className="text-hud-text-muted">— {currentTheme.name}</span>
                </label>
                <div className="flex gap-3 flex-wrap">
                    {currentTheme.accents.map((accent) => {
                        const selected = accent.id === currentAccentId
                        return (
                            <button
                                key={accent.id}
                                type="button"
                                onClick={() => setAccent(resolvedTheme, accent.id)}
                                title={accent.name}
                                className={`w-10 h-10 rounded-lg transition-transform hover:scale-110 ${selected
                                    ? 'ring-2 ring-offset-2 ring-offset-hud-bg-secondary ring-hud-accent-primary'
                                    : ''
                                    }`}
                                style={{ backgroundColor: accent.color }}
                            />
                        )
                    })}
                </div>
            </div>

            {/* Font Size */}
            <div>
                <label className="block text-sm text-hud-text-secondary mb-3">Font Size</label>
                <div className="flex gap-2">
                    {fontSizeOptions.map((opt) => {
                        const active = prefs.fontSize === opt.id
                        return (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => setFontSize(opt.id)}
                                className={`px-4 py-2 rounded-lg text-sm transition-hud ${active
                                    ? 'bg-hud-accent-primary text-hud-onAccent'
                                    : 'bg-hud-bg-primary text-hud-text-secondary hover:text-hud-text-primary'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Chart palette swatches (unchanged informational row) */}
            <div>
                <label className="block text-sm text-hud-text-secondary mb-3">Chart Palette (preview)</label>
                <div className="flex gap-2">
                    {chartSwatches.map((sw) => (
                        <span
                            key={sw.key}
                            className="w-8 h-8 rounded-md border border-hud-border-secondary"
                            style={{ backgroundColor: sw.value }}
                            title={sw.key}
                        />
                    ))}
                </div>
            </div>
        </div>
    </HudCard>
)}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Build**

Run: `npx vite build`
Expected: success.

- [ ] **Step 6: Manual end-to-end test**

Run: `npx vite --port 12000`. Open Settings → Appearance.

Verify in sequence:
1. Auto toggle ON (default for fresh storage). Active theme card matches current hour resolution.
2. Toggle OFF → that theme card now labeled "수동 선택", current-active indicator unchanged.
3. Click Forest card → page turns Forest. Active indicator moves to Forest. Auto label gone.
4. Click each of the 5 Forest accent swatches → primary color shifts everywhere (sidebar logo gradient, button glow, brackets).
5. Click "Large" font size → all text scales up. Click "Small" → scales down.
6. Refresh page → all selections persisted.
7. Re-enable Auto toggle → mode goes back to 'auto', resolved theme matches the hour. Accent and font size preserved.

Stop dev server.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "feat(settings): wire Appearance section to new theme prefs API"
```

---

## Task 6: Header Palette Dropdown

**Files:**
- Modify: `src/components/layout/Header.tsx`

**Goal:** Add a Palette icon button between the existing icon links and the divider. Clicking it opens a small dropdown listing Auto / HUD Dark / Prism Bright / Forest. Click to switch mode. Active mode shows a check. When `mode === 'auto'`, the Auto row shows a subtitle like "· Light" or "· Dark" indicating the current resolution.

- [ ] **Step 1: Update imports in `src/components/layout/Header.tsx`**

Replace the top imports block (currently lines 1–13) with:

```tsx
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
    Search,
    Bell,
    Menu,
    Mail,
    Calendar,
    Settings,
    LogOut,
    User,
    ChevronDown,
    Palette,
    Check,
} from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { themes } from '../../themes'
```

- [ ] **Step 2: Add palette state and outside-click handler inside the `Header` component**

Insert immediately after the existing `useState` calls (`showProfile`):

```tsx
const [showPalette, setShowPalette] = useState(false)
const { prefs, resolvedTheme, setMode } = useTheme()
const paletteRef = useRef<HTMLDivElement | null>(null)

useEffect(() => {
    if (!showPalette) return
    const onDocClick = (e: MouseEvent) => {
        if (!paletteRef.current?.contains(e.target as Node)) {
            setShowPalette(false)
        }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
}, [showPalette])

const isAuto = prefs.mode === 'auto'
const autoSubtitle = resolvedTheme === 'prism' ? 'Light' : resolvedTheme === 'hud' ? 'Dark' : 'Forest'
```

- [ ] **Step 3: Insert the palette button + dropdown**

Find the JSX block right after the "Quick Links" (`<div className="hidden lg:flex items-center gap-1">…</div>`) and BEFORE the divider (`<div className="w-px h-8 bg-hud-border-secondary mx-2 hidden lg:block" />`). Insert this new block in between:

```tsx
{/* Theme palette */}
<div className="relative" ref={paletteRef}>
    <button
        onClick={() => {
            setShowPalette((s) => !s)
            setShowNotifications(false)
            setShowProfile(false)
        }}
        className="p-2 rounded-lg hover:bg-hud-bg-hover transition-hud text-hud-text-secondary hover:text-hud-accent-primary"
        title="Theme"
        aria-label="Theme switcher"
    >
        <Palette size={20} />
    </button>

    {showPalette && (
        <div className="absolute right-0 mt-2 w-56 bg-hud-bg-secondary border border-hud-border-secondary rounded-lg shadow-hud-glow animate-fade-in overflow-hidden">
            <button
                type="button"
                onClick={() => {
                    setMode('auto')
                    setShowPalette(false)
                }}
                className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-hud-bg-hover transition-hud text-hud-text-secondary hover:text-hud-text-primary"
            >
                <span className="flex flex-col items-start">
                    <span className="text-hud-text-primary">Auto · System time</span>
                    {isAuto && (
                        <span className="text-[11px] text-hud-text-muted">현재 · {autoSubtitle}</span>
                    )}
                </span>
                {isAuto && <Check size={16} className="text-hud-accent-primary" />}
            </button>
            <div className="border-t border-hud-border-secondary" />
            {themes.map((option) => {
                const active = !isAuto && prefs.mode === option.id
                return (
                    <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                            setMode(option.id)
                            setShowPalette(false)
                        }}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-hud-bg-hover transition-hud text-hud-text-secondary hover:text-hud-text-primary"
                    >
                        <span className="flex items-center gap-3">
                            <span
                                className="w-3 h-3 rounded-full border border-hud-border-secondary"
                                style={{ backgroundColor: option.accents[0].color }}
                            />
                            <span className="text-hud-text-primary">{option.name}</span>
                        </span>
                        {active && <Check size={16} className="text-hud-accent-primary" />}
                    </button>
                )
            })}
        </div>
    )}
</div>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Build**

Run: `npx vite build`
Expected: success.

- [ ] **Step 6: Manual end-to-end test**

Run: `npx vite --port 12000`. On any page, click the new Palette icon in the header.

Verify:
1. Dropdown opens with Auto + 3 themes.
2. Auto row shows "현재 · Light" or "현재 · Dark" subtitle when checked.
3. Selecting HUD/Prism/Forest immediately switches theme and closes dropdown.
4. Clicking outside the dropdown closes it.
5. The check mark follows the selected mode (auto vs manual).
6. The Settings → Appearance section stays in sync — selections from Header reflect there.

Stop dev server.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat(header): Palette dropdown for quick theme switching"
```

---

## Task 7: HTML Defaults + Remove Legacy Shims

**Files:**
- Modify: `index.html` (line 2)
- Modify: `src/themes/index.ts` (remove legacy exports)
- Modify: `src/themes/initTheme.ts` (rewrite using applyPrefs)
- Modify: `src/context/ThemeContext.tsx` (remove `theme` / `setTheme` from context value)

**Goal:** Set proper boot-time defaults on `<html>` to minimize FOUC. Remove the three legacy helpers from `src/themes/index.ts` and the corresponding aliases from ThemeContext. Confirm no consumers remain.

- [ ] **Step 1: Update `index.html` line 2**

Replace:
```html
<html lang="ko" data-theme="hud">
```
with:
```html
<html lang="ko" data-theme="hud" data-accent="mint" data-font-size="md">
```

- [ ] **Step 2: Rewrite `src/themes/initTheme.ts`**

```ts
import { applyPrefs, getStoredPrefs, resolveTheme } from './index'

const prefs = getStoredPrefs()
applyPrefs(prefs, resolveTheme(prefs))
```

- [ ] **Step 3: Remove legacy exports from `src/themes/index.ts`**

Delete these declarations entirely:
- `export const THEME_STORAGE_KEY = ...`
- `export function applyTheme(theme: ThemeId) { ... }`
- `export function getStoredTheme(): ThemeId { ... }`

(The other named exports — `themes`, `STORAGE_KEYS`, `isThemeId`, `isMode`, `isFontSize`, `getAutoTheme`, `getStoredPrefs`, `savePrefs`, `resolveTheme`, `applyPrefs`, all the types — remain.)

Also delete the `preview` field from each entry in the `themes` array, and remove `preview: string[]` from the `ThemeOption` interface. Settings.tsx no longer reads it (Task 5 switched to `accents`).

- [ ] **Step 4: Remove legacy aliases from `src/context/ThemeContext.tsx`**

In the `ThemeContextValue` interface, delete the `theme` and `setTheme` fields.

In the `value` object passed to the provider, delete the `theme: resolvedTheme` and `setTheme` entries.

Also delete the `setTheme` callback declaration (the `useCallback` block that defines it).

- [ ] **Step 5: Verify no remaining consumers**

Run: `grep -rn 'THEME_STORAGE_KEY\|\bapplyTheme\b\|\bgetStoredTheme\b\|\bsetTheme\b' src/`
Expected: no matches anywhere in `src/`.

Run: `grep -rn 'useTheme(' src/ | grep -v 'context/ThemeContext.tsx'`
Expected: occurrences in `src/pages/Settings.tsx`, `src/components/layout/Header.tsx`, `src/hooks/useThemeColors.ts` only.

Open `src/hooks/useThemeColors.ts` — it currently does `const { theme } = useTheme()`. Since Task 7 removes the legacy `theme` alias, this needs the fix in the next step.

- [ ] **Step 6: Update `src/hooks/useThemeColors.ts`**

Replace line 29 (`const { theme } = useTheme()`) with:

```ts
const { resolvedTheme } = useTheme()
```

Replace the dep array on line 33 (`}, [theme])`) with:

```ts
}, [resolvedTheme])
```

Also update the inner `setColors(readThemeColors())` if needed — should still work since it reads CSS vars at call time.

Additionally, the hook should re-read colors whenever `prefs.accent` changes (since the accent override changes `--hud-accent-primary` for `colors.primary`). Update the destructure and effect:

```ts
const { resolvedTheme, prefs } = useTheme()
const [colors, setColors] = useState<ThemeColors>(readThemeColors)

useEffect(() => {
    setColors(readThemeColors())
}, [resolvedTheme, prefs.accent])
```

- [ ] **Step 7: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 8: Build**

Run: `npx vite build`
Expected: success.

- [ ] **Step 9: Final end-to-end smoke**

Run: `npx vite --port 12000`. Clear localStorage. Reload.

Verify:
1. No FOUC (first paint is in the right theme/accent/font).
2. All controls work as in Tasks 5 & 6.
3. Charts/SVGs (Dashboard, Analytics, ChartJs, Widgets) re-render with the right primary color when accent changes — because `useThemeColors` now reacts to `prefs.accent`.
4. Set storage manually to legacy: `localStorage.setItem('hud-admin-theme', 'prism'); localStorage.removeItem('hud-admin-theme-mode'); localStorage.removeItem('hud-admin-theme-accent'); localStorage.removeItem('hud-admin-font-size')`. Reload. Confirm migration: app loads Prism, new keys appear, legacy key removed.

Stop dev server.

- [ ] **Step 10: Commit**

```bash
git add index.html src/themes/index.ts src/themes/initTheme.ts src/context/ThemeContext.tsx src/hooks/useThemeColors.ts
git commit -m "chore(theme): drop legacy shims; charts react to accent changes"
```

---

## Verification Checklist

After all 7 tasks complete, the following from the spec's section 9 (검증 기준) should all pass:

- [x] Build passes, TypeScript strict passes (Tasks 1–7)
- [x] Settings → Appearance: 3 theme cards work; Auto ON/OFF normal; 5 accents per theme work; 3 font sizes work (Task 5)
- [x] Header Palette dropdown: 4 options work; auto subtitle "Light"/"Dark" shown (Task 6)
- [x] Page reload restores prefs (Task 2)
- [x] mode='auto' + system clock change near 07:00/19:00 → auto-switch within 1 minute (Task 2)
- [x] Legacy `hud-admin-theme` key migrates to new schema on first new-build open (Task 1, verified Task 7)
- [x] Forest theme readable; no contrast issues (Task 4)
- [x] Accent change updates 13+ primary-derived tokens consistently (Task 3 + Task 4 RGB triplet pattern)
