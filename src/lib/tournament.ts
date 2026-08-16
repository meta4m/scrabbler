import { canBuildFromRack, normalize, scoreWord, uniqueSourceWords, type Word } from '../data/words'
import { randomRack } from './scrabble'

export type Board = Array<Array<string | null>>
export type TournamentPosition = { board: Board; anchor: string; rack: string; boardRow: number; boardStart: number }

export const emptyBoard = (): Board => Array.from({ length: 15 }, () => Array<string | null>(15).fill(null))
export const createTournamentPosition = (random = Math.random): TournamentPosition => {
  const board = emptyBoard(); const candidates = uniqueSourceWords.filter((word) => word.length >= 4 && word.length <= 7); const anchorWord = candidates[Math.floor(random() * Math.max(candidates.length, 1))]?.spelling ?? 'TISANE'; const row = 7; const start = Math.floor((15 - anchorWord.length) / 2)
  ;[...anchorWord].forEach((letter, index) => { board[row][start + index] = letter })
  return { board, anchor: anchorWord, rack: randomRack(7, random), boardRow: row, boardStart: start }
}
export const isLegalSourcePlay = (word: string, rack: string) => {
  const normalized = normalize(word); return normalized.length >= 2 && normalized.length <= 8 && uniqueSourceWords.some((candidate) => candidate.spelling === normalized) && canBuildFromRack(normalized, rack)
}
export const scoreMove = (word: string, rack: string) => isLegalSourcePlay(word, rack) ? scoreWord(word) : 0
export const wordAt = (position: TournamentPosition, row: number, column: number) => position.board[row]?.[column] ?? null
export const categoryForPlay = (word: string): Word | undefined => uniqueSourceWords.find((candidate) => candidate.spelling === normalize(word))
