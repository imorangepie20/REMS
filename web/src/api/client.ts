/** API 에러 응답을 나타내는 예외 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** API 호출 공통 래퍼. `/api` 프리픽스를 붙이고 에러 응답을 ApiError로 변환한다. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const err = body?.error ?? { code: 'UNKNOWN', message: '요청에 실패했습니다' };
    throw new ApiError(res.status, err.code, err.message);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
