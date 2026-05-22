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
    },
    {
        id: 'prism',
        name: 'Prism Bright',
        description: '화려하고 밝은 프리즘 컬러 톤',
        accents: prismAccents,
    },
    {
        id: 'forest',
        name: 'Forest',
        description: '깊은 숲의 다크 — 황금/에메랄드 액센트',
        accents: forestAccents,
    },
]

export const STORAGE_KEYS = {
    mode: 'hud-admin-theme-mode',
    accent: 'hud-admin-theme-accent',
    fontSize: 'hud-admin-font-size',
    legacy: 'hud-admin-theme',
} as const

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
