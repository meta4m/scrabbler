import { flattenRanks, queryKeys, rankMatches, type LookupWorkerRequest, type LookupWorkerResponse } from './lookup-search'

type WorkerScope = {
  onmessage: ((event: MessageEvent<LookupWorkerRequest>) => void) | null
  postMessage: (message: LookupWorkerResponse, transfer?: Transferable[]) => void
}

const scope = self as unknown as WorkerScope

let spellings: string[] = []
let signatures: string[] = []

const postResult = (id: number, flat: number[]) => {
  const indexes = new Uint32Array(flat)
  scope.postMessage({ type: 'result', id, total: flat.length, indexes }, [indexes.buffer])
}

scope.onmessage = (event) => {
  const request = event.data
  if (request.type === 'init') {
    spellings = request.data.split('\n')
    signatures = spellings.map((spelling) => [...spelling].sort().join(''))
    scope.postMessage({ type: 'ready' })
    return
  }
  const keys = queryKeys(request.query)
  if (!keys.q) {
    postResult(request.id, [])
    return
  }
  const buckets = rankMatches(spellings, signatures, keys, (index) => !request.twoLetterOnly || (spellings[index] as string).length === 2)
  postResult(request.id, flattenRanks(buckets))
}
