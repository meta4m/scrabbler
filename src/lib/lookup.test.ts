import { describe, it, expect, vi, afterEach } from 'vitest'
import sourceWords from '../data/source-words.json'
import csw24Words from '../data/csw24.json'
import { categoriesForWord, filterLookupWords, normalize, wordsForDictionary, type Word } from '../data/words'
import { clampPage, matchRank, pageCountFor, pageSlice, pageTokens, queryKeys, resultRange, type LookupWorkerRequest, type LookupWorkerResponse } from './lookup-search'

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

describe('matchRank: relevance ranking rules', () => {
  const keys = queryKeys('SCOP')

  it('normalizes and alphabetizes the query for signature matching', () => {
    expect(keys).toEqual({ q: 'SCOP', sortedQ: 'COPS' })
    expect(queryKeys(' scop ').q).toBe('SCOP')
  })

  it('ranks an exact spelling match as rank 0', () => {
    expect(matchRank('SCOP', 'COPS', keys)).toBe(0)
  })

  it('ranks a spelling prefix match as rank 1', () => {
    expect(matchRank('SCOPA', 'ACOPS', keys)).toBe(1)
  })

  it('ranks a spelling substring match as rank 2', () => {
    expect(matchRank('HOROSCOPE', 'CEHOOOPRS', keys)).toBe(2)
  })

  it('ranks an exact anagram (signature equality) as rank 3', () => {
    expect(matchRank('COPS', 'COPS', keys)).toBe(3)
  })

  it('ranks a signature substring match as rank 4', () => {
    expect(matchRank('SSPOC', 'COPSS', keys)).toBe(4)
  })

  it('returns -1 when the word does not match the query', () => {
    expect(matchRank('QI', 'IQ', keys)).toBe(-1)
    expect(matchRank('SCOP', 'COPS', queryKeys(''))).toBe(-1)
  })
})

describe('filterLookupWords: ranked result ordering', () => {
  const mk = (spelling: string): Word => ({ spelling, length: spelling.length, signature: [...spelling].sort().join(''), category: 'csw24', sourceSection: 'CSW24' })

  it('orders exact, prefix, substring, anagram, then signature matches', () => {
    const words = [mk('HOROSCOPE'), mk('COPS'), mk('SSPOC'), mk('SCOPA'), mk('SCOP')]
    const result = filterLookupWords(words, 'scop', 'all', 'full')
    expect(result.map((w) => w.spelling)).toEqual(['SCOP', 'SCOPA', 'HOROSCOPE', 'COPS', 'SSPOC'])
  })

  it('finds anagram variants regardless of the typed letter order', () => {
    const words = [mk('TISANE'), mk('TENAIS')]
    const result = filterLookupWords(words, 'satine', 'all', 'full')
    expect(result.map((w) => w.spelling)).toEqual(['TENAIS', 'TISANE'])
  })

  it('keeps words inside one rank bucket in alphabetical order', () => {
    const words = [mk('ZSCOPA'), mk('ASCOPA'), mk('MSCOPA')]
    const result = filterLookupWords(words, 'scop', 'all', 'full')
    expect(result.map((w) => w.spelling)).toEqual(['ASCOPA', 'MSCOPA', 'ZSCOPA'])
  })
})

describe('filterLookupWords: full CSW24 regression (SCOP must be reachable)', () => {
  const full: Word[] = csw24Words.map((spelling) => ({ spelling, length: spelling.length, signature: [...spelling].sort().join(''), category: 'csw24' as const, sourceSection: 'CSW24' }))

  it('imports the full CSW24 word list', () => {
    expect(full.length).toBe(280887)
    expect(csw24Words).toContain('SCOP')
  })

  it('ranks SCOP itself first for the query "scop"', () => {
    const result = filterLookupWords(full, 'scop', 'all', 'full')
    expect(result[0]?.spelling).toBe('SCOP')
  })

  it('keeps SCOP on page 1 at the default page size of 100', () => {
    const result = filterLookupWords(full, 'scop', 'all', 'full')
    expect(result.slice(0, 100).map((w) => w.spelling)).toContain('SCOP')
  })

  it('exposes every match for pagination instead of truncating at 200', () => {
    const result = filterLookupWords(full, 'scop', 'all', 'full')
    expect(result.length).toBeGreaterThan(500)
    expect(new Set(result.map((w) => w.spelling)).size).toBe(result.length)
  })

  it('page 6 at size 100 still shows real matches deep in the result set', () => {
    const result = filterLookupWords(full, 'scop', 'all', 'full')
    const page6 = result.slice(500, 600)
    expect(page6.length).toBeGreaterThan(0)
    for (const word of page6) expect(word.spelling.includes('SCOP') || word.signature.includes('COPS')).toBe(true)
  })
})

