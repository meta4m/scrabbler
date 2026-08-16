import { appOrigin, authError, oauthCookie, randomToken, redirect, redirectUri, signedPayload } from '../../lib/auth'
import type { PagesContext } from '../../types'

export const onRequestGet = async (context: PagesContext) => {
  const { env } = context
  if (!env.GOOGLE_CLIENT_ID || !env.SESSION_SECRET) return authError('Google sign-in is not configured yet.')
  const state = randomToken(24)
  const verifier = randomToken(32)
  const challenge = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  const signedState = await signedPayload({ state, verifier, issuedAt: Date.now() }, env.SESSION_SECRET)
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(context),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  })
  return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, [oauthCookie(signedState)])
}
