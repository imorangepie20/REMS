import { useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { type AccentKey, chartAccentSequence, cssVar } from '../themes/tokens'

export type ThemeColors = Record<AccentKey, string> & {
    chartTrack: string
    muted: string
}

function readCssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export function readThemeColors(): ThemeColors {
    return {
        primary: readCssVar(cssVar.accentPrimary),
        secondary: readCssVar(cssVar.accentSecondary),
        info: readCssVar(cssVar.accentInfo),
        warning: readCssVar(cssVar.accentWarning),
        success: readCssVar(cssVar.accentSuccess),
        danger: readCssVar(cssVar.accentDanger),
        chartTrack: readCssVar(cssVar.chartTrack),
        muted: readCssVar(cssVar.textMuted),
    }
}

/** SVG stroke/fill, inline style용 — 테마 전환 시 갱신 */
export function useThemeColors(): ThemeColors {
    const { resolvedTheme, prefs } = useTheme()
    const [colors, setColors] = useState<ThemeColors>(readThemeColors)

    useEffect(() => {
        setColors(readThemeColors())
    }, [resolvedTheme, prefs.accent])

    return colors
}

export function getChartPalette(colors: ThemeColors): string[] {
    return chartAccentSequence.map((key) => colors[key])
}
