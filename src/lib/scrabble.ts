import { bingoFamilies, canBuildFromRack, normalize, scoreWord, uniqueSourceWords, wordsFromRack, type Word } from '../data/words'

const tileBag = 'AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHHHHIIIIIIIIIIJKLLLLLMMNNNNNNOOOOOOOOOPPQQRRRRRRSSSSSSSTTTTTTUUUUVVWWXYYZ'.split('')

export type RackPlay = Word & { score: number; leave: string }

export const randomRack = (size = 7, random = Math.random) => {
  const bag = [...tileBag]; const rack: string[] = []
  while (rack.length < size && bag.length) rack.push(bag.splice(Math.floor(random() * bag.length), 1)[0])
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
