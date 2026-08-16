import type { Attempt } from './training'

export type ProfileUser = { id: string; email: string; name: string; pictureUrl: string | null }

const jsonRequest = async <T>(input: RequestInfo | URL, init?: RequestInit): Promise<T | null> => {
  try {
    const response = await fetch(input, { credentials: 'same-origin', ...init })
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return null
    return await response.json() as T
  } catch { return null }
}

export const loadProfile = async () => (await jsonRequest<{ user: ProfileUser | null }>('/api/me'))?.user ?? null
export const loadRemoteAttempts = async () => (await jsonRequest<{ attempts: Attempt[] }>('/api/sync/attempts'))?.attempts ?? null
export const syncRemoteAttempts = async (attempts: Attempt[]) => Boolean(await jsonRequest<{ ok: boolean }>('/api/sync/attempts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attempts }) }))
