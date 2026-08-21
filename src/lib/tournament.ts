import { canBuildFromRack, hasWord, hasWordAsync, isFullDictionaryLoaded, loadFullDictionary, normalize, tileValue, uniqueSourceWords, wordsForDictionary, wordsForDictionaryAsync, type DictionarySourceId, type Word } from '../data/words'
import { createTileBag, drawTiles, randomFloat, randomRack } from './scrabble'

export const BOARD_SIZE = 15
export const CENTER = Math.floor(BOARD_SIZE / 2)

export type Direction = 'horizontal' | 'vertical'
export type Player = 'human' | 'opponent'
export type Premium = 'double-letter' | 'triple-letter' | 'double-word' | 'triple-word'
export const TOURNAMENT_TIME_OPTIONS = [10, 25, 50] as const
export type TournamentDuration = typeof TOURNAMENT_TIME_OPTIONS[number]
export type BoardTile = { letter: string; isBlank: boolean; player?: Player }
export type Board = Array<Array<BoardTile | null>>
export type Placement = { word: string; row: number; column: number; direction: Direction }
export type BoardCoordinate = { row: number; column: number }
export type PlayedTile = BoardCoordinate & { letter: string; isBlank: boolean }
export type ScoredWord = { word: string; score: number; cells: BoardCoordinate[] }

export type MoveResult = {
  legal: boolean
  reason?: string
  score: number
  bingo: boolean
  placement: Placement
  placedTiles: PlayedTile[]
  formedWords: ScoredWord[]
  board?: Board
}

export type TournamentPosition = { board: Board; anchor: string; rack: string; boardRow: number; boardStart: number }

export type TurnRecord = {
  player: Player
  type: 'play' | 'pass' | 'exchange'
  word?: string
  score: number
  row?: number
  column?: number
  direction?: Direction
  tiles?: string
  reason?: string
}

export type TournamentGame = {
  board: Board
  bag: string[]
  racks: Record<Player, string>
  dictionarySource: DictionarySourceId
  scores: Record<Player, number>
  currentPlayer: Player
  consecutivePasses: number
  turnNumber: number
  finished: boolean
  endReason?: 'empty-rack' | 'passes'
  history: TurnRecord[]
}

const premiumCoordinates: Record<Premium, string[]> = {
  'triple-word': ['0,0', '0,7', '0,14', '7,0', '7,14', '14,0', '14,7', '14,14'],
  'double-word': ['1,1', '2,2', '3,3', '4,4', '1,13', '2,12', '3,11', '4,10', '7,7', '10,4', '11,3', '12,2', '13,1', '10,10', '11,11', '12,12', '13,13'],
  'triple-letter': ['1,5', '1,9', '5,1', '5,5', '5,9', '5,13', '9,1', '9,5', '9,9', '9,13', '13,5', '13,9'],
  'double-letter': ['0,3', '0,11', '2,6', '2,8', '3,0', '3,7', '3,14', '6,2', '6,6', '6,8', '6,12', '7,3', '7,11', '8,2', '8,6', '8,8', '8,12', '11,0', '11,7', '11,14', '12,6', '12,8', '14,3', '14,11'],
}

const premiumLookup = new Map<string, Premium>(Object.entries(premiumCoordinates).flatMap(([premium, coordinates]) => coordinates.map((coordinate) => [coordinate, premium as Premium])))

export const premiumAt = (row: number, column: number): Premium | null => premiumLookup.get(`${row},${column}`) ?? null
export const emptyBoard = (): Board => Array.from({ length: BOARD_SIZE }, () => Array<BoardTile | null>(BOARD_SIZE).fill(null))
export const cloneBoard = (board: Board): Board => board.map((row) => row.map((tile) => tile ? { ...tile } : null))
export const boardHasTiles = (board: Board) => board.some((row) => row.some(Boolean))
export const wordAt = (position: TournamentPosition, row: number, column: number) => position.board[row]?.[column]?.letter ?? null
export const categoryForPlay = (word: string, source: DictionarySourceId = 'focused'): Word | undefined => wordsForDictionary(source).find((candidate) => candidate.spelling === normalize(word))
export const categoryForPlayAsync = async (word: string, source: DictionarySourceId = 'focused'): Promise<Word | undefined> => (await wordsForDictionaryAsync(source)).find((candidate) => candidate.spelling === normalize(word))

