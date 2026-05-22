export type AccentKey = 'primary' | 'secondary' | 'info' | 'warning' | 'success' | 'danger'

/** Tailwind bg-* classes (정적 — 동적 `bg-${key}` 사용 금지) */
export const accentBgClass: Record<AccentKey, string> = {
    primary: 'bg-hud-accent-primary',
    secondary: 'bg-hud-accent-secondary',
    info: 'bg-hud-accent-info',
    warning: 'bg-hud-accent-warning',
    success: 'bg-hud-accent-success',
    danger: 'bg-hud-accent-danger',
}

/** 차트·SVG용 팔레트 순서 */
export const chartAccentSequence: AccentKey[] = [
    'primary',
    'info',
    'secondary',
    'warning',
    'success',
]

export const cssVar = {
    bgPrimary: '--hud-bg-primary',
    accentPrimary: '--hud-accent-primary',
    accentSecondary: '--hud-accent-secondary',
    accentInfo: '--hud-accent-info',
    accentWarning: '--hud-accent-warning',
    accentSuccess: '--hud-accent-success',
    accentDanger: '--hud-accent-danger',
    chartTrack: '--hud-chart-track',
    textMuted: '--hud-text-muted',
} as const
