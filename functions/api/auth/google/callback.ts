import { appOrigin, authError, clearOauthCookie, oauthCookieName, parseCookies, redirect, redirectUri, sessionCookie, sha256, randomToken, verifyPayload } from '../../../lib/auth'
import type { D1Row } from '../../../types'
import type { PagesContext } from '../../../types'

type PendingOAuth = { state: string; verifier: string; issuedAt: number }
type GoogleProfile = { sub?: string; email?: string; name?: string; picture?: string; email_verified?: boolean }
type UserRow = D1Row & { id: string }

export const onRequestGet = async (context: PagesContext) => {
  const { env, request } = context
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.SESSION_SECRET || !env.SCRABBLER_DB) return authError('Google sign-in is not configured yet.')
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const pending = await verifyPayload<PendingOAuth>(parseCookies(request)[oauthCookieName], env.SESSION_SECRET)
  if (!code || !state || !pending || pending.state !== state || Date.now() - pending.issuedAt > 10 * 60_000) return authError('The Google sign-in session expired. Please try again.')

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri(context), grant_type: 'authorization_code', code_verifier: pending.verifier }),
  })
  if (!tokenResponse.ok) return authError()
  const tokenData = await tokenResponse.json() as { access_token?: string }
  if (!tokenData.access_token) return authError()
  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokenData.access_token}` } })
  if (!profileResponse.ok) return authError()
  const profile = await profileResponse.json() as GoogleProfile
  if (!profile.sub || !profile.email || profile.email_verified !== true) return authError('A verified Google email is required.')

  const now = Date.now()
  const existing = await env.SCRABBLER_DB.prepare('SELECT id FROM users WHERE google_sub = ?').bind(profile.sub).first<UserRow>()
  const userId = existing?.id ?? randomToken(18)
  if (existing) {
    await env.SCRABBLER_DB.prepare('UPDATE users SET email = ?, name = ?, picture_url = ?, updated_at = ? WHERE id = ?').bind(profile.email, profile.name ?? profile.email, profile.picture ?? null, now, userId).run()
  } else {
    await env.SCRABBLER_DB.prepare('INSERT INTO users (id, google_sub, email, name, picture_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(userId, profile.sub, profile.email, profile.name ?? profile.email, profile.picture ?? null, now, now).run()
  }
  await env.SCRABBLER_DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now).run()
  const sessionToken = randomToken(32)
  await env.SCRABBLER_DB.prepare('INSERT INTO sessions (id_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').bind(await sha256(sessionToken), userId, now + 30 * 24 * 60 * 60_000, now).run()
  return redirect(appOrigin(context), [sessionCookie(sessionToken), clearOauthCookie()])
}