const keyFor = (row: number, column: number) => `${row},${column}`
const inBounds = (row: number, column: number) => row >= 0 && row < BOARD_SIZE && column >= 0 && column < BOARD_SIZE
const adjacentCoordinates = (row: number, column: number): BoardCoordinate[] => [{ row: row - 1, column }, { row: row + 1, column }, { row, column: column - 1 }, { row, column: column + 1 }].filter(({ row: nextRow, column: nextColumn }) => inBounds(nextRow, nextColumn))
const coordinatesFor = (placement: Placement): BoardCoordinate[] => {
  const word = normalize(placement.word)
  return [...word].map((_, index) => ({
    row: placement.row + (placement.direction === 'vertical' ? index : 0),
    column: placement.column + (placement.direction === 'horizontal' ? index : 0),
  }))
}
const premiumMultiplier = (premium: Premium | null) => premium === 'double-letter' ? 2 : premium === 'triple-letter' ? 3 : premium === 'double-word' ? 2 : premium === 'triple-word' ? 3 : 1
const isWordPremium = (premium: Premium | null) => premium === 'double-word' || premium === 'triple-word'
const isLetterPremium = (premium: Premium | null) => premium === 'double-letter' || premium === 'triple-letter'
const sourceWordExists = (word: string, source: DictionarySourceId = 'focused') => hasWord(word, source)
const sourceWordExistsAsync = (word: string, source: DictionarySourceId = 'focused') => hasWordAsync(word, source)
const dictionaryLabel = (source: DictionarySourceId) => source === 'full' ? 'the full CSW24 dictionary' : 'the focused study source'

const rackTilesForWord = (word: string, rack: string) => {
  const available = [...normalize(rack)]
  const missing: Array<{ letter: string; isBlank: boolean }> = []
  for (const letter of normalize(word)) {
    const exactIndex = available.indexOf(letter)
    if (exactIndex >= 0) { available.splice(exactIndex, 1); missing.push({ letter, isBlank: false }); continue }
    const blankIndex = available.indexOf('?')
    if (blankIndex < 0) return null
    available.splice(blankIndex, 1)
    missing.push({ letter, isBlank: true })
  }
  return missing
}

const readLine = (board: Board, start: BoardCoordinate, direction: Direction, overlay = new Map<string, BoardTile>()) => {
  const delta = direction === 'horizontal' ? { row: 0, column: 1 } : { row: 1, column: 0 }
  let row = start.row; let column = start.column
  while (inBounds(row - delta.row, column - delta.column) && (overlay.get(keyFor(row - delta.row, column - delta.column)) ?? board[row - delta.row][column - delta.column])) { row -= delta.row; column -= delta.column }
  const cells: BoardCoordinate[] = []
  while (inBounds(row, column)) {
    const tile = overlay.get(keyFor(row, column)) ?? board[row][column]
    if (!tile) break
    cells.push({ row, column }); row += delta.row; column += delta.column
  }
  return cells
}

const tileAt = (board: Board, coordinate: BoardCoordinate, overlay: Map<string, BoardTile>) => overlay.get(keyFor(coordinate.row, coordinate.column)) ?? board[coordinate.row][coordinate.column]
const scoreWordCells = (board: Board, cells: BoardCoordinate[], newlyPlaced: Map<string, PlayedTile>, overlay: Map<string, BoardTile>) => {
  let score = 0; let wordMultiplier = 1
  for (const coordinate of cells) {
    const tile = tileAt(board, coordinate, overlay)
    if (!tile) continue
    const played = newlyPlaced.get(keyFor(coordinate.row, coordinate.column))
    const premium = played ? premiumAt(coordinate.row, coordinate.column) : null
    score += tileValue(tile.letter, tile.isBlank) * (played && isLetterPremium(premium) ? premiumMultiplier(premium) : 1)
    if (played && isWordPremium(premium)) wordMultiplier *= premiumMultiplier(premium)
  }
  return score * wordMultiplier
}

