export type D1Row = Record<string, unknown>

export type D1Statement = {
  bind: (...values: unknown[]) => D1Statement
  first: <T extends D1Row = D1Row>() => Promise<T | null>
  all: <T extends D1Row = D1Row>() => Promise<{ results: T[] }>
  run: () => Promise<unknown>
}

export type D1Database = {
  prepare: (query: string) => D1Statement
  batch: (statements: D1Statement[]) => Promise<unknown>
}

export type Env = {
  APP_ORIGIN: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  SESSION_SECRET?: string
  SCRABBLER_DB?: D1Database
}

export type PagesContext = {
  request: Request
  env: Env
}
