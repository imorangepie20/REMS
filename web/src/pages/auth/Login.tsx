import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, Home } from 'lucide-react'
import Button from '../../components/common/Button'
import { useAuth } from '../../auth/AuthContext'
import { ApiError } from '../../api/client'

export default function Login() {
    const navigate = useNavigate()
    const location = useLocation()
    const { login } = useAuth()
    const [showPassword, setShowPassword] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError(null)
        setSubmitting(true)
        try {
            await login(email, password)
            const from =
                (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'
            navigate(from, { replace: true })
        } catch (err) {
            setError(err instanceof ApiError ? err.message : '로그인에 실패했습니다')
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
                    <h1 className="text-2xl font-bold text-hud-text-primary">로그인</h1>
                    <p className="text-hud-text-muted mt-2">사무소 계정으로 로그인하세요</p>
                </div>

                {/* Login Form */}
                <div className="hud-card hud-card-bottom rounded-lg p-8">
                    <form onSubmit={onSubmit} className="space-y-6">
                        {/* Email */}
                        <div>
                            <label className="block text-sm text-hud-text-secondary mb-2">이메일</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                                <input
                                    type="email"
                                    required
                                    autoComplete="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="email@example.com"
                                    className="w-full pl-12 pr-4 py-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
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
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="비밀번호"
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

                        {error && <p className="text-sm text-red-400">{error}</p>}

                        <Button variant="primary" fullWidth glow type="submit" disabled={submitting}>
                            {submitting ? '로그인 중...' : '로그인'}
                        </Button>
                    </form>

                    {/* Signup Link */}
                    <p className="text-center text-sm text-hud-text-muted mt-6">
                        아직 계정이 없으신가요?{' '}
                        <Link to="/signup" className="text-hud-accent-primary hover:underline">
                            사무소 가입
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