const invalidMove = (placement: Placement, reason: string): MoveResult => ({ legal: false, reason, score: 0, bingo: false, placement, placedTiles: [], formedWords: [] })

const validatePlacementCore = (board: Board, rack: string, rawPlacement: Placement, dictionarySource: DictionarySourceId, wordExists: (word: string) => boolean): MoveResult => {
  const placement = { ...rawPlacement, word: normalize(rawPlacement.word) }
  if (!placement.word) return invalidMove(placement, 'Enter a word.')
  if (!wordExists(placement.word)) return invalidMove(placement, `That word is not in ${dictionaryLabel(dictionarySource)}.`)
  const coordinates = coordinatesFor(placement)
  if (!coordinates.every(({ row, column }) => inBounds(row, column))) return invalidMove(placement, 'The word runs off the board.')

  const placedTiles: PlayedTile[] = []
  const neededTiles: Array<{ letter: string; row: number; column: number }> = []
  let overlaps = false
  for (const [index, coordinate] of coordinates.entries()) {
    const tile = board[coordinate.row][coordinate.column]
    const letter = placement.word[index]
    if (tile) {
      if (tile.letter !== letter) return invalidMove(placement, `The play conflicts with ${tile.letter} at row ${coordinate.row + 1}, column ${coordinate.column + 1}.`)
      overlaps = true
    } else neededTiles.push({ letter, ...coordinate })
  }
  if (!neededTiles.length) return invalidMove(placement, 'Place at least one new tile.')
  const before = placement.direction === 'horizontal' ? { row: placement.row, column: placement.column - 1 } : { row: placement.row - 1, column: placement.column }
  const after = placement.direction === 'horizontal' ? { row: placement.row, column: placement.column + placement.word.length } : { row: placement.row + placement.word.length, column: placement.column }
  if ((inBounds(before.row, before.column) && board[before.row][before.column]) || (inBounds(after.row, after.column) && board[after.row][after.column])) return invalidMove(placement, 'Include the complete connected word; it cannot stop beside an existing tile.')

  const rackTiles = rackTilesForWord(neededTiles.map(({ letter }) => letter).join(''), rack)
  if (!rackTiles) return invalidMove(placement, 'You do not have the tiles needed for that placement.')
  neededTiles.forEach((tile, index) => placedTiles.push({ row: tile.row, column: tile.column, letter: tile.letter, isBlank: rackTiles[index].isBlank }))
  const hasBoard = boardHasTiles(board)
  const touchesBoard = overlaps || placedTiles.some((tile) => adjacentCoordinates(tile.row, tile.column).some(({ row, column }) => Boolean(board[row][column])))
  if (!hasBoard && !coordinates.some(({ row, column }) => row === CENTER && column === CENTER)) return invalidMove(placement, 'The opening play must cover the center square.')
  if (hasBoard && !touchesBoard) return invalidMove(placement, 'The play must connect to the existing board.')

  const overlay = new Map(placedTiles.map((tile) => [keyFor(tile.row, tile.column), { letter: tile.letter, isBlank: tile.isBlank }]))
  const mainCells = readLine(board, coordinates[0], placement.direction, overlay)
  const mainWord = mainCells.map((coordinate) => tileAt(board, coordinate, overlay)?.letter ?? '').join('')
  if (mainWord !== placement.word || mainCells.length !== placement.word.length) return invalidMove(placement, 'The placement does not form the complete main word.')

  const formedWords: ScoredWord[] = [{ word: mainWord, score: 0, cells: mainCells }]
  const crossDirection: Direction = placement.direction === 'horizontal' ? 'vertical' : 'horizontal'
  for (const tile of placedTiles) {
    const crossCells = readLine(board, tile, crossDirection, overlay)
    if (crossCells.length <= 1) continue
    const crossWord = crossCells.map((coordinate) => tileAt(board, coordinate, overlay)?.letter ?? '').join('')
    if (!wordExists(crossWord)) return invalidMove(placement, `The cross-word ${crossWord} is not in ${dictionaryLabel(dictionarySource)}.`)
    formedWords.push({ word: crossWord, score: 0, cells: crossCells })
  }
  const placedMap = new Map(placedTiles.map((tile) => [keyFor(tile.row, tile.column), tile]))
  formedWords.forEach((formedWord) => { formedWord.score = scoreWordCells(board, formedWord.cells, placedMap, overlay) })
  const bingo = placedTiles.length === 7
  return { legal: true, score: formedWords.reduce((total, formedWord) => total + formedWord.score, 0) + (bingo ? 50 : 0), bingo, placement, placedTiles, formedWords }
}

