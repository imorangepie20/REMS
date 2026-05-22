/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                hud: {
                    bg: {
                        primary: 'var(--hud-bg-primary)',
                        secondary: 'var(--hud-bg-secondary)',
                        card: 'var(--hud-bg-card)',
                        hover: 'var(--hud-bg-hover)',
                    },
                    accent: {
                        primary: 'var(--hud-accent-primary)',
                        secondary: 'var(--hud-accent-secondary)',
                        warning: 'var(--hud-accent-warning)',
                        info: 'var(--hud-accent-info)',
                        success: 'var(--hud-accent-success)',
                        danger: 'var(--hud-accent-danger)',
                    },
                    text: {
                        primary: 'var(--hud-text-primary)',
                        secondary: 'var(--hud-text-secondary)',
                        muted: 'var(--hud-text-muted)',
                    },
                    border: {
                        primary: 'var(--hud-border-primary)',
                        secondary: 'var(--hud-border-secondary)',
                    },
                    onAccent: 'var(--hud-on-accent)',
                }
            },
            fontFamily: {
                sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
            },
            boxShadow: {
                'hud': 'var(--hud-shadow)',
                'hud-glow': 'var(--hud-shadow-glow)',
                'hud-pink': 'var(--hud-shadow-pink)',
                'glow-primary-strong': '0 0 40px var(--hud-glow-primary-strong)',
                'glow-info': '0 0 20px var(--hud-glow-info)',
                'glow-info-strong': '0 0 40px var(--hud-glow-info-strong)',
            },
            backgroundColor: {
                'hud-overlay': 'var(--hud-overlay-bg)',
                'hud-overlay-control': 'var(--hud-overlay-control)',
                'hud-surface-elevated': 'var(--hud-surface-elevated)',
                'hud-surface-muted': 'var(--hud-surface-muted)',
                'hud-media-chrome': 'var(--hud-media-chrome-bg)',
                'hud-media-art': 'var(--hud-media-chrome-art)',
                'hud-media-track': 'var(--hud-media-chrome-track)',
                'hud-media-play': 'var(--hud-media-chrome-play-bg)',
                'hud-toggle-track': 'var(--hud-toggle-track)',
                'hud-toggle-thumb': 'var(--hud-toggle-thumb)',
            },
            textColor: {
                'hud-overlay': 'var(--hud-overlay-text)',
                'hud-overlay-muted': 'var(--hud-overlay-text-muted)',
                'hud-media': 'var(--hud-media-chrome-text)',
                'hud-media-muted': 'var(--hud-media-chrome-muted)',
                'hud-media-play': 'var(--hud-media-chrome-play-text)',
            },
            animation: {
                'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-in': 'slideIn 0.3s ease-out',
            },
            keyframes: {
                'pulse-glow': {
                    '0%, 100%': { boxShadow: '0 0 20px var(--hud-pulse-glow-start)' },
                    '50%': { boxShadow: '0 0 40px var(--hud-pulse-glow-end)' },
                },
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideIn: {
                    '0%': { transform: 'translateX(-10px)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
            },
            backgroundImage: {
                'hud-grid': `
          linear-gradient(var(--hud-grid-line-1) 1px, transparent 1px),
          linear-gradient(90deg, var(--hud-grid-line-2) 1px, transparent 1px)
        `,
            },
            backgroundSize: {
                'grid': '50px 50px',
            },
        },
    },
    plugins: [],
}