describe('pagination helpers', () => {
  it('computes page counts from totals and page sizes', () => {
    expect(pageCountFor(0, 100)).toBe(0)
    expect(pageCountFor(1, 100)).toBe(1)
    expect(pageCountFor(100, 100)).toBe(1)
    expect(pageCountFor(101, 100)).toBe(2)
    expect(pageCountFor(570, 100)).toBe(6)
  })

  it('clamps page numbers into the valid range', () => {
    expect(clampPage(0, 5)).toBe(1)
    expect(clampPage(1, 0)).toBe(1)
    expect(clampPage(3, 5)).toBe(3)
    expect(clampPage(9, 5)).toBe(5)
  })

  it('computes the visible result range', () => {
    expect(resultRange(1, 100, 0)).toBe(null)
    expect(resultRange(1, 100, 570)).toEqual({ start: 1, end: 100 })
    expect(resultRange(6, 100, 570)).toEqual({ start: 501, end: 570 })
    expect(resultRange(2, 50, 40)).toBe(null)
  })

  it('builds compact page token lists with ellipses', () => {
    expect(pageTokens(1, 1)).toEqual([1])
    expect(pageTokens(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(pageTokens(1, 11)).toEqual([1, 2, 'ellipsis', 11])
    expect(pageTokens(2, 11)).toEqual([1, 2, 3, 'ellipsis', 11])
    expect(pageTokens(5, 11)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 11])
    expect(pageTokens(10, 11)).toEqual([1, 'ellipsis', 9, 10, 11])
    expect(pageTokens(11, 11)).toEqual([1, 'ellipsis', 10, 11])
  })

  it('maps ranked result indexes onto the current page', () => {
    const items = ['SCOP', 'SCOPA', 'HOROSCOPE', 'COPS', 'SSPOC']
    const indexes = new Uint32Array([0, 1, 2, 3, 4])
    expect(pageSlice(items, indexes, 1, 2)).toEqual(['SCOP', 'SCOPA'])
    expect(pageSlice(items, indexes, 2, 2)).toEqual(['HOROSCOPE', 'COPS'])
    expect(pageSlice(items, indexes, 3, 2)).toEqual(['SSPOC'])
    expect(pageSlice(items, indexes, 4, 2)).toEqual([])
  })
})

describe('lookup.worker: message protocol', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  const startWorker = async () => {
    const posted: LookupWorkerResponse[] = []
    const workerSelf: { onmessage: ((event: { data: LookupWorkerRequest }) => void) | null; postMessage: (message: LookupWorkerResponse, transfer?: unknown[]) => void } = {
      onmessage: null,
      postMessage: (message) => { posted.push(message) },
    }
    vi.stubGlobal('self', workerSelf)
    await import('./lookup.worker')
    const send = (request: LookupWorkerRequest) => workerSelf.onmessage?.({ data: request })
    return { posted, send }
  }

  it('initializes from the joined word payload and answers with ranked, transferred indexes', async () => {
    const { posted, send } = await startWorker()
    send({ type: 'init', data: 'SCOP\nSCOPA\nHOROSCOPE\nCOPS\nCO' })
    expect(posted).toEqual([{ type: 'ready' }])
    send({ type: 'search', id: 1, query: 'scop', twoLetterOnly: false })
    const result = posted[1]
    expect(result?.type).toBe('result')
    if (result?.type !== 'result') return
    expect(result.id).toBe(1)
    expect(result.total).toBe(4)
    expect(Array.from(result.indexes)).toEqual([0, 1, 2, 3])
    send({ type: 'search', id: 2, query: 'co', twoLetterOnly: true })
    const twoLetter = posted[2]
    if (twoLetter?.type !== 'result') throw new Error('expected a result message')
    expect(twoLetter.total).toBe(1)
    expect(Array.from(twoLetter.indexes)).toEqual([4])
    send({ type: 'search', id: 3, query: '', twoLetterOnly: false })
    const empty = posted[3]
    if (empty?.type !== 'result') throw new Error('expected a result message')
    expect(empty.total).toBe(0)
    expect(Array.from(empty.indexes)).toEqual([])
  })
})