export const validatePlacement = (board: Board, rack: string, rawPlacement: Placement, dictionarySource: DictionarySourceId = 'focused'): MoveResult => {
  if (dictionarySource === 'full' && !isFullDictionaryLoaded()) {
    const placement = { ...rawPlacement, word: normalize(rawPlacement.word) }
    if (placement.word && !hasWord(placement.word, 'focused') && !hasWord(placement.word, 'full')) {
      return { legal: false, reason: 'Full CSW24 is loading — try again in a moment.', score: 0, bingo: false, placement, placedTiles: [], formedWords: [] }
    }
  }
  return validatePlacementCore(board, rack, rawPlacement, dictionarySource, (word) => sourceWordExists(word, dictionarySource))
}

export const validatePlacementAsync = async (board: Board, rack: string, rawPlacement: Placement, dictionarySource: DictionarySourceId = 'focused'): Promise<MoveResult> => {
  if (dictionarySource === 'full' && !isFullDictionaryLoaded()) await loadFullDictionary()
  return validatePlacementCore(board, rack, rawPlacement, dictionarySource, (word) => sourceWordExists(word, dictionarySource))
}

export const isFullDictionaryReady = () => isFullDictionaryLoaded()
export const ensureFullDictionaryLoaded = () => loadFullDictionary()


export const applyPlacement = (board: Board, move: MoveResult, player: Player = 'human'): Board => {
  if (!move.legal) return cloneBoard(board)
  const next = cloneBoard(board)
  for (const tile of move.placedTiles) next[tile.row][tile.column] = { letter: tile.letter, isBlank: tile.isBlank, player }
  return next
}

export const playMove = (board: Board, rack: string, placement: Placement, player: Player = 'human', dictionarySource: DictionarySourceId = 'focused'): MoveResult => {
  const move = validatePlacement(board, rack, placement, dictionarySource)
  return move.legal ? { ...move, board: applyPlacement(board, move, player) } : move
}

export const isLegalSourcePlay = (word: string, rack: string, dictionarySource: DictionarySourceId = 'focused') => {
  const normalized = normalize(word)
  return normalized.length >= 2 && normalized.length <= 8 && sourceWordExists(normalized, dictionarySource) && canBuildFromRack(normalized, rack)
}

export const scoreMove = (word: string, rack: string, dictionarySource: DictionarySourceId = 'focused') => {
  const normalized = normalize(word)
  if (!isLegalSourcePlay(normalized, rack, dictionarySource)) return 0
  const tiles = rackTilesForWord(normalized, rack)
  return tiles?.reduce((total, tile) => total + tileValue(tile.letter, tile.isBlank), 0) ?? 0
}

