export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    let err: ApiError
    try {
      const body = await res.json()
      err = body.error ?? { code: 'UNKNOWN', message: res.statusText }
    } catch {
      err = { code: 'UNKNOWN', message: res.statusText }
    }
    const e = new Error(err.message)
    ;(e as Error & { code?: string }).code = err.code
    throw e
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
