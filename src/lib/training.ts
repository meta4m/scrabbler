import { uniqueSourceWords, type DrillType, type Word } from '../data/words'

export type Attempt = { id: string; timestamp: string; drill: DrillType; prompt: string; response: string; correct: boolean; latencyMs: number }
export const ATTEMPTS_KEY = 'scrabbler.attempts.v1'

export const loadAttempts = (): Attempt[] => {
  try { return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) ?? '[]') as Attempt[] } catch { return [] }
}
export const saveAttempt = (attempt: Attempt) => {
  const next = [attempt, ...loadAttempts()].slice(0, 500)
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(next))
  return next
}
export const accuracy = (attempts: Attempt[]) => attempts.length ? Math.round((attempts.filter((attempt) => attempt.correct).length / attempts.length) * 100) : 0
export const averageLatency = (attempts: Attempt[]) => attempts.length ? Math.round(attempts.reduce((total, attempt) => total + attempt.latencyMs, 0) / attempts.length) : 0
export type Mastery = 'UNKNOWN' | 'RECOGNIZED' | 'RECALLABLE' | 'FAST' | 'AUTOMATIC'
export type WordStat = { spelling: string; attempts: number; correct: number; accuracy: number; averageLatencyMs: number; mastery: Mastery; lastSeen: string | null; nextReviewAt: string | null }

export const drillLabel = (drill: DrillType) => ({ '2-letter': '2-letter', power: 'power letter', bingo: 'bingo', dumps: 'dump', all: 'all-letter', mixed: 'adaptive mix' })[drill]

const reviewIntervals: Record<Mastery, number> = { UNKNOWN: 0, RECOGNIZED: 10 * 60_000, RECALLABLE: 24 * 60 * 60_000, FAST: 3 * 24 * 60 * 60_000, AUTOMATIC: 7 * 24 * 60 * 60_000 }
export const masteryFor = (attempts: number, accuracyValue: number, averageLatencyMs: number): Mastery => {
  if (!attempts) return 'UNKNOWN'
  if (attempts >= 4 && accuracyValue >= 0.9 && averageLatencyMs <= 1500) return 'AUTOMATIC'
  if (attempts >= 3 && accuracyValue >= 0.8 && averageLatencyMs <= 2500) return 'FAST'
  if (attempts >= 2 && accuracyValue >= 0.7) return 'RECALLABLE'
  return 'RECOGNIZED'
}
export const wordStats = (attempts: Attempt[]): WordStat[] => {
  const grouped = new Map<string, Attempt[]>()
  attempts.forEach((attempt) => grouped.set(attempt.prompt, [...(grouped.get(attempt.prompt) ?? []), attempt]))
  return [...grouped.entries()].map(([spelling, entries]) => {
    const correct = entries.filter((entry) => entry.correct).length; const accuracyValue = correct / entries.length; const averageLatencyMs = Math.round(entries.reduce((sum, entry) => sum + entry.latencyMs, 0) / entries.length); const mastery = masteryFor(entries.length, accuracyValue, averageLatencyMs); const lastSeen = entries[0]?.timestamp ?? null
    return { spelling, attempts: entries.length, correct, accuracy: Math.round(accuracyValue * 100), averageLatencyMs, mastery, lastSeen, nextReviewAt: new Date(new Date(lastSeen ?? 0).getTime() + (entries[0]?.correct ? reviewIntervals[mastery] : 0)).toISOString() }
  }).sort((a, b) => a.accuracy - b.accuracy || b.averageLatencyMs - a.averageLatencyMs)
}
export const dueWords = (attempts: Attempt[], now = Date.now()) => wordStats(attempts).filter((stat) => !stat.nextReviewAt || new Date(stat.nextReviewAt).getTime() <= now)
export const weakWords = (attempts: Attempt[], limit = 12): WordStat[] => wordStats(attempts).filter((stat) => stat.mastery !== 'AUTOMATIC').slice(0, limit)
export const selectAdaptiveWord = (pool: Word[], attempts: Attempt[], random = Math.random): Word => {
  const stats = new Map(wordStats(attempts).map((stat) => [stat.spelling, stat])); const now = Date.now(); const ranked = [...pool].sort((a, b) => {
    const left = stats.get(a.spelling); const right = stats.get(b.spelling); const score = (stat: WordStat | undefined) => !stat ? 100 : (stat.nextReviewAt && new Date(stat.nextReviewAt).getTime() <= now ? 50 : 0) + (100 - stat.accuracy) + Math.min(stat.averageLatencyMs / 100, 40)
    return score(right) - score(left)
  }).slice(0, Math.min(20, pool.length))
  return ranked[Math.floor(random() * Math.max(ranked.length, 1))] ?? uniqueSourceWords[0]
}
