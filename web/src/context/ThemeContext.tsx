import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
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

    // Apply attributes in a layout effect so the DOM is updated before any
    // child passive effect (e.g. useThemeColors) reads computed CSS variables.
    useLayoutEffect(() => {
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

    const value: ThemeContextValue = {
        prefs,
        resolvedTheme,
        setMode,
        setAccent,
        setFontSize,
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
