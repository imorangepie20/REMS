import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { AuthResponse, SignupRequest } from '@rems/shared'
import { apiFetch, ApiError } from '../api/client'

interface AuthState {
  agent: AuthResponse['agent'] | null
  agency: AuthResponse['agency'] | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  signup: (data: SignupRequest) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    agent: null,
    agency: null,
    loading: true,
  })

  useEffect(() => {
    apiFetch<AuthResponse>('/auth/me')
      .then((data) => setState({ agent: data.agent, agency: data.agency, loading: false }))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          setState({ agent: null, agency: null, loading: false })
        } else {
          setState({ agent: null, agency: null, loading: false })
        }
      })
  }, [])

  const login = async (email: string, password: string) => {
    const data = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setState({ agent: data.agent, agency: data.agency, loading: false })
  }

  const signup = async (payload: SignupRequest) => {
    const data = await apiFetch<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    setState({ agent: data.agent, agency: data.agency, loading: false })
  }

  const logout = async () => {
    await apiFetch<void>('/auth/logout', { method: 'POST' })
    setState({ agent: null, agency: null, loading: false })
  }

  return (
    <AuthContext.Provider value={{ ...state, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서 호출해야 합니다')
  return ctx
}
