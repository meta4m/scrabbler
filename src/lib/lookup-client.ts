import { useEffect, useMemo, useRef, useState } from 'react'
import { filterLookupWords, loadFullDictionary, wordsForDictionary, type DictionarySourceId, type LookupCategory, type Word } from '../data/words'
import { clampPage, pageCountFor, queryKeys, pageSlice, DEFAULT_PAGE_SIZE, type LookupWorkerRequest, type LookupWorkerResponse, type PageSize } from './lookup-search'

export type LookupSearchResult = { total: number; indexes: Uint32Array }

export type LookupSearchState = {
  results: Word[]
  total: number
  page: number
  pageCount: number
  pageSize: PageSize
  setPage: (page: number) => void
  setPageSize: (size: PageSize) => void
  loading: boolean
  searching: boolean
}

class LookupWorkerClient {
  private readonly worker: Worker
  private readonly readyPromise: Promise<void>
  private readonly pending = new Map<number, (result: LookupSearchResult) => void>()
  private nextId = 1

  constructor(data: string) {
    this.worker = new Worker(new URL('./lookup.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (event: MessageEvent<LookupWorkerResponse>) => {
      const response = event.data
      if (response.type !== 'result') return
      const resolve = this.pending.get(response.id)
      if (!resolve) return
      this.pending.delete(response.id)
      resolve({ total: response.total, indexes: response.indexes })
    }
    this.readyPromise = new Promise<void>((resolve) => {
      const onReady = (event: MessageEvent<LookupWorkerResponse>) => {
        if (event.data.type === 'ready') resolve()
      }
      this.worker.addEventListener('message', onReady, { once: true })
    })
    this.worker.postMessage({ type: 'init', data } as LookupWorkerRequest)
  }

  whenReady() { return this.readyPromise }

  search(query: string, twoLetterOnly: boolean): Promise<LookupSearchResult> {
    const id = this.nextId
    this.nextId += 1
    return new Promise((resolve) => {
      this.pending.set(id, resolve)
      this.worker.postMessage({ type: 'search', id, query, twoLetterOnly } as LookupWorkerRequest)
    })
  }
}

let workerClient: LookupWorkerClient | null = null

export const useLookupSearch = (query: string, category: LookupCategory, dictionary: DictionarySourceId): LookupSearchState => {
  const normalizedQuery = queryKeys(query).q
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE)
  const [page, setPage] = useState(1)
  const [fullWords, setFullWords] = useState<Word[] | null>(null)
  const [fullResult, setFullResult] = useState<LookupSearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchToken = useRef(0)

  useEffect(() => {
    if (dictionary !== 'full') return
    if (workerClient && fullWords) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    void loadFullDictionary().then((list) => {
      if (cancelled) return
      setFullWords(list)
      if (!workerClient) workerClient = new LookupWorkerClient(list.map((word) => word.spelling).join('\n'))
      void workerClient.whenReady().then(() => { if (!cancelled) setLoading(false) })
    })
    return () => { cancelled = true }
  }, [dictionary, fullWords])

  useEffect(() => {
    if (dictionary !== 'full' || loading || !workerClient) return
    if (!queryKeys(query).q) {
      searchToken.current += 1
      setSearching(false)
      setFullResult({ total: 0, indexes: new Uint32Array(0) })
      return
    }
    const token = searchToken.current + 1
    searchToken.current = token
    setSearching(true)
    void workerClient.search(query, category === '2-letter').then((result) => {
      if (searchToken.current !== token) return
      setFullResult(result)
      setSearching(false)
    })
  }, [dictionary, loading, query, category])

  useEffect(() => { setPage(1) }, [normalizedQuery, category, dictionary, pageSize])

  const focusedMatches = useMemo(
    () => (dictionary === 'focused' ? filterLookupWords(wordsForDictionary('focused'), query, category, 'focused') : []),
    [dictionary, query, category]
  )

  const total = dictionary === 'full' ? (fullResult?.total ?? 0) : focusedMatches.length
  const pageCount = pageCountFor(total, pageSize)
  const currentPage = clampPage(page, pageCount)

  const results = useMemo(() => {
    if (dictionary !== 'full') return focusedMatches.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    if (!fullResult || !fullWords) return []
    return pageSlice(fullWords, fullResult.indexes, currentPage, pageSize)
  }, [dictionary, fullResult, fullWords, currentPage, pageSize, focusedMatches])

  return { results, total, page: currentPage, pageCount, pageSize, setPage, setPageSize, loading, searching }
}
