import { bingoFamilies, canBuildFromRack, normalize, scoreWord, uniqueSourceWords, wordsFromRack, type Word } from '../data/words'

export const tileDistribution: Record<string, number> = { A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4, M: 2, N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1, '?': 2 }
export const createTileBag = () => Object.entries(tileDistribution).flatMap(([letter, count]) => Array.from({ length: count }, () => letter))
export const randomFloat = () => {
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(1)
    globalThis.crypto.getRandomValues(values)
    return values[0] / 2 ** 32
  }
  return Math.random()
}
export const drawTiles = (bag: string[], count: number, random = randomFloat) => {
  const drawn: string[] = []
  while (drawn.length < count && bag.length) drawn.push(bag.splice(Math.floor(random() * bag.length), 1)[0])
  return drawn
}

export type RackPlay = Word & { score: number; leave: string }

export const randomRack = (size = 7, random = randomFloat) => {
  const bag = createTileBag(); const rack = drawTiles(bag, size, random)
  return rack.sort().join('')
}

export const rackPlays = (rack: string): RackPlay[] => wordsFromRack(rack).map((word) => {
  const remaining = [...normalize(rack)]
  for (const letter of normalize(word.spelling)) remaining.splice(remaining.indexOf(letter), 1)
  return { ...word, score: scoreWord(word.spelling), leave: remaining.sort().join('') }
})

export const anagramsFor = (word: string) => {
  const normalized = normalize(word); return uniqueSourceWords.filter((candidate) => candidate.spelling.length === normalized.length && candidate.signature === [...normalized].sort().join(''))
}

export const hooksFor = (word: string) => {
  const normalized = normalize(word); const front: string[] = []; const back: string[] = []
  for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    if (uniqueSourceWords.some((candidate) => candidate.spelling === `${letter}${normalized}`)) front.push(letter)
    if (uniqueSourceWords.some((candidate) => candidate.spelling === `${normalized}${letter}`)) back.push(letter)
  }
  return { front, back }
}

export const extensionsFor = (word: string) => {
  const normalized = normalize(word); return uniqueSourceWords.filter((candidate) => candidate.spelling.length > normalized.length && (candidate.spelling.startsWith(normalized) || candidate.spelling.endsWith(normalized))).sort((a, b) => a.length - b.length || a.spelling.localeCompare(b.spelling))
}

export const bingoFamilyFor = (word: string) => bingoFamilies.find((family) => family.stem === normalize(word) || family.answers.includes(normalize(word))) ?? null
export const dumpPlaysFor = (rack: string) => rackPlays(rack).filter((word) => word.category.endsWith('dump'))
export const hasRackWord = (word: string, rack: string) => uniqueSourceWords.some((candidate) => candidate.spelling === normalize(word)) && canBuildFromRack(word, rack)
