import { describe, expect, it, beforeEach } from 'vitest'
import { accuracy, averageLatency, masteryFor, mergeAttempts, saveAttempt, selectAdaptiveWord, wordStats, type Attempt } from './training'
import { canBuildFromRack, isAnagram, normalize, scoreWord, wordsFromRack } from '../data/words'
import { createTournamentPosition, isLegalSourcePlay, scoreMove } from './tournament'

const attempt = (correct: boolean, latencyMs: number): Attempt => ({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), drill: '2-letter', prompt: 'QI', response: correct ? 'QI' : 'XX', correct, latencyMs })
describe('training metrics', () => {
  beforeEach(() => localStorage.clear())
  it('calculates accuracy and average latency', () => { const attempts = [attempt(true, 1000), attempt(false, 3000), attempt(true, 2000)]; expect(accuracy(attempts)).toBe(67); expect(averageLatency(attempts)).toBe(2000) })
  it('persists newest attempts locally', () => { const saved = saveAttempt(attempt(true, 500)); expect(saved).toHaveLength(1); expect(JSON.parse(localStorage.getItem('scrabbler.attempts.v1')!)[0].prompt).toBe('QI') })
  it('merges local and remote attempts without duplicating IDs', () => { const local = attempt(true, 500); const remote = { ...local, response: 'XX', correct: false }; const merged = mergeAttempts([local], [remote, attempt(true, 700)]); expect(merged).toHaveLength(2); expect(merged.find((item) => item.id === local.id)?.correct).toBe(true) })
  it('derives mastery from accuracy and speed', () => { expect(masteryFor(0, 0, 0)).toBe('UNKNOWN'); expect(masteryFor(2, 1, 4000)).toBe('RECALLABLE'); expect(masteryFor(4, 1, 1000)).toBe('AUTOMATIC') })
  it('prioritizes weak words for adaptive selection', () => { const weak = attempt(false, 5000); const strong = { ...attempt(true, 700), prompt: 'ZA', response: 'ZA' }; const stats = wordStats([strong, weak]); expect(stats[0].spelling).toBe('QI'); expect(selectAdaptiveWord([{ spelling: 'QI', length: 2, signature: 'IQ', category: '2-letter', sourceSection: 'test' }, { spelling: 'ZA', length: 2, signature: 'AZ', category: '2-letter', sourceSection: 'test' }], [strong, weak], () => 0).spelling).toBe('QI') })
})
describe('word helpers', () => {
  it('normalizes and compares anagrams', () => { expect(normalize(' q-i ')).toBe('QI'); expect(isAnagram('TISANE', 'NAIEST')).toBe(true); expect(isAnagram('QI', 'QA')).toBe(false) })
  it('scores standard tiles and only accepts words buildable from a rack', () => { expect(scoreWord('QUIZ')).toBe(22); expect(canBuildFromRack('QUIZ', 'QUIZAEIN')).toBe(true); expect(canBuildFromRack('QUEUE', 'QUIZAEIN')).toBe(false); expect(wordsFromRack('AEINSTQR').every((word) => word.length >= 2 && word.length <= 8)).toBe(true) })
  it('creates board positions and scores legal tournament plays', () => { const position = createTournamentPosition(() => 0); expect(position.board).toHaveLength(15); expect(position.board[7].filter(Boolean).length).toBe(position.anchor.length); expect(isLegalSourcePlay('QI', 'QIAAAAA')).toBe(true); expect(scoreMove('QI', 'QIAAAAA')).toBe(11) })
})
