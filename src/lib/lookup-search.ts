export const PAGE_SIZE_OPTIONS = [50, 100, 200] as const
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]
export const DEFAULT_PAGE_SIZE: PageSize = 100

const normalizeQuery = (value: string) => value.trim().toUpperCase().replace(/[^A-Z?]/g, '')
const sortedLetters = (value: string) => [...value].sort().join('')

export type QueryKeys = { q: string; sortedQ: string }
export const queryKeys = (query: string): QueryKeys => {
  const q = normalizeQuery(query)
  return { q, sortedQ: sortedLetters(q) }
}

export const matchRank = (spelling: string, signature: string, keys: QueryKeys): number => {
  const { q, sortedQ } = keys
  if (!q) return -1
  if (spelling === q) return 0
  if (spelling.startsWith(q)) return 1
  if (spelling.includes(q)) return 2
  if (signature === sortedQ) return 3
  return signature.includes(sortedQ) ? 4 : -1
}

export const rankMatches = (
  spellings: string[],
  signatures: string[],
  keys: QueryKeys,
  include: (index: number) => boolean,
): number[][] => {
  const buckets: number[][] = [[], [], [], [], []]
  if (!keys.q) return buckets
  for (let index = 0; index < spellings.length; index += 1) {
    if (!include(index)) continue
    const rank = matchRank(spellings[index] as string, signatures[index] as string, keys)
    if (rank >= 0) buckets[rank]?.push(index)
  }
  return buckets
}

export const flattenRanks = <T,>(buckets: T[][]): T[] => {
  const flat: T[] = []
  for (const bucket of buckets) for (const item of bucket) flat.push(item)
  return flat
}

export const pageCountFor = (total: number, pageSize: number) => (total <= 0 ? 0 : Math.ceil(total / pageSize))
export const clampPage = (page: number, pageCount: number) => Math.min(Math.max(1, page), Math.max(1, pageCount))

export const pageSlice = <T,>(items: T[], indexes: Uint32Array, page: number, pageSize: number): T[] => {
  const start = (page - 1) * pageSize
  const end = Math.min(start + pageSize, indexes.length)
  const slice: T[] = []
  for (let index = start; index < end; index += 1) slice.push(items[indexes[index] as number] as T)
  return slice
}
export const resultRange = (page: number, pageSize: number, total: number) => {
  const start = (page - 1) * pageSize + 1
  return total <= 0 || start > total ? null : { start, end: Math.min(page * pageSize, total) }
}

export type PageToken = number | 'ellipsis'
export const pageTokens = (page: number, pageCount: number): PageToken[] => {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1)
  const tokens: PageToken[] = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(pageCount - 1, page + 1)
  if (start > 2) tokens.push('ellipsis')
  for (let current = start; current <= end; current += 1) tokens.push(current)
  if (end < pageCount - 1) tokens.push('ellipsis')
  tokens.push(pageCount)
  return tokens
}

export type LookupInitRequest = { type: 'init'; data: string }
export type LookupSearchRequest = { type: 'search'; id: number; query: string; twoLetterOnly: boolean }
export type LookupWorkerRequest = LookupInitRequest | LookupSearchRequest
export type LookupWorkerResponse = { type: 'ready' } | { type: 'result'; id: number; total: number; indexes: Uint32Array }
