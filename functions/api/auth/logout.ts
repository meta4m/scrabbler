import { clearSessionCookie, currentUser, parseCookies, redirect, SESSION_COOKIE, sha256, appOrigin } from '../../lib/auth'
import type { PagesContext } from '../../types'

export const onRequestGet = async (context: PagesContext) => {
  const token = parseCookies(context.request)[SESSION_COOKIE]
  if (token && context.env.SCRABBLER_DB) await context.env.SCRABBLER_DB.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(await sha256(token)).run()
  return redirect(appOrigin(context), [clearSessionCookie()])
}
