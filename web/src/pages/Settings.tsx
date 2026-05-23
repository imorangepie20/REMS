import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Building,
    User,
    Lock,
    Users,
    Palette,
    UserPlus,
    Check,
} from 'lucide-react'
import HudCard from '../components/common/HudCard'
import Button from '../components/common/Button'
import { useTheme } from '../context/ThemeContext'
import { themes, type FontSize, type ThemeId } from '../themes'
import { useThemeColors } from '../hooks/useThemeColors'
import { chartAccentSequence } from '../themes/tokens'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import {
    listAgents,
    createAgent,
    updateAgent,
    updateAgency,
    changePassword,
} from '../api/admin'

const inputCls =
    'w-full px-4 py-2.5 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'

const Settings = () => {
    const { agent, agency } = useAuth()
    const isOwner = agent?.role === 'owner'

    const sections = [
        { id: 'agency', label: '사무소 정보', icon: <Building size={18} /> },
        { id: 'account', label: '내 계정', icon: <User size={18} /> },
        { id: 'password', label: '비밀번호 변경', icon: <Lock size={18} /> },
        ...(isOwner ? [{ id: 'agents', label: '중개사 관리', icon: <Users size={18} /> }] : []),
        { id: 'appearance', label: '외관', icon: <Palette size={18} /> },
    ]

    const [activeSection, setActiveSection] = useState('agency')

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold text-hud-text-primary">설정</h1>
                <p className="text-hud-text-muted mt-1">{agency?.name}</p>
            </div>

            <div className="flex gap-6">
                <div className="w-56 flex-shrink-0">
                    <HudCard noPadding>
                        <div className="py-2">
                            {sections.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => setActiveSection(s.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 transition-hud ${activeSection === s.id
                                        ? 'bg-hud-accent-primary/10 text-hud-accent-primary border-l-2 border-hud-accent-primary'
                                        : 'text-hud-text-secondary hover:bg-hud-bg-hover hover:text-hud-text-primary'
                                        }`}
                                >
                                    {s.icon}
                                    <span className="text-sm">{s.label}</span>
                                </button>
                            ))}
                        </div>
                    </HudCard>
                </div>

                <div className="flex-1 space-y-6">
                    {activeSection === 'agency' && <AgencySection isOwner={isOwner} />}
                    {activeSection === 'account' && <AccountSection />}
                    {activeSection === 'password' && <PasswordSection />}
                    {activeSection === 'agents' && isOwner && <AgentsSection />}
                    {activeSection === 'appearance' && <AppearanceSection />}
                </div>
            </div>
        </div>
    )
}

function AgencySection({ isOwner }: { isOwner: boolean }) {
    const { agency } = useAuth()
    const qc = useQueryClient()
    const [name, setName] = useState(agency?.name ?? '')
    const [businessNumber, setBusinessNumber] = useState('')
    const [phone, setPhone] = useState('')
    const [address, setAddress] = useState('')
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

    const save = useMutation({
        mutationFn: () => updateAgency({ name, businessNumber, phone, address }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['me'] })
            setMsg({ ok: true, text: '저장됨' })
        },
        onError: (e) => setMsg({ ok: false, text: e instanceof ApiError ? e.message : '저장 실패' }),
    })

    const onSubmit = (e: FormEvent) => {
        e.preventDefault()
        setMsg(null)
        save.mutate()
    }

    return (
        <HudCard title="사무소 정보" subtitle={isOwner ? '사무소 정보를 수정합니다 (owner)' : '읽기 전용 (owner만 수정 가능)'}>
            <form onSubmit={onSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm text-hud-text-secondary mb-2">상호</label>
                    <input className={inputCls} disabled={!isOwner} value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">사업자등록번호</label>
                        <input className={inputCls} disabled={!isOwner} value={businessNumber} onChange={(e) => setBusinessNumber(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm text-hud-text-secondary mb-2">전화</label>
                        <input className={inputCls} disabled={!isOwner} value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                </div>
                <div>
                    <label className="block text-sm text-hud-text-secondary mb-2">주소</label>
                    <input className={inputCls} disabled={!isOwner} value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                {msg && <p className={`text-sm ${msg.ok ? 'text-hud-accent-success' : 'text-red-400'}`}>{msg.text}</p>}
                {isOwner && (
                    <Button variant="primary" glow type="submit" disabled={save.isPending}>
                        {save.isPending ? '저장 중...' : '저장'}
                    </Button>
                )}
            </form>
        </HudCard>
    )
}

function AccountSection() {
    const { agent } = useAuth()
    const qc = useQueryClient()
    const [name, setName] = useState(agent?.name ?? '')
    const [phone, setPhone] = useState('')
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

    const save = useMutation({
        mutationFn: () => {
            if (!agent) throw new Error('not authenticated')
            return updateAgent(agent.id, { name, phone })
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['me'] })
            setMsg({ ok: true, text: '저장됨' })
        },
        onError: (e) => setMsg({ ok: false, text: e instanceof ApiError ? e.message : '저장 실패' }),
    })

    const onSubmit = (e: FormEvent) => {
        e.preventDefault()
        setMsg(null)
        save.mutate()
    }

    return (
        <HudCard title="내 계정" subtitle="이름·전화 수정">
            <form onSubmit={onSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm text-hud-text-secondary mb-2">이메일</label>
                    <input className={inputCls} disabled value={agent?.email ?? ''} />
                </div>
                <div>
                    <label className="block text-sm text-hud-text-secondary mb-2">이름</label>
                    <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                    <label className="block text-sm text-hud-text-secondary mb-2">전화</label>
                    <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" />
                </div>
                {msg && <p className={`text-sm ${msg.ok ? 'text-hud-accent-success' : 'text-red-400'}`}>{msg.text}</p>}
                <Button variant="primary" glow type="submit" disabled={save.isPending}>
                    {save.isPending ? '저장 중...' : '저장'}
                </Button>
            </form>
        </HudCard>
    )
}

function PasswordSection() {
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

    const save = useMutation({
        mutationFn: () => changePassword({ currentPassword, newPassword }),
        onSuccess: () => {
            setMsg({ ok: true, text: '비밀번호가 변경되었습니다' })
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
        },
        onError: (e) => setMsg({ ok: false, text: e instanceof ApiError ? e.message : '변경 실패' }),
    })

    const onSubmit = (e: FormEvent) => {
        e.preventDefault()
        setMsg(null)
        if (newPassword !== confirmPassword) {
            setMsg({ ok: false, text: '새 비밀번호가 일치하지 않습니다' })
            return
        }
        save.mutate()
    }

    return (
        <HudCard title="비밀번호 변경" subtitle="로그인 비밀번호를 변경합니다">
            <form onSubmit={onSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm text-hud-text-secondary mb-2">현재 비밀번호</label>
                    <input type="password" required className={inputCls} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                </div>
                <div>
                    <label className="block text-sm text-hud-text-secondary mb-2">새 비밀번호 (8자 이상)</label>
                    <input type="password" required minLength={8} className={inputCls} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div>
                    <label className="block text-sm text-hud-text-secondary mb-2">새 비밀번호 확인</label>
                    <input type="password" required className={inputCls} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
                {msg && <p className={`text-sm ${msg.ok ? 'text-hud-accent-success' : 'text-red-400'}`}>{msg.text}</p>}
                <Button variant="primary" glow type="submit" disabled={save.isPending}>
                    {save.isPending ? '변경 중...' : '변경'}
                </Button>
            </form>
        </HudCard>
    )
}

function AgentsSection() {
    const qc = useQueryClient()
    const { data: agents } = useQuery({ queryKey: ['agents'], queryFn: listAgents })
    const [newEmail, setNewEmail] = useState('')
    const [newName, setNewName] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

    const add = useMutation({
        mutationFn: () => createAgent({ email: newEmail, name: newName, password: newPassword }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['agents'] })
            setNewEmail('')
            setNewName('')
            setNewPassword('')
            setMsg({ ok: true, text: '멤버를 추가했습니다' })
        },
        onError: (e) => setMsg({ ok: false, text: e instanceof ApiError ? e.message : '추가 실패' }),
    })

    const toggleStatus = useMutation({
        mutationFn: ({ id, status }: { id: number; status: 'active' | 'inactive' }) =>
            updateAgent(id, { status }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
    })

    const onAddMember = (e: FormEvent) => {
        e.preventDefault()
        setMsg(null)
        add.mutate()
    }

    return (
        <HudCard title="중개사 관리" subtitle="사무소 소속 중개사 목록 및 멤버 추가 (owner)">
            <div className="space-y-4">
                <div className="hud-card rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-hud-bg-secondary border-b border-hud-border-secondary">
                            <tr className="text-left text-hud-text-secondary">
                                <th className="px-4 py-2 font-medium">이름</th>
                                <th className="px-4 py-2 font-medium">이메일</th>
                                <th className="px-4 py-2 font-medium">역할</th>
                                <th className="px-4 py-2 font-medium">상태</th>
                                <th className="px-4 py-2 font-medium w-24"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-hud-border-secondary">
                            {(agents ?? []).map((a) => (
                                <tr key={a.id}>
                                    <td className="px-4 py-2">{a.name}</td>
                                    <td className="px-4 py-2 text-hud-text-secondary">{a.email}</td>
                                    <td className="px-4 py-2">
                                        <span className={`px-2 py-0.5 rounded text-xs ${a.role === 'owner' ? 'bg-hud-accent-primary/20 text-hud-accent-primary' : 'bg-hud-bg-secondary text-hud-text-secondary'}`}>
                                            {a.role === 'owner' ? '대표' : '멤버'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2">
                                        <span className={`px-2 py-0.5 rounded text-xs ${a.status === 'active' ? 'bg-hud-accent-success/20 text-hud-accent-success' : 'bg-hud-text-muted/20 text-hud-text-muted'}`}>
                                            {a.status === 'active' ? '활성' : '비활성'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        {a.role !== 'owner' && (
                                            <button
                                                className="text-xs text-hud-accent-primary hover:underline"
                                                onClick={() => toggleStatus.mutate({ id: a.id, status: a.status === 'active' ? 'inactive' : 'active' })}
                                            >
                                                {a.status === 'active' ? '비활성화' : '활성화'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <form onSubmit={onAddMember} className="flex flex-wrap gap-2 pt-2 border-t border-hud-border-secondary">
                    <input className={inputCls + ' flex-1 min-w-[180px]'} type="email" required placeholder="이메일" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                    <input className={inputCls + ' flex-1 min-w-[120px]'} required placeholder="이름" value={newName} onChange={(e) => setNewName(e.target.value)} />
                    <input className={inputCls + ' flex-1 min-w-[160px]'} type="password" required minLength={8} placeholder="임시 비밀번호 (8자 이상)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                    <Button variant="primary" type="submit" disabled={add.isPending} leftIcon={<UserPlus size={16} />}>
                        멤버 추가
                    </Button>
                </form>
                {msg && <p className={`text-sm ${msg.ok ? 'text-hud-accent-success' : 'text-red-400'}`}>{msg.text}</p>}
            </div>
        </HudCard>
    )
}

function AppearanceSection() {
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
            setMode(resolvedTheme)
        } else {
            setMode('auto')
        }
    }

    return (
        <HudCard title="외관" subtitle="테마와 색상을 설정합니다">
            <div className="space-y-6">
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
    )
}

export default Settings