const removePlayedTiles = (rack: string, placedTiles: PlayedTile[]) => {
  const available = [...normalize(rack)]
  for (const tile of placedTiles) {
    const index = available.indexOf(tile.isBlank ? '?' : tile.letter)
    if (index >= 0) available.splice(index, 1)
  }
  return available.sort().join('')
}

const sortRack = (rack: string) => [...normalize(rack)].sort().join('')
const drawToRack = (rack: string, bag: string[], random: () => number) => sortRack(`${rack}${drawTiles(bag, Math.max(0, 7 - rack.length), random).join('')}`)
const rackValue = (rack: string) => [...normalize(rack)].reduce((total, letter) => total + tileValue(letter, letter === '?'), 0)
const otherPlayer = (player: Player): Player => player === 'human' ? 'opponent' : 'human'

const finishGame = (game: TournamentGame, reason: TournamentGame['endReason'], finisher?: Player): TournamentGame => {
  const scores = { ...game.scores }
  if (reason === 'empty-rack' && finisher) {
    const opponent = otherPlayer(finisher)
    const opponentTiles = rackValue(game.racks[opponent])
    const doubled = opponentTiles * 2
    scores[finisher] += doubled
    scores[opponent] -= doubled
  } else {
    scores.human -= rackValue(game.racks.human)
    scores.opponent -= rackValue(game.racks.opponent)
  }
  return { ...game, scores, finished: true, endReason: reason, currentPlayer: game.currentPlayer }
}

const placementsNearBoard = (board: Board, word: string, direction: Direction): Placement[] => {
  const starts = new Set<string>()
  const add = (row: number, column: number) => {
    if (inBounds(row, column)) starts.add(`${row},${column}`)
  }
  if (!boardHasTiles(board)) {
    for (let index = 0; index < word.length; index += 1) {
      if (direction === 'horizontal') add(CENTER, CENTER - index)
      else add(CENTER - index, CENTER)
    }
  } else {
    board.forEach((row, rowIndex) => row.forEach((tile, columnIndex) => {
      if (!tile) return
      for (let index = 0; index < word.length; index += 1) {
        const startRow = direction === 'vertical' ? rowIndex - index : rowIndex
        const startColumn = direction === 'horizontal' ? columnIndex - index : columnIndex
        if (tile.letter === word[index]) add(startRow, startColumn)
        if (direction === 'horizontal') {
          add(rowIndex - 1, columnIndex - index)
          add(rowIndex + 1, columnIndex - index)
        } else {
          add(rowIndex - index, columnIndex - 1)
          add(rowIndex - index, columnIndex + 1)
        }
      }
      if (direction === 'horizontal') {
        add(rowIndex, columnIndex - word.length)
        add(rowIndex, columnIndex + 1)
      } else {
        add(rowIndex - word.length, columnIndex)
        add(rowIndex + 1, columnIndex)
      }
    }))
  }
  return [...starts].map((key) => {
    const [row, column] = key.split(',').map(Number)
    return { word, row, column, direction }
  })
}

export const createTournamentGame = (random = randomFloat, dictionarySource: DictionarySourceId = 'focused'): TournamentGame => {
  const bag = createTileBag()
  const human = drawTiles(bag, 7, random).join('')
  const opponent = drawTiles(bag, 7, random).join('')
  return { board: emptyBoard(), bag, racks: { human: sortRack(human), opponent: sortRack(opponent) }, dictionarySource, scores: { human: 0, opponent: 0 }, currentPlayer: 'human', consecutivePasses: 0, turnNumber: 1, finished: false, history: [] }
}

