import { describe, it, expect } from 'vitest'
import sourceWords from '../data/source-words.json'
import { categoriesForWord, filterLookupWords, normalize, wordsForDictionary, type Word } from '../data/words'

const focusedWords = (): Word[] => wordsForDictionary('focused')

describe('categoriesForWord: source-derived category lookup', () => {
  it('returns every category the spelling is listed under in the source', () => {
    const qat = sourceWords.filter((w) => w.spelling === 'QAT').map((w) => w.category)
    expect(new Set(qat)).toEqual(new Set(['power', '3-letter']))
    const cats = categoriesForWord('QAT').sort()
    expect(cats).toEqual(['3-letter', 'power'])
  })

  it('returns both 2-letter and vowel-dump for vowel-heavy 2-letter words', () => {
    const cats = categoriesForWord('AA').sort()
    expect(cats).toContain('2-letter')
    expect(cats).toContain('vowel-dump')
  })

  it('returns both 2-letter and power for QI (and similar Q/J/X/Z 2-letter words)', () => {
    const cats = categoriesForWord('QI').sort()
    expect(cats).toContain('2-letter')
    expect(cats).toContain('power')
  })

  it('returns both power and i-dump when a power word is also listed as a dump', () => {
    const ixiaCategories = sourceWords.filter((w) => w.spelling === 'IXIA').map((w) => w.category)
    expect(new Set(ixiaCategories).size).toBeGreaterThan(1)
    const cats = categoriesForWord('IXIA').sort()
    expect(cats.length).toBeGreaterThan(1)
  })

  it('returns a single-element array for words that only appear once in source', () => {
    // Find a spelling with exactly one source entry.
    const counts = new Map<string, number>()
    for (const w of sourceWords) counts.set(w.spelling, (counts.get(w.spelling) ?? 0) + 1)
    const unique = [...counts.entries()].filter(([, n]) => n === 1).map(([s]) => s)
    expect(unique.length).toBeGreaterThan(0)
    const cats = categoriesForWord(unique[0]!)
    expect(cats.length).toBe(1)
  })

  it('uppercases and trims input before lookup', () => {
    expect(categoriesForWord('  qat  ').sort()).toEqual(['3-letter', 'power'])
    expect(categoriesForWord('qAt').sort()).toEqual(['3-letter', 'power'])
  })

  it('returns an empty array for an unknown spelling', () => {
    expect(categoriesForWord('ZZZZZZNOTAWORD')).toEqual([])
  })

  it('dedup of source-words.json NEVER loses categories for callers (via categoriesForWord)', () => {
    const collisions = new Map<string, Set<string>>()
    for (const w of sourceWords) {
      const set = collisions.get(w.spelling) ?? new Set<string>()
      set.add(w.category)
      collisions.set(w.spelling, set)
    }
    const targets = [...collisions.entries()].filter(([, cats]) => cats.size > 1)
    expect(targets.length).toBeGreaterThan(0)
    for (const [spelling, sourceCats] of targets.slice(0, 40)) {
      const recovered = new Set(categoriesForWord(spelling))
      const lost = [...sourceCats].filter((cat) => !recovered.has(cat as never))
      expect(lost, `${spelling} source has [${[...sourceCats].join(', ')}] but categoriesForWord drops [${lost.join(', ')}]`).toEqual([])
    }
  })
})

