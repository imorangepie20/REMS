import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, User, Building, Eye, EyeOff, Home } from 'lucide-react'
import Button from '../../components/common/Button'
import { useAuth } from '../../auth/AuthContext'
import { ApiError } from '../../api/client'

const inputCls =
    'w-full pl-12 pr-4 py-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud'

export default function Signup() {
    const navigate = useNavigate()
    const { signup } = useAuth()
    const [showPassword, setShowPassword] = useState(false)
    const [agencyName, setAgencyName] = useState('')
    const [ownerName, setOwnerName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError(null)
        if (password !== confirmPassword) {
            setError('비밀번호가 일치하지 않습니다')
            return
        }
        setSubmitting(true)
        try {
            await signup({
                agency: { name: agencyName },
                owner: { email, password, name: ownerName },
            })
            navigate('/', { replace: true })
        } catch (err) {
            setError(err instanceof ApiError ? err.message : '가입에 실패했습니다')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-hud-bg-primary hud-grid-bg flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-gradient-to-br from-hud-accent-primary to-hud-accent-info rounded-lg flex items-center justify-center text-hud-onAccent">
                            <Home size={24} />
                        </div>
                        <span className="font-bold text-2xl text-hud-text-primary text-glow">REMS</span>
                    </div>
                    <h1 className="text-2xl font-bold text-hud-text-primary">사무소 가입</h1>
                    <p className="text-hud-text-muted mt-2">중개사무소 계정을 만드세요</p>
                </div>

                {/* Signup Form */}
                <div className="hud-card hud-card-bottom rounded-lg p-8">
                    <form onSubmit={onSubmit} className="space-y-5">
                        {/* Agency name */}
                        <div>
                            <label className="block text-sm text-hud-text-secondary mb-2">중개사무소명</label>
                            <div className="relative">
                                <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                                <input
                                    type="text"
                                    required
                                    value={agencyName}
                                    onChange={(e) => setAgencyName(e.target.value)}
                                    placeholder="예: 강남부동산"
                                    className={inputCls}
                                />
                            </div>
                        </div>

                        {/* Owner name */}
                        <div>
                            <label className="block text-sm text-hud-text-secondary mb-2">대표 중개사 이름</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                                <input
                                    type="text"
                                    required
                                    value={ownerName}
                                    onChange={(e) => setOwnerName(e.target.value)}
                                    placeholder="홍길동"
                                    className={inputCls}
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm text-hud-text-secondary mb-2">이메일 (로그인 ID)</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                                <input
                                    type="email"
                                    required
                                    autoComplete="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="email@example.com"
                                    className={inputCls}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm text-hud-text-secondary mb-2">비밀번호</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    minLength={8}
                                    autoComplete="new-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="8자 이상"
                                    className="w-full pl-12 pr-12 py-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-hud-text-muted hover:text-hud-text-primary transition-hud"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm password */}
                        <div>
                            <label className="block text-sm text-hud-text-secondary mb-2">비밀번호 확인</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="비밀번호 재입력"
                                    className={inputCls}
                                />
                            </div>
                        </div>

                        {error && <p className="text-sm text-red-400">{error}</p>}

                        <Button variant="primary" fullWidth glow type="submit" disabled={submitting}>
                            {submitting ? '가입 중...' : '사무소 가입'}
                        </Button>
                    </form>

                    {/* Login Link */}
                    <p className="text-center text-sm text-hud-text-muted mt-6">
                        이미 계정이 있으신가요?{' '}
                        <Link to="/login" className="text-hud-accent-primary hover:underline">
                            로그인
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