export const playGameMove = (game: TournamentGame, placement: Placement, player: Player = game.currentPlayer, random = randomFloat) => {
  if (game.finished) return { game, move: invalidMove(placement, 'The game is already complete.') }
  if (player !== game.currentPlayer) return { game, move: invalidMove(placement, `It is ${game.currentPlayer === 'human' ? 'your' : 'the opponent\'s'} turn.`) }
  const move = playMove(game.board, game.racks[player], placement, player, game.dictionarySource)
  if (!move.legal) return { game, move }
  const remainingRack = removePlayedTiles(game.racks[player], move.placedTiles)
  const bag = [...game.bag]
  const racks = { ...game.racks, [player]: drawToRack(remainingRack, bag, random) }
  const next: TournamentGame = { ...game, board: move.board ?? game.board, bag, racks, scores: { ...game.scores, [player]: game.scores[player] + move.score }, currentPlayer: otherPlayer(player), consecutivePasses: 0, turnNumber: game.turnNumber + 1, history: [...game.history, { player, type: 'play', word: move.placement.word, score: move.score, row: move.placement.row, column: move.placement.column, direction: move.placement.direction }] }
  const finished = bag.length === 0 && racks[player].length === 0 ? finishGame(next, 'empty-rack', player) : next
  return { game: finished, move }
}

export const playGameMoveAsync = async (game: TournamentGame, placement: Placement, player: Player = game.currentPlayer, random = randomFloat) => {
  if (game.finished) return { game, move: invalidMove(placement, 'The game is already complete.') }
  if (player !== game.currentPlayer) return { game, move: invalidMove(placement, `It is ${game.currentPlayer === 'human' ? 'your' : 'the opponent\'s'} turn.`) }
  if (game.dictionarySource === 'full' && !isFullDictionaryLoaded()) await loadFullDictionary()
  const move = playMove(game.board, game.racks[player], placement, player, game.dictionarySource)
  if (!move.legal) return { game, move }
  const remainingRack = removePlayedTiles(game.racks[player], move.placedTiles)
  const bag = [...game.bag]
  const racks = { ...game.racks, [player]: drawToRack(remainingRack, bag, random) }
  const next: TournamentGame = { ...game, board: move.board ?? game.board, bag, racks, scores: { ...game.scores, [player]: game.scores[player] + move.score }, currentPlayer: otherPlayer(player), consecutivePasses: 0, turnNumber: game.turnNumber + 1, history: [...game.history, { player, type: 'play', word: move.placement.word, score: move.score, row: move.placement.row, column: move.placement.column, direction: move.placement.direction }] }
  const finished = bag.length === 0 && racks[player].length === 0 ? finishGame(next, 'empty-rack', player) : next
  return { game: finished, move }
}

export const passTurn = (game: TournamentGame): TournamentGame => {
  if (game.finished) return game
  const next: TournamentGame = { ...game, currentPlayer: otherPlayer(game.currentPlayer), consecutivePasses: game.consecutivePasses + 1, turnNumber: game.turnNumber + 1, history: [...game.history, { player: game.currentPlayer, type: 'pass', score: 0 }] }
  return next.consecutivePasses >= 6 ? finishGame(next, 'passes') : next
}

export const exchangeTiles = (game: TournamentGame, letters: string, random = randomFloat) => {
  const requested = [...normalize(letters)]
  if (game.finished) return { game, ok: false, reason: 'The game is already complete.' }
  if (!requested.length) return { game, ok: false, reason: 'Select at least one tile to exchange.' }
  if (game.bag.length < requested.length) return { game, ok: false, reason: 'There are not enough tiles left to exchange.' }
  const rack = [...game.racks[game.currentPlayer]]
  for (const letter of requested) {
    const index = rack.indexOf(letter)
    if (index < 0) return { game, ok: false, reason: `Your rack does not contain ${letter}.` }
    rack.splice(index, 1)
  }
  const bag = [...game.bag]
  const replacement = drawTiles(bag, requested.length, random)
  bag.push(...requested)
  const next: TournamentGame = { ...game, bag, racks: { ...game.racks, [game.currentPlayer]: sortRack(`${rack.join('')}${replacement.join('')}`) }, currentPlayer: otherPlayer(game.currentPlayer), consecutivePasses: 0, turnNumber: game.turnNumber + 1, history: [...game.history, { player: game.currentPlayer, type: 'exchange', score: 0, tiles: requested.join('') }] }
  return { game: next, ok: true }
}

