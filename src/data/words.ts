import bingoSeed from './bingo-families.json'
import sourceWords from './source-words.json'

export type DrillType = '2-letter' | 'power' | 'bingo' | 'dumps' | 'all' | 'mixed'
export type WordCategory = '2-letter' | '3-letter' | 'power' | 'bingo' | 'high-probability-bingo' | 'i-dump' | 'u-dump' | 'vowel-dump'

export type Word = {
  spelling: string
  length: number
  signature: string
  category: WordCategory
  sourceSection: string
}

export type BingoFamily = { stem: string; answers: string[] }
export type DictionarySourceId = 'focused' | 'full'
export type DictionarySourceOption = {
  id: DictionarySourceId
  label: string
  description: string
  available: boolean
  wordCount: number
}

const signature = (word: string) => [...word.toUpperCase()].sort().join('')
const makeWords = (items: typeof sourceWords): Word[] => items.map(({ spelling, category, sourceSection }) => ({ spelling, length: spelling.length, signature: signature(spelling), category: category as WordCategory, sourceSection }))

export const bingoFamilies: BingoFamily[] = bingoSeed
export const words: Word[] = makeWords(sourceWords)
const focusedDictionaryWords = [...new Map(words.map((word) => [word.spelling, word])).values()]

// The complete CSW24 file will be added here once it is supplied. Keeping this
// source explicit lets the tournament UI expose the choice without silently
// treating the focused study source as a full dictionary.
const fullDictionaryWords: Word[] = []

export const dictionarySourceOptions: DictionarySourceOption[] = [
  { id: 'focused', label: 'Focused study source', description: 'The curated words from Word Study.pdf.', available: true, wordCount: focusedDictionaryWords.length },
  { id: 'full', label: 'Full CSW24 dictionary', description: 'Available after the complete CSW24 file is imported.', available: fullDictionaryWords.length > 0, wordCount: fullDictionaryWords.length },
]

export const wordsForDictionary = (source: DictionarySourceId = 'focused') => source === 'full' ? fullDictionaryWords : focusedDictionaryWords

export const categoryLabels: Record<WordCategory, string> = {
  '2-letter': '2-letter words', '3-letter': '3-letter words', power: 'J/Q/X/Z words', bingo: 'Bingo family', 'high-probability-bingo': 'High-probability bingo', 'i-dump': 'I dumps', 'u-dump': 'U dumps', 'vowel-dump': 'Vowel dumps',
}

export const wordsForDrill = (drill: DrillType): Word[] => {
  if (drill === '2-letter') return words.filter((word) => word.category === '2-letter')
  if (drill === 'power') return words.filter((word) => word.category === 'power')
  if (drill === 'dumps') return words.filter((word) => word.category.endsWith('dump'))
  if (drill === 'all') return uniqueSourceWords
  if (drill === 'mixed') return uniqueSourceWords
  return []
}

export const normalize = (value: string) => value.trim().toUpperCase().replace(/[^A-Z?]/g, '')
export const isAnagram = (first: string, second: string) => normalize(first) === normalize(second) ? true : signature(normalize(first)) === signature(normalize(second))

export const tileValues: Record<string, number> = { A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10 }
export const tileValue = (letter: string, blank = false) => blank ? 0 : tileValues[normalize(letter).slice(0, 1)] ?? 0
export const scoreWord = (word: string) => [...normalize(word)].reduce((total, letter) => total + (tileValues[letter] ?? 0), 0)
export const canBuildFromRack = (word: string, rack: string) => {
  const available = [...normalize(rack)]
  return [...normalize(word)].every((letter) => {
    const index = available.indexOf(letter)
    if (index >= 0) { available.splice(index, 1); return true }
    const blankIndex = available.indexOf('?')
    if (blankIndex < 0) return false
    available.splice(blankIndex, 1)
    return true
  })
}
export const uniqueSourceWords = focusedDictionaryWords
export const wordsFromRack = (rack: string) => uniqueSourceWords.filter((word) => word.length >= 2 && word.length <= 8 && canBuildFromRack(word.spelling, rack)).sort((a, b) => b.length - a.length || a.spelling.localeCompare(b.spelling))
