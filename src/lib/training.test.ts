import { describe, expect, it, beforeEach } from 'vitest'
import { accuracy, averageLatency, masteryFor, mergeAttempts, saveAttempt, selectAdaptiveWord, wordStats, type Attempt } from './training'
import { canBuildFromRack, isAnagram, normalize, scoreWord, wordsFromRack } from '../data/words'
import { BOARD_SIZE, CENTER, createTournamentGame, createTournamentPosition, emptyBoard, findBestMove, isLegalSourcePlay, passTurn, playGameMove, playMove, premiumAt, scoreMove, validatePlacement, type TournamentGame } from './tournament'
import { createTileBag } from './scrabble'

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
  it('uses the standard tile bag and premium-square layout', () => { expect(createTileBag()).toHaveLength(100); expect(premiumAt(0, 0)).toBe('triple-word'); expect(premiumAt(CENTER, CENTER)).toBe('double-word'); expect(premiumAt(1, 5)).toBe('triple-letter'); expect(premiumAt(0, 1)).toBeNull() })
  it('enforces opening, connection, rack, and cross-word legality', () => {
    expect(validatePlacement(emptyBoard(), 'QI', { word: 'QI', row: 0, column: 0, direction: 'horizontal' }).reason).toContain('center')
    const opening = playMove(emptyBoard(), 'QI', { word: 'QI', row: CENTER, column: CENTER, direction: 'horizontal' })
    expect(opening.legal).toBe(true)
    expect(validatePlacement(opening.board!, 'AT', { word: 'AT', row: 0, column: 0, direction: 'horizontal' }).reason).toContain('connect')
    expect(validatePlacement(opening.board!, 'AT', { word: 'AT', row: CENTER, column: CENTER, direction: 'horizontal' }).reason).toContain('conflicts')
    const cross = validatePlacement(opening.board!, 'IN', { word: 'IN', row: CENTER + 1, column: CENTER, direction: 'horizontal' })
    expect(cross.legal).toBe(true)
    expect(cross.formedWords.map((word) => word.word)).toEqual(['IN', 'QI', 'IN'])
    expect(validatePlacement(opening.board!, 'AX', { word: 'OX', row: CENTER + 1, column: CENTER, direction: 'horizontal' }).reason).toContain('tiles')
  })
  it('applies premium scoring and bingo bonuses only to newly placed tiles', () => {
    const move = playMove(emptyBoard(), 'QI', { word: 'QI', row: CENTER, column: CENTER, direction: 'horizontal' })
    expect(move.score).toBe(22)
    expect(move.formedWords[0].score).toBe(22)
    const bingo = playMove(emptyBoard(), 'TISANES', { word: 'TISANES', row: CENTER, column: CENTER, direction: 'horizontal' })
    expect(bingo.legal).toBe(true)
    expect(bingo.bingo).toBe(true)
    expect(bingo.score).toBeGreaterThanOrEqual(50)
  })
  it('applies double/triple-letter premiums and blank values correctly', () => {
    const doubleLetterBoard = emptyBoard()
    doubleLetterBoard[CENTER][CENTER - 3] = { letter: 'T', isBlank: false, player: 'opponent' }
    const doubleLetter = playMove(doubleLetterBoard, 'A', { word: 'AT', row: CENTER, column: CENTER - 4, direction: 'horizontal' })
    expect(doubleLetter.legal).toBe(true)
    expect(doubleLetter.score).toBe(3)

    const tripleLetterBoard = emptyBoard()
    tripleLetterBoard[CENTER - 2][CENTER - 3] = { letter: 'A', isBlank: false, player: 'opponent' }
    const tripleLetter = playMove(tripleLetterBoard, 'T', { word: 'AT', row: CENTER - 2, column: CENTER - 3, direction: 'horizontal' })
    expect(tripleLetter.legal).toBe(true)
    expect(tripleLetter.score).toBe(4)

    const blank = playMove(emptyBoard(), '?I', { word: 'QI', row: CENTER, column: CENTER, direction: 'horizontal' })
    expect(blank.legal).toBe(true)
    expect(blank.placedTiles[0].isBlank).toBe(true)
    expect(blank.score).toBe(2)
  })
  it('scores each formed word separately when a play connects in multiple directions', () => {
    const opening = playMove(emptyBoard(), 'QI', { word: 'QI', row: CENTER, column: CENTER, direction: 'horizontal' })
    const cross = playMove(opening.board!, 'IN', { word: 'IN', row: CENTER + 1, column: CENTER, direction: 'horizontal' })
    expect(cross.legal).toBe(true)
    expect(cross.formedWords.map((word) => word.score)).toEqual([3, 11, 3])
    expect(cross.score).toBe(17)
  })
  it('finds connected opponent plays and alternates real turns', () => {
    const best = findBestMove(emptyBoard(), 'QI')
    expect(best).not.toBeNull()
    expect(best && (best.direction === 'horizontal' ? best.row : best.column)).toBe(CENTER)
    const base = createTournamentGame(() => 0.5)
    const game: TournamentGame = { ...base, bag: ['A', 'E', 'I', 'N', 'S', 'T', 'R'], racks: { human: 'QI', opponent: 'IN' }, currentPlayer: 'human' }
    const played = playGameMove(game, { word: 'QI', row: CENTER, column: CENTER, direction: 'horizontal' }, 'human', () => 0)
    expect(played.move.legal).toBe(true)
    expect(played.game.currentPlayer).toBe('opponent')
    const opponent = playGameMove(played.game, { word: 'IN', row: CENTER + 1, column: CENTER, direction: 'horizontal' }, 'opponent', () => 0)
    expect(opponent.move.legal).toBe(true)
    expect(opponent.game.currentPlayer).toBe('human')
    expect(opponent.game.history.map((turn) => turn.player)).toEqual(['human', 'opponent'])
  })
  it('applies standard rack-out and pass end-game adjustments', () => {
    const base = createTournamentGame(() => 0.5)
    const rackOut: TournamentGame = { ...base, bag: [], racks: { human: 'QI', opponent: 'AE' }, currentPlayer: 'human' }
    const finished = playGameMove(rackOut, { word: 'QI', row: CENTER, column: CENTER, direction: 'horizontal' }, 'human').game
    expect(finished.finished).toBe(true)
    expect(finished.endReason).toBe('empty-rack')
    expect(finished.scores).toEqual({ human: 26, opponent: -4 })
    let passed = base
    for (let index = 0; index < 6; index += 1) passed = passTurn(passed)
    expect(passed.finished).toBe(true)
    expect(passed.endReason).toBe('passes')
  })
})