export const findBestMove = (board: Board, rack: string, dictionarySource: DictionarySourceId = 'focused'): Placement | null => {
  const candidates = wordsForDictionary(dictionarySource).filter((word) => word.length >= 2 && word.length <= 8 && canBuildFromRack(word.spelling, rack)).sort((left, right) => right.length - left.length || left.spelling.localeCompare(right.spelling))
  let best: { placement: Placement; move: MoveResult } | null = null
  for (const candidate of candidates) {
    for (const direction of ['horizontal', 'vertical'] as Direction[]) {
      for (const placement of placementsNearBoard(board, candidate.spelling, direction)) {
        const move = validatePlacement(board, rack, placement, dictionarySource)
        if (!move.legal) continue
        if (!best || move.score > best.move.score || (move.score === best.move.score && (candidate.length > best.placement.word.length || (candidate.length === best.placement.word.length && candidate.spelling < best.placement.word)))) best = { placement, move }
      }
    }
  }
  return best?.placement ?? null
}

export const findBestMoveAsync = async (board: Board, rack: string, dictionarySource: DictionarySourceId = 'focused'): Promise<Placement | null> => {
  if (dictionarySource === 'full' && !isFullDictionaryLoaded()) await loadFullDictionary()
  const candidates = wordsForDictionary(dictionarySource).filter((word) => word.length >= 2 && word.length <= 8 && canBuildFromRack(word.spelling, rack)).sort((left, right) => right.length - left.length || left.spelling.localeCompare(right.spelling))
  let best: { placement: Placement; move: MoveResult } | null = null
  for (const candidate of candidates) {
    for (const direction of ['horizontal', 'vertical'] as Direction[]) {
      for (const placement of placementsNearBoard(board, candidate.spelling, direction)) {
        const move = validatePlacement(board, rack, placement, dictionarySource)
        if (!move.legal) continue
        if (!best || move.score > best.move.score || (move.score === best.move.score && (candidate.length > best.placement.word.length || (candidate.length === best.placement.word.length && candidate.spelling < best.placement.word)))) best = { placement, move }
      }
    }
  }
  return best?.placement ?? null
}

export const playOpponentTurn = (game: TournamentGame, random = randomFloat) => {
  if (game.finished || game.currentPlayer !== 'opponent') return { game, move: null as MoveResult | null }
  const placement = findBestMove(game.board, game.racks.opponent, game.dictionarySource)
  if (!placement) return { game: passTurn(game), move: null as MoveResult | null }
  return playGameMove(game, placement, 'opponent', random)
}

export const playOpponentTurnAsync = async (game: TournamentGame, random = randomFloat) => {
  if (game.finished || game.currentPlayer !== 'opponent') return { game, move: null as MoveResult | null }
  const placement = await findBestMoveAsync(game.board, game.racks.opponent, game.dictionarySource)
  if (!placement) return { game: passTurn(game), move: null as MoveResult | null }
  return playGameMove(game, placement, 'opponent', random)
}

/**
 * Legacy anchor position retained for the original position tests and for callers that want a populated board preview.
 * The Tournament Lab itself uses createTournamentGame so the first move follows normal center-square rules.
 */
export const createTournamentPosition = (random = randomFloat): TournamentPosition => {
  const board = emptyBoard(); const candidates = uniqueSourceWords.filter((word) => word.length >= 4 && word.length <= 7); const anchorWord = candidates[Math.floor(random() * Math.max(candidates.length, 1))]?.spelling ?? 'TISANE'; const row = CENTER; const start = Math.floor((BOARD_SIZE - anchorWord.length) / 2)
  ;[...anchorWord].forEach((letter, index) => { board[row][start + index] = { letter, isBlank: false, player: 'opponent' } })
  return { board, anchor: anchorWord, rack: randomRack(7, random), boardRow: row, boardStart: start }
}
