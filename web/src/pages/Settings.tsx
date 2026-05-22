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

const settingsSections = [
    { id: 'profile', label: 'Profile', icon: <User size={18} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
    { id: 'security', label: 'Security', icon: <Lock size={18} /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette size={18} /> },
    { id: 'language', label: 'Language', icon: <Globe size={18} /> },
    { id: 'privacy', label: 'Privacy', icon: <Shield size={18} /> },
    { id: 'billing', label: 'Billing', icon: <CreditCard size={18} /> },
]

const Settings = () => {
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

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-hud-text-primary">Settings</h1>
                    <p className="text-hud-text-muted mt-1">Manage your account and preferences.</p>
                </div>
                <Button variant="primary" glow leftIcon={<Save size={18} />}>
                    Save Changes
                </Button>
            </div>

            <div className="flex gap-6">
                {/* Sidebar */}
                <div className="w-56 flex-shrink-0">
                    <HudCard noPadding>
                        <div className="py-2">
                            {settingsSections.map((section) => (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 transition-hud ${activeSection === section.id
                                            ? 'bg-hud-accent-primary/10 text-hud-accent-primary border-l-2 border-hud-accent-primary'
                                            : 'text-hud-text-secondary hover:bg-hud-bg-hover hover:text-hud-text-primary'
                                        }`}
                                >
                                    {section.icon}
                                    <span className="text-sm">{section.label}</span>
                                </button>
                            ))}
                        </div>
                    </HudCard>
                </div>

                {/* Content */}
                <div className="flex-1 space-y-6">
                    {activeSection === 'profile' && (
                        <HudCard title="Profile Settings" subtitle="Update your personal information">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">First Name</label>
                                    <input
                                        type="text"
                                        defaultValue="Admin"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">Last Name</label>
                                    <input
                                        type="text"
                                        defaultValue="User"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">Email</label>
                                    <input
                                        type="email"
                                        defaultValue="admin@hudadmin.com"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">Phone</label>
                                    <input
                                        type="tel"
                                        defaultValue="+1 (555) 123-4567"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm text-hud-text-secondary mb-2">Bio</label>
                                    <textarea
                                        rows={4}
                                        defaultValue="Senior Full Stack Developer with 8+ years of experience."
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud resize-none"
                                    />
                                </div>
                            </div>
                        </HudCard>
                    )}

                    {activeSection === 'notifications' && (
                        <HudCard title="Notification Preferences" subtitle="Manage how you receive notifications">
                            <div className="space-y-6">
                                {[
                                    { icon: <Mail size={18} />, title: 'Email Notifications', desc: 'Receive email updates about your account' },
                                    { icon: <Bell size={18} />, title: 'Push Notifications', desc: 'Get push notifications on your devices' },
                                    { icon: <Smartphone size={18} />, title: 'SMS Notifications', desc: 'Receive SMS for important updates' },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-hud-bg-primary rounded-lg">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-hud-accent-primary/10 rounded-lg text-hud-accent-primary">
                                                {item.icon}
                                            </div>
                                            <div>
                                                <p className="text-sm text-hud-text-primary">{item.title}</p>
                                                <p className="text-xs text-hud-text-muted">{item.desc}</p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" defaultChecked className="sr-only peer" />
                                            <div className="w-11 h-6 bg-hud-toggle-track peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-hud-toggle-thumb after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-hud-accent-primary"></div>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </HudCard>
                    )}

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

                                {/* Chart palette swatches (informational) */}
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

                    {activeSection === 'security' && (
                        <HudCard title="Security Settings" subtitle="Protect your account">
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">Current Password</label>
                                    <input
                                        type="password"
                                        placeholder="Enter current password"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">New Password</label>
                                    <input
                                        type="password"
                                        placeholder="Enter new password"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-hud-text-secondary mb-2">Confirm Password</label>
                                    <input
                                        type="password"
                                        placeholder="Confirm new password"
                                        className="w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary focus:outline-none focus:border-hud-accent-primary transition-hud"
                                    />
                                </div>

                                <div className="pt-4 border-t border-hud-border-secondary">
                                    <div className="flex items-center justify-between p-4 bg-hud-bg-primary rounded-lg">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-hud-accent-primary/10 rounded-lg text-hud-accent-primary">
                                                <Shield size={18} />
                                            </div>
                                            <div>
                                                <p className="text-sm text-hud-text-primary">Two-Factor Authentication</p>
                                                <p className="text-xs text-hud-text-muted">Add an extra layer of security</p>
                                            </div>
                                        </div>
                                        <Button variant="outline" size="sm">Enable</Button>
                                    </div>
                                </div>
                            </div>
                        </HudCard>
                    )}

                    {(activeSection !== 'profile' && activeSection !== 'notifications' && activeSection !== 'appearance' && activeSection !== 'security') && (
                        <HudCard title={settingsSections.find(s => s.id === activeSection)?.label} subtitle="Settings coming soon">
                            <div className="py-12 text-center">
                                <p className="text-hud-text-muted">This section is under development.</p>
                            </div>
                        </HudCard>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Settings
