import { currentUser, json } from '../../lib/auth'
import type { PagesContext } from '../../types'

type AttemptInput = { id: string; timestamp: string; drill: string; prompt: string; response: string; correct: boolean; latencyMs: number }
const drills = new Set(['2-letter', 'power', 'bingo', 'dumps', 'all', 'mixed'])

const validAttempt = (value: unknown): value is AttemptInput => {
  if (!value || typeof value !== 'object') return false
  const attempt = value as Partial<AttemptInput>
  return typeof attempt.id === 'string' && attempt.id.length <= 100 && typeof attempt.timestamp === 'string' && typeof attempt.drill === 'string' && drills.has(attempt.drill) && typeof attempt.prompt === 'string' && attempt.prompt.length <= 20 && typeof attempt.response === 'string' && attempt.response.length <= 20 && typeof attempt.correct === 'boolean' && typeof attempt.latencyMs === 'number' && Number.isFinite(attempt.latencyMs) && attempt.latencyMs >= 0
}

export const onRequestGet = async (context: PagesContext) => {
  const user = await currentUser(context)
  if (!user) return json({ error: 'Sign-in required.' }, 401)
  if (!context.env.SCRABBLER_DB) return json({ error: 'Sync is not configured.' }, 503)
  const rows = await context.env.SCRABBLER_DB.prepare('SELECT attempt_id, timestamp, drill, prompt, response, correct, latency_ms FROM attempts WHERE user_id = ? ORDER BY timestamp DESC LIMIT 500').bind(user.id).all()
  return json({ attempts: rows.results.map((row) => ({ id: row.attempt_id, timestamp: row.timestamp, drill: row.drill, prompt: row.prompt, response: row.response, correct: Boolean(row.correct), latencyMs: row.latency_ms })) })
}

export const onRequestPost = async (context: PagesContext) => {
  const user = await currentUser(context)
  if (!user) return json({ error: 'Sign-in required.' }, 401)
  if (!context.env.SCRABBLER_DB) return json({ error: 'Sync is not configured.' }, 503)
  let body: unknown
  try { body = await context.request.json() } catch { return json({ error: 'Invalid JSON.' }, 400) }
  const attempts = Array.isArray(body) ? body : (body && typeof body === 'object' && Array.isArray((body as { attempts?: unknown }).attempts) ? (body as { attempts: unknown[] }).attempts : null)
  if (!attempts || attempts.length > 500 || !attempts.every(validAttempt)) return json({ error: 'Invalid attempt data.' }, 400)
  const now = Date.now()
  await context.env.SCRABBLER_DB.batch(attempts.map((attempt) => context.env.SCRABBLER_DB!.prepare(`INSERT OR IGNORE INTO attempts (user_id, attempt_id, timestamp, drill, prompt, response, correct, latency_ms, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(user.id, attempt.id, attempt.timestamp, attempt.drill, attempt.prompt, attempt.response, attempt.correct ? 1 : 0, Math.round(attempt.latencyMs), now)))
  return json({ ok: true, synced: attempts.length })
}
