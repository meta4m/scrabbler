import type { D1Row, Env, PagesContext } from '../types'

export const SESSION_COOKIE = 'scrabbler_session'
const OAUTH_COOKIE = 'scrabbler_oauth_state'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30
const OAUTH_MAX_AGE = 60 * 10
const encoder = new TextEncoder()

type UserRow = D1Row & {
  id: string
  google_sub: string
  email: string
  name: string
  picture_url: string | null
}

export type CurrentUser = {
  id: string
  email: string
  name: string
  pictureUrl: string | null
}

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const base64UrlToBytes = (value: string) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export const randomToken = (size = 32) => {
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  return bytesToBase64Url(bytes)
}

export const sha256 = async (value: string) => bytesToBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))))

const sign = async (value: string, secret: string) => {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))))
}

export const signedPayload = async (payload: Record<string, unknown>, secret: string) => {
  const body = bytesToBase64Url(encoder.encode(JSON.stringify(payload)))
  return `${body}.${await sign(body, secret)}`
}

export const verifyPayload = async <T>(value: string | undefined, secret: string): Promise<T | null> => {
  try {
    if (!value) return null
    const separator = value.lastIndexOf('.')
    if (separator < 1) return null
    const body = value.slice(0, separator)
    const signature = value.slice(separator + 1)
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    if (!await crypto.subtle.verify('HMAC', key, base64UrlToBytes(signature), encoder.encode(body))) return null
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(body))) as T
  } catch { return null }
}

export const parseCookies = (request: Request) => Object.fromEntries((request.headers.get('Cookie') ?? '').split(';').map((part) => {
  const separator = part.indexOf('=')
  if (separator < 1) return ['', undefined]
  try { return [decodeURIComponent(part.slice(0, separator).trim()), decodeURIComponent(part.slice(separator + 1).trim())] } catch { return ['', undefined] }
}).filter(([name, value]) => name && value !== undefined))

const cookie = (name: string, value: string, maxAge: number, path: string) => `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=${path}; HttpOnly; Secure; SameSite=Lax`
export const sessionCookie = (token: string) => cookie(SESSION_COOKIE, token, SESSION_MAX_AGE, '/')
export const clearSessionCookie = () => cookie(SESSION_COOKIE, '', 0, '/')
export const oauthCookie = (value: string) => cookie(OAUTH_COOKIE, value, OAUTH_MAX_AGE, '/api/auth/google')
export const clearOauthCookie = () => cookie(OAUTH_COOKIE, '', 0, '/api/auth/google')

export const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders },
})

export const redirect = (location: string, cookies: string[] = []) => {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' })
  cookies.forEach((value) => headers.append('Set-Cookie', value))
  return new Response(null, { status: 302, headers })
}

export const appOrigin = (context: PagesContext) => (context.env.APP_ORIGIN || new URL(context.request.url).origin).replace(/\/$/, '')
export const redirectUri = (context: PagesContext) => `${appOrigin(context)}/api/auth/google/callback`

export const databaseMissing = (env: Env) => !env.SCRABBLER_DB || !env.SESSION_SECRET

export const currentUser = async (context: PagesContext): Promise<CurrentUser | null> => {
  if (databaseMissing(context.env)) return null
  const token = parseCookies(context.request)[SESSION_COOKIE]
  if (!token) return null
  const row = await context.env.SCRABBLER_DB!.prepare(`
    SELECT u.id, u.email, u.name, u.picture_url
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id_hash = ? AND s.expires_at > ?
  `).bind(await sha256(token), Date.now()).first<UserRow>()
  if (!row) return null
  return { id: row.id, email: row.email, name: row.name, pictureUrl: row.picture_url }
}

export const authError = (message = 'Authentication could not be completed.') => new Response(message, {
  status: 400,
  headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
})

export const oauthCookieName = OAUTH_COOKIE
