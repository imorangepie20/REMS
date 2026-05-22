import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { ApiError } from '../../api/client'

export default function Signup() {
  const navigate = useNavigate()
  const { signup } = useAuth()
  const [agencyName, setAgencyName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
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

  const inputCls =
    'w-full px-3 py-2 border border-slate-300 rounded bg-white text-slate-900 placeholder:text-slate-400'

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100 text-slate-900">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 bg-white p-6 rounded-lg shadow">
        <h1 className="text-2xl font-semibold text-slate-900">REMS 사무소 가입</h1>
        <input
          required
          placeholder="중개사무소명"
          value={agencyName}
          onChange={(e) => setAgencyName(e.target.value)}
          className={inputCls}
        />
        <input
          required
          placeholder="대표 중개사 이름"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          className={inputCls}
        />
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="이메일 (로그인 ID)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="비밀번호 (8자 이상)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? '가입 중...' : '사무소 가입'}
        </button>
        <p className="text-sm text-center text-slate-700">
          이미 계정이 있나요? <Link to="/login" className="text-blue-600 hover:underline">로그인</Link>
        </p>
      </form>
    </div>
  )
}