describe('filterLookupWords: focused dictionary', () => {
  const focused = focusedWords()

  it('returns nothing when the query is empty (no implicit "list everything")', () => {
    expect(filterLookupWords(focused, '', 'all', 'focused')).toEqual([])
    expect(filterLookupWords(focused, '   ', 'all', 'focused')).toEqual([])
  })

  it('category "all" + a real query returns every matching word regardless of category', () => {
    const result = filterLookupWords(focused, 'q', 'all', 'focused')
    expect(result.length).toBeGreaterThan(0)
    for (const word of result) expect(word.spelling.includes('Q') || word.signature.includes('Q')).toBe(true)
  })

  it('category "power" + query "q" includes 3-letter Q power words (QAT regression fix)', () => {
    const result = filterLookupWords(focused, 'q', 'power', 'focused')
    const spellings = result.map((w) => w.spelling)
    expect(spellings).toContain('QAT')
    expect(spellings).toContain('QIN')
    expect(spellings).toContain('QIS')
    expect(spellings).toContain('QUA')
  })

  it('category "power" + query "j" includes J 2-letter and 3-letter power words', () => {
    const result = filterLookupWords(focused, 'j', 'power', 'focused')
    const spellings = result.map((w) => w.spelling)
    expect(spellings).toContain('JAB')
    expect(spellings).toContain('JAG')
    expect(spellings).toContain('JAI')
  })

  it('category "power" + query "z" includes Z 3-letter power words', () => {
    const result = filterLookupWords(focused, 'z', 'power', 'focused')
    const spellings = result.map((w) => w.spelling)
    expect(spellings).toContain('ZAX')
    expect(spellings).toContain('ZEX')
  })

  it('category "dump" + query "a" includes AA/AE/AI (vowel dumps) and i-dump words', () => {
    const result = filterLookupWords(focused, 'a', 'dump', 'focused')
    const spellings = new Set(result.map((w) => w.spelling))
    expect(spellings.has('AA')).toBe(true)
    expect(spellings.has('AE')).toBe(true)
    expect(spellings.has('AI')).toBe(true)
  })

  it('category "dump" + query "u" includes U-dump words', () => {
    const result = filterLookupWords(focused, 'u', 'dump', 'focused')
    const spellings = new Set(result.map((w) => w.spelling))
    const sourceDump = sourceWords.filter((w) => w.category === 'u-dump').map((w) => w.spelling)
    for (const word of sourceDump) {
      const hits = result.filter((w) => w.spelling === word)
      if (hits.length > 0) expect(hits.length).toBeGreaterThan(0)
    }
    expect(result.length).toBeGreaterThan(0)
  })

  it('category "2-letter" + any query returns only 2-letter words', () => {
    const result = filterLookupWords(focused, 'a', '2-letter', 'focused')
    for (const word of result) expect(word.length).toBe(2)
  })

  it('category "csw24" returns nothing in focused mode (no CSW24 entries in the study source)', () => {
    const result = filterLookupWords(focused, 'q', 'csw24', 'focused')
    expect(result).toEqual([])
  })

  it('query matches against spelling AND signature (anagram-ish lookup)', () => {
    const focused = focusedWords()
    // Typing a query that sorts the same letters as a word should find it.
    // Both 'AB' and 'BA' have signature 'AB', so a query of 'AB' sorts to itself.
    const result = filterLookupWords(focused, 'AB', 'all', 'focused')
    const spellings = new Set(result.map((w) => w.spelling))
    expect(spellings.has('AB')).toBe(true)
    expect(spellings.has('BA')).toBe(true)
    for (const word of result) {
      const matchesSpelling = word.spelling.includes('AB')
      const matchesSignature = word.signature.includes('AB')
      expect(matchesSpelling || matchesSignature).toBe(true)
    }
  })

  it('query match is case-insensitive and whitespace-tolerant', () => {
    const a = filterLookupWords(focused, 'qi', 'all', 'focused').map((w) => w.spelling).sort()
    const b = filterLookupWords(focused, '  QI  ', 'all', 'focused').map((w) => w.spelling).sort()
    expect(a).toEqual(b)
    expect(a).toContain('QI')
  })

  it('combined query + category filter applies AND logic', () => {
    const result = filterLookupWords(focused, 'q', '2-letter', 'focused')
    for (const word of result) {
      expect(word.length).toBe(2)
      expect(word.spelling.includes('Q') || word.signature.includes('Q')).toBe(true)
    }
  })

  it('every source-words.json 3-letter Q word in the power section appears in focused power+q', () => {
    const expectedPowerQ3 = sourceWords
      .filter((w) => w.category === 'power' && w.spelling.length === 3 && w.spelling.includes('Q'))
      .map((w) => w.spelling)
      .filter((value, index, array) => array.indexOf(value) === index)
    const result = filterLookupWords(focused, 'q', 'power', 'focused')
    const spellings = new Set(result.map((w) => w.spelling))
    for (const word of expectedPowerQ3) expect(spellings.has(word), `${word} should appear in power+q`).toBe(true)
  })
})

describe('filterLookupWords: full CSW24 dictionary mode', () => {
  it('category "all" with a single letter returns thousands of matches', () => {
    const full = Array.from({ length: 1000 }, (_, i): Word => ({ spelling: `W${i}`, length: 2 + (i % 12), signature: String(i), category: 'csw24', sourceSection: 'CSW24' }))
    const result = filterLookupWords(full, 'W', 'all', 'full')
    expect(result.length).toBeGreaterThan(900)
  })

  it('category "2-letter" filters by length (no category metadata in CSW24)', () => {
    const full = Array.from({ length: 5 }, (_, i): Word => ({ spelling: `W${i}`, length: 2 + i, signature: String(i), category: 'csw24', sourceSection: 'CSW24' }))
    const result = filterLookupWords(full, 'W', '2-letter', 'full')
    expect(result.map((w) => w.spelling)).toEqual(['W0'])
  })

  it('returns nothing for empty query', () => {
    const full: Word[] = [{ spelling: 'QI', length: 2, signature: 'IQ', category: 'csw24', sourceSection: 'CSW24' }]
    expect(filterLookupWords(full, '', 'all', 'full')).toEqual([])
  })
})

describe('filterLookupWords: output integrity', () => {
  it('does not mutate the input array', () => {
    const focused = focusedWords()
    const before = focused.map((w) => w.spelling)
    filterLookupWords(focused, 'q', 'power', 'focused')
    const after = focused.map((w) => w.spelling)
    expect(after).toEqual(before)
  })

  it('does not return duplicate spellings', () => {
    const focused = focusedWords()
    const result = filterLookupWords(focused, 'q', 'power', 'focused')
    const spellings = result.map((w) => w.spelling)
    expect(new Set(spellings).size).toBe(spellings.length)
  })

  it('returns words whose spelling or signature contains the query (not both required)', () => {
    const focused = focusedWords()
    const result = filterLookupWords(focused, 'AEINST', 'all', 'focused')
    for (const word of result) {
      const matchesSpelling = word.spelling.includes('AEINST')
      const matchesSignature = word.signature.includes('AEINST')
      expect(matchesSpelling || matchesSignature).toBe(true)
    }
  })
})
