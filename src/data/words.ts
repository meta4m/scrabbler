import bingoSeed from './bingo-families.json'
import sourceWords from './source-words.json'

export type DrillType = '2-letter' | 'power' | 'bingo' | 'dumps' | 'all' | 'mixed'
export type WordCategory = '2-letter' | '3-letter' | 'power' | 'bingo' | 'high-probability-bingo' | 'i-dump' | 'u-dump' | 'vowel-dump' | 'csw24'

export type Word = {
  spelling: string
  length: number
  signature: string
  category: WordCategory
  sourceSection: string
  definition?: string
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

const makeWords = (items: typeof sourceWords): Word[] => items.map(({ spelling, category, sourceSection }) => ({ spelling, length: spelling.length, signature: signature(spelling), category: category as WordCategory, sourceSection }))

export const bingoFamilies: BingoFamily[] = bingoSeed
export const words: Word[] = makeWords(sourceWords)
const focusedDictionaryWords = [...new Map(words.map((word) => [word.spelling, word])).values()]
const focusedWordSet = new Set(focusedDictionaryWords.map((word) => word.spelling))

const categoriesBySpelling = new Map<string, Set<WordCategory>>()
for (const word of sourceWords) {
  const set = categoriesBySpelling.get(word.spelling) ?? new Set<WordCategory>()
  set.add(word.category as WordCategory)
  categoriesBySpelling.set(word.spelling, set)
}
export const categoriesForWord = (spelling: string): WordCategory[] => {
  const norm = normalize(spelling)
  const set = categoriesBySpelling.get(norm)
  if (!set) {
    const fallback = words.find((word) => word.spelling === norm)?.category
    return fallback ? [fallback] : []
  }
  return [...set]
}

let fullDictionaryWords: Word[] = []
const fullWordSet = new Set<string>()
let fullDictionaryLoaded = false
let fullDictionaryPromise: Promise<Word[]> | null = null

let definitionMap: Map<string, string> | null = null
let definitionMapPromise: Promise<Map<string, string>> | null = null

export const loadFullDictionary = async (): Promise<Word[]> => {
  if (fullDictionaryLoaded) return fullDictionaryWords
  if (fullDictionaryPromise) return fullDictionaryPromise
  fullDictionaryPromise = import('./csw24.json').then((module) => {
    const list = module.default as string[]
    fullDictionaryWords = list.map((spelling) => ({ spelling, length: spelling.length, signature: signature(spelling), category: 'csw24' as WordCategory, sourceSection: 'CSW24' }))
    fullWordSet.clear()
    for (const word of fullDictionaryWords) fullWordSet.add(word.spelling)
    fullDictionaryLoaded = true
    return fullDictionaryWords
  })
  return fullDictionaryPromise
}

export const isFullDictionaryLoaded = () => fullDictionaryLoaded

const loadDefinitionMap = async (): Promise<Map<string, string>> => {
  if (definitionMap) return definitionMap
  if (definitionMapPromise) return definitionMapPromise
  definitionMapPromise = import('./csw24-with-definitions.json').then((module) => {
    const entries = module.default as Array<{ word: string; definition: string }>
    definitionMap = new Map(entries.map((entry) => [entry.word, entry.definition] as const))
    return definitionMap
  })
  return definitionMapPromise
}

export const definitionForWord = async (word: string): Promise<string | null> => {
  const map = await loadDefinitionMap()
  return map.get(normalize(word)) ?? null
}

export const syncDefinitionForWord = (word: string): string | null => {
  if (!definitionMap) return null
  return definitionMap.get(normalize(word)) ?? null
}

export const dictionarySourceOptions: DictionarySourceOption[] = [
  { id: 'focused', label: 'Focused study source', description: 'The curated words from Word Study.pdf.', available: true, wordCount: focusedDictionaryWords.length },
  { id: 'full', label: 'Full CSW24 dictionary', description: 'The complete Collins Scrabble Words 2024 lexicon — 280,887 words, lazy-loaded.', available: true, wordCount: 280887 },
]

export const wordsForDictionary = (source: DictionarySourceId = 'focused'): Word[] => source === 'full' ? (fullDictionaryLoaded ? fullDictionaryWords : focusedDictionaryWords) : focusedDictionaryWords
export const wordsForDictionaryAsync = async (source: DictionarySourceId = 'focused'): Promise<Word[]> => {
  if (source === 'full') return loadFullDictionary()
  return focusedDictionaryWords
}

export const hasWord = (word: string, source: DictionarySourceId = 'focused'): boolean => {
  const normalized = normalize(word)
  if (source === 'focused') return focusedWordSet.has(normalized)
  if (fullDictionaryLoaded) return fullWordSet.has(normalized)
  return focusedWordSet.has(normalized)
}

export const hasWordAsync = async (word: string, source: DictionarySourceId = 'focused'): Promise<boolean> => {
  const normalized = normalize(word)
  if (source === 'focused') return focusedWordSet.has(normalized)
  if (!fullDictionaryLoaded) await loadFullDictionary()
  return fullWordSet.has(normalized)
}

export const categoryLabels: Record<WordCategory, string> = {
  '2-letter': '2-letter words', '3-letter': '3-letter words', power: 'J/Q/X/Z words', bingo: 'Bingo family', 'high-probability-bingo': 'High-probability bingo', 'i-dump': 'I dumps', 'u-dump': 'U dumps', 'vowel-dump': 'Vowel dumps', csw24: 'CSW24',
}

export const wordsForDrill = (drill: DrillType): Word[] => {
  if (drill === '2-letter') return words.filter((word) => word.category === '2-letter')
  if (drill === 'power') return words.filter((word) => word.category === 'power')
  if (drill === 'dumps') return words.filter((word) => word.category.endsWith('dump'))
  if (drill === 'all') return uniqueSourceWords
  if (drill === 'mixed') return uniqueSourceWords
  return []
}

export const uniqueSourceWords = focusedDictionaryWords
export const wordsFromRack = (rack: string, source: DictionarySourceId = 'focused'): Word[] => wordsForDictionary(source).filter((word) => word.length >= 2 && word.length <= 8 && canBuildFromRack(word.spelling, rack)).sort((a, b) => b.length - a.length || a.spelling.localeCompare(b.spelling))

export type LookupCategory = 'all' | '2-letter' | 'power' | 'dump' | 'csw24'

export const filterLookupWords = (
  words: Word[],
  query: string,
  category: LookupCategory,
  dictionary: DictionarySourceId,
): Word[] => {
  const q = normalize(query)
  if (!q) return []
  return words.filter((word) => {
    const matchesQuery = word.spelling.includes(q) || word.signature.includes(q)
    const matchesCategory = dictionary === 'full'
      ? (category === '2-letter' ? word.length === 2 : true)
      : category === 'all' ? true
      : category === 'csw24' ? word.category === 'csw24'
      : category === 'dump' ? categoriesForWord(word.spelling).some((cat) => cat.endsWith('dump'))
      : categoriesForWord(word.spelling).includes(category)
    return matchesQuery && matchesCategory
  })
}

export const wordsFromRackAsync = async (rack: string, source: DictionarySourceId = 'focused'): Promise<Word[]> => {
  const dictionary = await wordsForDictionaryAsync(source)
  return dictionary.filter((word) => word.length >= 2 && word.length <= 8 && canBuildFromRack(word.spelling, rack)).sort((a, b) => b.length - a.length || a.spelling.localeCompare(b.spelling))
}
