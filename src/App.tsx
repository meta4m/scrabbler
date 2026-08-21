import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent as ReactDragEvent } from 'react'
import { bingoFamilies, categoryLabels, definitionForWord, dictionarySourceOptions, filterLookupWords, isFullDictionaryLoaded, loadFullDictionary, normalize, scoreWord, syncDefinitionForWord, type DictionarySourceId, type DrillType, type LookupCategory, type Word, uniqueSourceWords, words, wordsForDictionary, wordsForDrill, wordsFromRack } from './data/words'
import { accuracy, averageLatency, drillLabel, dueWords, loadAttempts, mergeAttempts, saveAttempt, selectAdaptiveWord, weakWords, wordStats, type Attempt } from './lib/training'
import { loadProfile, loadRemoteAttempts, syncRemoteAttempts, type ProfileUser } from './lib/auth'
import { anagramsFor, bingoFamilyFor, dumpPlaysFor, extensionsFor, hooksFor, rackPlays, randomRack } from './lib/scrabble'
import { categoryForPlay, createTournamentGame, ensureFullDictionaryLoaded, exchangeTiles, passTurn, playGameMove, playGameMoveAsync, playOpponentTurn, playOpponentTurnAsync, premiumAt, TOURNAMENT_TIME_OPTIONS, validatePlacement, type Direction, type MoveResult, type TournamentDuration, type TournamentGame, type TurnRecord } from './lib/tournament'

type View = 'home' | 'lookup' | 'drill' | 'progress' | 'rack' | 'tournament'
type IconName = 'search' | 'bolt' | 'chart' | 'arrow' | 'clock' | 'check' | 'x' | 'play' | 'grid' | 'pair' | 'stack' | 'shuffle' | 'spark' | 'tray'
const drillCards: { id: DrillType; title: string; description: string; color: string; icon: IconName }[] = [
  { id: '2-letter', title: '2-letter sprint', description: 'Build the tiny words that unlock the board.', color: 'teal', icon: 'pair' },
  { id: 'power', title: 'Power letters', description: 'Rapid recall for J, Q, X and Z words.', color: 'orange', icon: 'bolt' },
  { id: 'all', title: 'All-letter sprint', description: 'Train the full source from short words to bingos.', color: 'green', icon: 'stack' },
  { id: 'mixed', title: 'Adaptive mix', description: 'Let your weak and slow words choose the next prompt.', color: 'navy', icon: 'shuffle' },
  { id: 'bingo', title: 'Bingo families', description: 'See a stem. Find the 7-letter plays.', color: 'plum', icon: 'spark' },
  { id: 'dumps', title: 'Dump words', description: 'Turn awkward I, U and vowel racks into options.', color: 'blue', icon: 'tray' },
]

const Icon = ({ name }: { name: IconName }) => {
  const paths: Record<IconName, string> = { search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm6-2 4 4', bolt: 'm13 2-9 12h7l-1 8 9-12h-7l1-8Z', chart: 'M4 19V5m0 14h17M8 16v-4m4 4V8m4 8V4', arrow: 'M5 12h14m-6-6 6 6-6 6', clock: 'M12 7v5l3 2m7-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0', check: 'm5 12 4 4L19 6', x: 'm6 6 12 12M18 6 6 18', play: 'M8 5v14l11-7L8 5Z', grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z', pair: 'M5 6h5v12H5zM14 6h5v12h-5z', stack: 'M4 7 12 3l8 4-8 4L4 7Zm0 5 8 4 8-4M4 17l8 4 8-4', shuffle: 'M4 7h4l8 10h4m0 0-3-3m3 3-3 3M4 17h4L16 7h4m0 0-3-3m3 3-3 3', spark: 'M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z', tray: 'M4 5h16l-2 12H6L4 5Zm0 0 4 6h8l4-6' }
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="icon"><path d={paths[name]} /></svg>
}

function App() {
  const [view, setView] = useState<View>('home')
  const [activeDrill, setActiveDrill] = useState<DrillType | null>(null)
  const [attempts, setAttempts] = useState<Attempt[]>(loadAttempts)
  const [user, setUser] = useState<ProfileUser | null>(null)
  const [syncState, setSyncState] = useState<'local' | 'loading' | 'synced' | 'syncing' | 'error'>('loading')
  const [query, setQuery] = useState('')
  const [lookupCategory, setLookupCategory] = useState<LookupCategory>('all')
  const [lookupDictionary, setLookupDictionary] = useState<DictionarySourceId>('focused')
  const [lookupLoading, setLookupLoading] = useState(false)

  const beginDrill = (drill: DrillType) => { setActiveDrill(drill); setView('drill') }
  useEffect(() => {
    let mounted = true
    void loadProfile().then(async (profile) => {
      if (!mounted) return
      setUser(profile)
      if (!profile) { setSyncState('local'); return }
      const remote = await loadRemoteAttempts()
      if (!mounted) return
      if (remote) {
        const merged = mergeAttempts(loadAttempts(), remote)
        setAttempts(merged)
        setSyncState('syncing')
        await syncRemoteAttempts(merged)
        if (mounted) setSyncState('synced')
      } else setSyncState('error')
    }).catch(() => mounted && setSyncState('error'))
    return () => { mounted = false }
  }, [])

  const record = (attempt: Attempt) => {
    const next = saveAttempt(attempt)
    setAttempts(next)
    if (user) {
      setSyncState('syncing')
      void syncRemoteAttempts(next).then((ok) => setSyncState(ok ? 'synced' : 'error'))
    }
  }

  const [lookupWords, setLookupWords] = useState(() => wordsForDictionary('focused'))
  useEffect(() => {
    if (lookupDictionary === 'focused') { setLookupWords(wordsForDictionary('focused')); return }
    let cancelled = false
    setLookupLoading(true)
    void loadFullDictionary().then((list) => { if (!cancelled) { setLookupWords(list); setLookupLoading(false) } })
    return () => { cancelled = true }
  }, [lookupDictionary])
  const normalizedQuery = normalize(query)
  const fullMatches = useMemo(() => filterLookupWords(lookupWords, query, lookupCategory, lookupDictionary), [lookupCategory, lookupDictionary, lookupWords, normalizedQuery])
  const results = fullMatches.slice(0, 200)

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => setView('home')} aria-label="Go to Scrabbler home"><span className="brand-mark">S</span><span>scrabbler<span className="brand-dot">.</span></span></button>
      <nav className="desktop-nav" aria-label="Primary navigation">
        <NavButton active={view === 'lookup'} onClick={() => setView('lookup')} icon="search">Lookup</NavButton>
        <NavButton active={view === 'drill'} onClick={() => { setActiveDrill(null); setView('drill') }} icon="play">Quick drill</NavButton>
        <NavButton active={view === 'progress'} onClick={() => setView('progress')} icon="chart">My progress</NavButton>
        <NavButton active={view === 'rack'} onClick={() => setView('rack')} icon="grid">Rack lab</NavButton>
        <NavButton active={view === 'tournament'} onClick={() => setView('tournament')} icon="clock">Tournament</NavButton>
      </nav>
      <a className="source-badge" href="/source-words.pdf" download="Word Study.pdf" target="_blank" rel="noreferrer"><span className="live-dot" /> CSW24 study source <span className="source-download">PDF ↗</span></a><AuthControls user={user} syncState={syncState} />
    </header>
    <main>
      {view === 'home' && <Home onLookup={() => setView('lookup')} onDrill={beginDrill} attempts={attempts} />}
      {view === 'lookup' && <Lookup query={query} setQuery={setQuery} category={lookupCategory} setCategory={setLookupCategory} results={results} totalMatches={fullMatches.length} dictionary={lookupDictionary} setDictionary={setLookupDictionary} loading={lookupLoading} onBack={() => setView('home')} />}
      {view === 'drill' && <Drills active={activeDrill} attempts={attempts} onSelect={beginDrill} onRecord={record} onBack={() => setView('home')} />}
      {view === 'progress' && <ProgressDashboard attempts={attempts} onBack={() => setView('home')} />}
      {view === 'rack' && <RackLab onBack={() => setView('home')} />}
      {view === 'tournament' && <TournamentLab onBack={() => setView('home')} />}
    </main>
    <footer><span>Train fast. Remember more.</span><span>Source vocabulary is curated, not a universal dictionary.</span></footer>
  </div>
}

function NavButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: IconName; children: string }) { return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}><Icon name={icon} />{children}</button> }

function AuthControls({ user, syncState }: { user: ProfileUser | null; syncState: 'local' | 'loading' | 'synced' | 'syncing' | 'error' }) {
  if (syncState === 'loading') return <span className="auth-status">Checking profile…</span>
  if (!user) return <a className="auth-button" href="/api/auth/google">Sign in with Google</a>
  return <div className="auth-controls"><span className="auth-user">{user.name}</span><span className={`auth-status ${syncState === 'error' ? 'auth-error' : ''}`}>{syncState === 'syncing' ? 'Syncing…' : syncState === 'error' ? 'Sync paused' : 'Synced'}</span><a className="auth-link" href="/api/auth/logout">Sign out</a></div>
}

function Home({ onLookup, onDrill, attempts }: { onLookup: () => void; onDrill: (drill: DrillType) => void; attempts: Attempt[] }) {
  return <div className="home-page">
    <section className="hero"><div className="eyebrow"><span className="eyebrow-line" /> YOUR DAILY WORD WORKOUT</div><h1>Make your<br /><em>best play</em> automatic.</h1><p className="hero-copy">A focused training loop for rapid lexical recall, bingo retrieval and the words that win close games.</p><div className="hero-actions"><button className="button primary" onClick={() => onDrill('2-letter')}>Start a quick drill <Icon name="arrow" /></button><button className="button secondary" onClick={onLookup}><Icon name="search" /> Explore words</button></div><div className="hero-note"><Icon name="clock" /> 5 minutes a day compounds quickly</div></section>
    <section className="stats-strip"><Stat value={String(words.length)} label="source words" /><Stat value={String(bingoFamilies[0]?.answers.length ?? 0)} label="bingo plays" /><Stat value={attempts.length ? `${accuracy(attempts)}%` : '—'} label="your accuracy" /></section>
    <section className="section-block"><div className="section-heading"><div><div className="eyebrow">CHOOSE YOUR FOCUS</div><h2>Pick a training lane</h2></div><button className="text-button" onClick={() => onDrill('2-letter')}>Open quick drill <Icon name="arrow" /></button></div><div className="drill-grid">{drillCards.map((card, index) => <button key={card.id} className={`drill-card ${card.color}`} onClick={() => onDrill(card.id)}><span className="card-number">0{index + 1}</span><span className="card-icon"><Icon name={card.icon} /></span><strong>{card.title}</strong><span>{card.description}</span><span className="card-arrow"><Icon name="arrow" /></span></button>)}</div></section>
    <section className="quote-panel"><div className="quote-mark">“</div><p>Recognition is a skill. Train the moment before you need it.</p><span>— The Scrabbler principle</span></section>
  </div>
}

function Stat({ value, label }: { value: string; label: string }) { return <div className="stat"><strong>{value}</strong><span>{label}</span></div> }

function Lookup({ query, setQuery, category, setCategory, results, totalMatches, dictionary, setDictionary, loading, onBack }: { query: string; setQuery: (value: string) => void; category: LookupCategory; setCategory: (value: LookupCategory) => void; results: Word[]; totalMatches: number; dictionary: DictionarySourceId; setDictionary: (value: DictionarySourceId) => void; loading: boolean; onBack: () => void }) {
  const [activeDefinition, setActiveDefinition] = useState<string | null>(null); const [definitionText, setDefinitionText] = useState<string>(''); const [defLoading, setDefLoading] = useState(false)
  useEffect(() => { if (!activeDefinition) return; let cancelled = false; setDefLoading(true); void definitionForWord(activeDefinition).then((text) => { if (!cancelled) { setDefinitionText(text ?? 'No definition found.'); setDefLoading(false) } }); return () => { cancelled = true } }, [activeDefinition])
  const filteredByLength = dictionary === 'full'
  const pillOptions = filteredByLength
    ? [['all', 'All words'], ['2-letter', '2-letter only']]
    : [['all', 'All words'], ['2-letter', '2-letter'], ['power', 'J/Q/X/Z'], ['dump', 'Dumps'], ['csw24', 'CSW24']]
  const metaLabel = loading
    ? 'Loading CSW24…'
    : !normalize(query)
      ? (dictionary === 'full' ? 'Type a letter or word to search 280,887 CSW24 words.' : 'Type a letter or word to search the study source.')
      : totalMatches > 200
        ? `${totalMatches.toLocaleString()} matches · showing first 200`
        : `${totalMatches.toLocaleString()} matching ${dictionary === 'full' ? 'CSW24' : 'source'} word${totalMatches === 1 ? '' : 's'}`
  return <div className="content-page"><style>{'@keyframes defSpin{to{transform:rotate(360deg)}}'}</style><PageIntro eyebrow="WORD LOOKUP" title="Find your next word." copy="Search the study source or the full CSW24 dictionary by spelling or letter signature. Click any word to see its definition." onBack={onBack} /><div className="filter-row" role="group" aria-label="Dictionary source"><button className={dictionary === 'focused' ? 'filter active' : 'filter'} onClick={() => setDictionary('focused')}>Focused ({dictionarySourceOptions[0]?.wordCount})</button><button className={dictionary === 'full' ? 'filter active' : 'filter'} onClick={() => setDictionary('full')}>Full CSW24 (280,887) {loading ? '· loading…' : isFullDictionaryLoaded() ? '· ready' : ''}</button></div><div className="search-wrap"><Icon name="search" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try 'QI', 'AEINST' or 'Z'…" aria-label="Search words" /></div><div className="filter-row" role="group" aria-label="Filter words">{pillOptions.map(([value, label]) => <button key={value} className={category === value ? 'filter active' : 'filter'} onClick={() => setCategory(value as 'all' | '2-letter' | 'power' | 'dump' | 'csw24')}>{label}</button>)}</div><div className="result-meta">{metaLabel}</div>{activeDefinition && <div style={{ margin:'10px 0 16px', padding:'14px 16px', border:'1px solid var(--line)', background:'#f8fffd', fontSize:14 }}><strong style={{ fontSize:16, letterSpacing:'.04em' }}>{activeDefinition}</strong><span style={{ display:'flex', alignItems:'center', gap:8, marginTop:8, color:'var(--ink)', lineHeight:1.5 }}>{defLoading ? <><span style={{ width:14, height:14, border:'2px solid var(--line)', borderTopColor:'var(--teal)', borderRadius:'50%', display:'inline-block', animation:'defSpin .6s linear infinite' }} /> Loading definition…</> : definitionText || syncDefinitionForWord(activeDefinition) || 'No definition found.'}</span></div>}<div className="word-table">{results.map((word) => <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 4px', borderBottom:'1px solid var(--line)', minHeight:48 }} key={word.spelling}><span style={{ minWidth:36, textAlign:'center', fontFamily:'DM Mono, monospace', fontSize:11, color:'var(--muted)', border:'1px solid var(--line)', borderRadius:4, padding:'2px 0', flexShrink:0 }}>{word.length}L</span><span style={{ flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:18, fontWeight:600, letterSpacing:'.04em' }}>{word.spelling}<span style={{ marginLeft:10, fontSize:12, fontWeight:400, color:'var(--muted)' }}>{word.signature} · {categoryLabels[word.category]}</span></span><button type="button" onClick={() => { setActiveDefinition(word.spelling); void definitionForWord(word.spelling).then((text) => { setDefinitionText(text ?? 'No definition found.'); setDefLoading(false) }) }} title="See definition" aria-label={`See definition of ${word.spelling}`} style={{ flexShrink:0, background:'none', border:0, padding:4, cursor:'pointer', color:'var(--teal)', display:'grid', placeItems:'center', width:28, height:28 }}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="10.5" cy="10.5" r="7" /><line x1="15.5" y1="15.5" x2="21" y2="21" /></svg></button></div>)}{!results.length && !loading && normalize(query) && <div className="empty-state">No {dictionary === 'full' ? 'CSW24' : 'source'} words match that search yet.</div>}</div>{totalMatches > 200 && !loading && normalize(query) && <div style={{ marginTop:10, fontSize:12, color:'var(--muted)', fontFamily:'DM Mono, monospace' }}>Showing the first 200 of {totalMatches.toLocaleString()} matches. Refine the query to narrow the list.</div>}</div>
}

function PageIntro({ eyebrow, title, copy, onBack }: { eyebrow: string; title: string; copy: string; onBack: () => void }) { return <div className="page-intro"><button className="back-button" onClick={onBack}>← Back</button><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{copy}</p></div> }

function Drills({ active, attempts, onSelect, onRecord, onBack }: { active: DrillType | null; attempts: Attempt[]; onSelect: (drill: DrillType) => void; onRecord: (attempt: Attempt) => void; onBack: () => void }) {
  const [mode, setMode] = useState<'sequence' | 'random'>('sequence'); const [allMode, setAllMode] = useState<'random' | 'progressive'>('random')
  if (!active) return <div className="content-page drill-picker"><PageIntro eyebrow="ACTIVE RECALL" title="Choose your training lane." copy="Pick a challenge when you are ready. Nothing starts until you choose." onBack={onBack} /><div className="drill-picker-grid">{drillCards.map((card) => <button key={card.id} className={`drill-card ${card.color}`} onClick={() => onSelect(card.id)}><span className="card-number">{card.id === 'all' ? '★' : 'START'}</span><span className="card-icon"><Icon name={card.icon} /></span><strong>{card.title}</strong><span>{card.description}</span><span className="card-arrow"><Icon name="arrow" /></span></button>)}</div></div>
  const title = active === 'bingo' ? 'Build the whole rack.' : active === 'all' ? 'Train every length.' : active === 'mixed' ? 'Practice what needs you.' : 'One prompt. One answer.'
  const copy = active === 'bingo' ? 'You have two minutes. Find every source-valid word you can from seven rack tiles and one board tile.' : active === 'all' ? 'Choose random recall or progressive recall: two correct words in a row moves you toward longer words.' : active === 'mixed' ? 'Adaptive practice prioritizes words that are weak, slow, or due for review.' : 'Memorize the flash, then race the clock. Answer quickly, then learn from the family.'
  const isAll = active === 'all'; const isMixed = active === 'mixed'
  return <div className="content-page drill-page"><PageIntro eyebrow="ACTIVE RECALL" title={title} copy={copy} onBack={onBack} /><div className="drill-tabs">{drillCards.map((card) => <button key={card.id} className={active === card.id ? 'drill-tab active' : 'drill-tab'} onClick={() => onSelect(card.id)}>{card.title}</button>)}</div>{active === 'bingo' ? <BingoRackSession /> : <><div className="mode-toggle" role="group" aria-label={isAll ? 'All-letter challenge mode' : isMixed ? 'Adaptive practice' : 'Challenge order'}><span>{isAll ? 'All-letter mode' : isMixed ? `${dueWords(attempts).length} due now` : 'Challenge order'}</span>{!isMixed && (isAll ? ['random', 'progressive'] : ['sequence', 'random']).map((option) => <button key={option} className={(isAll ? allMode : mode) === option ? 'mode-button active' : 'mode-button'} onClick={() => isAll ? setAllMode(option as 'random' | 'progressive') : setMode(option as 'sequence' | 'random')}>{option}</button>)}</div><DrillSession type={active} mode={isAll ? allMode : isMixed ? 'adaptive' : mode} attempts={attempts} onRecord={onRecord} /></>}</div>
}

function DrillSession({ type, mode, attempts, onRecord }: { type: DrillType; mode: 'sequence' | 'random' | 'progressive' | 'adaptive'; attempts: Attempt[]; onRecord: (attempt: Attempt) => void }) {
  const [index, setIndex] = useState(0); const [answer, setAnswer] = useState(''); const [feedback, setFeedback] = useState<boolean | null>(null); const [phase, setPhase] = useState<'revealing' | 'answering' | 'feedback'>('revealing'); const [elapsedMs, setElapsedMs] = useState(0); const [progressLength, setProgressLength] = useState(2); const [progressStreak, setProgressStreak] = useState(0); const startedAt = useRef(Date.now()); const inputRef = useRef<HTMLInputElement>(null)
  const pool = useMemo(() => wordsForDrill(type), [type]); const progressivePool = useMemo(() => pool.filter((word) => word.length === progressLength), [pool, progressLength]); const prompt = useMemo(() => { if (mode === 'adaptive') return selectAdaptiveWord(pool, attempts).spelling; const choices = mode === 'progressive' ? progressivePool : pool; return choices[Math.floor(Math.random() * Math.max(choices.length, 1))]?.spelling ?? pool[index % Math.max(pool.length, 1)]?.spelling ?? 'QI' }, [index, mode, pool, progressivePool]);
  useEffect(() => { setIndex(0); setProgressLength(2); setProgressStreak(0) }, [type, mode])
  useEffect(() => { setAnswer(''); setFeedback(null); setPhase('revealing'); setElapsedMs(0); const revealTimer = window.setTimeout(() => { startedAt.current = Date.now(); setPhase('answering'); window.requestAnimationFrame(() => inputRef.current?.focus()) }, 1200); return () => window.clearTimeout(revealTimer) }, [type, mode, index])
  useEffect(() => { if (phase !== 'answering') return; const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAt.current), 100); return () => window.clearInterval(timer) }, [phase])
  const submit = () => { if (!answer.trim() || phase !== 'answering') return; const correct = normalize(answer) === normalize(prompt); const latencyMs = Date.now() - startedAt.current; setFeedback(correct); setPhase('feedback'); setElapsedMs(latencyMs); onRecord({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), drill: type, prompt, response: normalize(answer), correct, latencyMs }) }
  const next = () => { if (type === 'all' && mode === 'progressive') { if (feedback) { if (progressStreak >= 1) { setProgressLength((length) => Math.min(8, length + 1)); setProgressStreak(0) } else setProgressStreak(1) } else setProgressStreak(0) } setIndex((current) => current + 1) }
  const flipped = phase !== 'revealing'; const timerText = phase === 'revealing' ? 'memorize' : `${(elapsedMs / 1000).toFixed(1)}s`
  return <div className="session-card"><div className="session-top"><span className="session-label"><span className="live-dot" /> {drillLabel(type)} drill{type === 'all' && mode === 'progressive' ? ` · length ${progressLength} · streak ${progressStreak}/2` : ''}</span><span className="timer"><Icon name="clock" /> {timerText}</span></div><div className="flashcard-stage" aria-live="polite"><div className={`flashcard ${flipped ? 'is-flipped' : ''}`}><div className="flashcard-face flashcard-front"><span className="challenge-label">Memorize this word</span><strong>{prompt}</strong><small>Flip in a moment…</small></div><div className={`flashcard-face flashcard-back ${feedback === true ? 'result-correct' : feedback === false ? 'result-incorrect' : ''}`}>{feedback === null ? <><span className="challenge-label">Type the word you saw</span><strong>•••</strong><small>Recall the word, then submit</small></> : <div className="card-result"><span className="card-result-icon"><Icon name={feedback ? 'check' : 'x'} /></span><strong>{feedback ? 'Correct — nice job.' : 'Incorrect.'}</strong><small>{feedback ? 'Keep the momentum going.' : <>The answer was <b>{prompt}</b>.</>}</small></div>}</div></div></div><div className="answer-row"><input ref={inputRef} autoFocus value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && submit()} placeholder={phase === 'revealing' ? 'Get ready…' : 'TYPE IT BACK…'} aria-label="Your answer" autoCapitalize="characters" autoCorrect="off" spellCheck={false} inputMode="text" disabled={phase !== 'answering'} /><button className="button primary" onClick={feedback === null ? submit : next} disabled={phase === 'revealing'}>{phase === 'revealing' ? 'Memorize…' : feedback === null ? 'Check answer' : 'Next challenge'} <Icon name={feedback === null ? 'check' : 'arrow'} /></button></div></div>
}

function BingoRackSession() {
  const bingoPool = useMemo(() => uniqueSourceWords.filter((word) => word.category === 'high-probability-bingo' && word.length === 8), [])
  const [round, setRound] = useState(0); const [answer, setAnswer] = useState(''); const [submitted, setSubmitted] = useState<string[]>([]); const [running, setRunning] = useState(false); const [remaining, setRemaining] = useState(120); const [finished, setFinished] = useState(false); const inputRef = useRef<HTMLInputElement>(null)
  const target = useMemo(() => bingoPool[Math.floor(Math.random() * Math.max(bingoPool.length, 1))]?.spelling ?? 'REACTION', [bingoPool, round]); const boardTile = target[target.length - 1]; const rack = target.slice(0, -1).split('').sort().join(''); const fullRack = `${rack}${boardTile}`; const possible = useMemo(() => wordsFromRack(fullRack), [fullRack]); const possibleSet = useMemo(() => new Set(possible.map((word) => word.spelling)), [possible]); const sourceSet = useMemo(() => new Set(uniqueSourceWords.map((word) => word.spelling)), [])
  useEffect(() => { setAnswer(''); setSubmitted([]); setFinished(false); setRemaining(120); setRunning(false) }, [round])
  useEffect(() => { if (!running) return; const timer = window.setInterval(() => setRemaining((value) => { if (value <= 1) { window.clearInterval(timer); setRunning(false); setFinished(true); return 0 } return value - 1 }), 1000); return () => window.clearInterval(timer) }, [running])
  useEffect(() => { if (running) window.requestAnimationFrame(() => inputRef.current?.focus()) }, [running])
  const submit = () => { const word = normalize(answer); if (!running || word.length < 2 || submitted.includes(word)) return; setSubmitted((items) => [...items, word]); setAnswer(''); window.requestAnimationFrame(() => inputRef.current?.focus()) }
  const start = () => { setRunning(true); setFinished(false); setRemaining(120); window.requestAnimationFrame(() => inputRef.current?.focus()) }
  const correct = submitted.filter((word) => possibleSet.has(word)); const incorrect = submitted.filter((word) => !possibleSet.has(word)); const missed = possible.filter((word) => !submitted.includes(word.spelling)).slice(0, 80)
  return <div className="session-card bingo-session"><div className="session-top"><span className="session-label"><span className="live-dot" /> 2-minute rack challenge</span><span className="timer"><Icon name="clock" /> {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span></div><div className="rack-card"><span className="challenge-label">Seven rack tiles + one board tile</span><div className="rack-tiles" aria-label={`Rack ${rack}, board tile ${boardTile}`}>{[...rack].map((letter, index) => <b className="rack-tile" key={`${letter}-${index}`}>{letter}</b>)}<b className="rack-tile board-tile">{boardTile}<small>board</small></b></div><small>Any source-valid word from 2–8 letters counts.</small></div><div className="bingo-controls"><input ref={inputRef} value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && submit()} placeholder={running ? 'TYPE A WORD…' : 'Press start to play'} aria-label="Bingo word" autoCapitalize="characters" autoCorrect="off" spellCheck={false} inputMode="text" disabled={!running} /><button className="button primary" onClick={running ? submit : start}>{running ? 'Add word' : finished ? 'Play again' : 'Start 2 minutes'} <Icon name={running ? 'check' : 'bolt'} /></button></div>{submitted.length > 0 && <div className="bingo-submissions"><div><span className="result-heading correct-text"><Icon name="check" /> Correct · {correct.length}</span><div className="word-chips">{correct.map((word) => <b key={word}>{word}<small>{scoreWord(word)} pts</small></b>)}</div></div>{incorrect.length > 0 && <div><span className="result-heading incorrect-text"><Icon name="x" /> Incorrect · {incorrect.length}</span><div className="word-chips">{incorrect.map((word) => <b key={word}>{word}<small>{sourceSet.has(word) ? 'not buildable from rack' : 'not in PDF source'}</small></b>)}</div></div>}</div>}{finished && <div className="missed-words"><div className="result-heading"><Icon name="search" /> Other source words you could make · {missed.length}</div><div className="word-chips">{missed.map((word) => <b key={word.spelling}>{word.spelling}<small>{scoreWord(word.spelling)} pts</small></b>)}</div><small>Scores use standard English Scrabble tile values. The board tile is counted, but no bingo bonus is applied.</small></div>}</div>
}

function RackLab({ onBack }: { onBack: () => void }) {
  const [labDictionary, setLabDictionary] = useState<DictionarySourceId>('focused'); const [rack, setRack] = useState('AEINST'); const [word, setWord] = useState('TISANE'); const plays = useMemo(() => rackPlays(rack, labDictionary), [rack, labDictionary]); const dumps = useMemo(() => dumpPlaysFor(rack, labDictionary), [rack, labDictionary]); const hooks = useMemo(() => hooksFor(word, labDictionary), [word, labDictionary]); const extensions = useMemo(() => extensionsFor(word, labDictionary), [word, labDictionary]); const family = useMemo(() => bingoFamilyFor(word), [word]); const anagrams = useMemo(() => anagramsFor(word, labDictionary), [word, labDictionary]); const [rackLoading, setRackLoading] = useState(false); useEffect(() => { if (labDictionary === 'focused') return; if (isFullDictionaryLoaded()) return; setRackLoading(true); void ensureFullDictionaryLoaded().then(() => setRackLoading(false)) }, [labDictionary])
  return <div className="content-page rack-lab"><PageIntro eyebrow="SCRABBLE INTELLIGENCE" title="Read the rack." copy="Explore plays, hooks, extensions, bingo families, and dump options — focused or the full 280,887-word CSW24 (lazy-loaded)." onBack={onBack} /><div className="filter-row" role="group" aria-label="Rack dictionary"><button className={labDictionary === 'focused' ? 'filter active' : 'filter'} onClick={() => setLabDictionary('focused')}>Focused</button><button className={labDictionary === 'full' ? 'filter active' : 'filter'} onClick={() => setLabDictionary('full')}>Full CSW24{rackLoading ? ' · loading…' : isFullDictionaryLoaded() ? ' · ready' : ''}</button></div><div className="rack-input-row"><label><span>Rack letters</span><input value={rack} onChange={(event) => setRack(normalize(event.target.value).slice(0, 15))} placeholder="AEINST" aria-label="Rack letters" autoCapitalize="characters" autoCorrect="off" spellCheck={false} /></label><button className="button secondary" onClick={() => setRack(randomRack())}>Random rack</button></div><div className="rack-lab-grid"><section className="lab-card lab-plays"><div className="lab-heading"><div><div className="eyebrow">RACK PLAYS</div><h2>{plays.length} source plays</h2></div><span>{rack.length} tiles</span></div><div className="play-list">{plays.slice(0, 36).map((play) => <div className="play-row" key={play.spelling}><strong>{play.spelling}</strong><span>{play.length} letters</span><b>{play.score} pts</b><small>leave {play.leave || '—'}</small></div>)}{!plays.length && <div className="empty-state">Enter at least two rack letters.</div>}</div></section><section className="lab-card"><div className="eyebrow">DUMP OPTIONS</div><h2>{dumps.length} useful dumps</h2><p className="lab-copy">I, U, and vowel-dump words that fit this rack.</p><div className="word-chips">{dumps.slice(0, 24).map((word) => <b key={word.spelling}>{word.spelling}<small>{word.score} pts</small></b>)}</div></section></div><section className="lab-card intelligence-card"><div className="lab-heading"><div><div className="eyebrow">WORD INTELLIGENCE</div><h2>Hooks, extensions, families.</h2></div><label className="inline-word-input"><span>Word</span><input value={word} onChange={(event) => setWord(normalize(event.target.value))} aria-label="Word to inspect" autoCapitalize="characters" /></label></div><div className="intelligence-grid"><IntelBlock title="Anagrams" values={anagrams.map((item) => item.spelling)} /><IntelBlock title="Front hooks" values={hooks.front.map((letter) => `${letter}${normalize(word)}`)} /><IntelBlock title="Back hooks" values={hooks.back.map((letter) => `${normalize(word)}${letter}`)} /><IntelBlock title="Extensions" values={extensions.slice(0, 20).map((item) => item.spelling)} /><IntelBlock title="Bingo family" values={family ? family.answers : []} /></div></section></div>
}

function IntelBlock({ title, values }: { title: string; values: string[] }) { return <div className="intel-block"><span>{title}</span>{values.length ? <div className="word-chips">{values.map((value) => <b key={value}>{value}</b>)}</div> : <small>None in the imported source.</small>}</div> }

type TournamentTurn = TurnRecord & { seconds: number; decision?: 'played' | 'challenged' }
type DraftTile = { rackIndex: number; letter: string; row: number; column: number; isBlank: boolean }
type DragItem = { kind: 'rack' | 'draft'; rackIndex: number }

function TournamentLab({ onBack }: { onBack: () => void }) {
  const [dictionarySource, setDictionarySource] = useState<DictionarySourceId>('focused'); const [durationMinutes, setDurationMinutes] = useState<TournamentDuration>(10); const [game, setGame] = useState<TournamentGame>(() => createTournamentGame(undefined, 'focused')); const [remaining, setRemaining] = useState(600); const [running, setRunning] = useState(false); const [paused, setPaused] = useState(false); const [learningMode, setLearningMode] = useState(true); const [draftTiles, setDraftTiles] = useState<DraftTile[]>([]); const [blankAssignments, setBlankAssignments] = useState<Record<number, string>>({}); const [activeRackIndex, setActiveRackIndex] = useState<number | null>(null); const [draggedItem, setDraggedItem] = useState<DragItem | null>(null); const [result, setResult] = useState<MoveResult | null>(null); const [history, setHistory] = useState<TournamentTurn[]>([]); const [decisionMessage, setDecisionMessage] = useState(''); const [selectedRack, setSelectedRack] = useState<number[]>([]); const turnStarted = useRef(Date.now())
  const finished = game.finished || remaining === 0; const liveGame = running && !paused && !finished; const locked = Boolean(result?.legal) && !learningMode; const draftAt = (row: number, column: number) => draftTiles.find((tile) => tile.row === row && tile.column === column); const draftRack = draftTiles.map((tile) => game.racks.human[tile.rackIndex] ?? '').join('')
  const draftInference = useMemo(() => {
    type DraftPlacement = { word: string; row: number; column: number; direction: Direction }
    const buildPlacement = (direction: Direction): DraftPlacement | null => {
      if ((direction === 'horizontal' && new Set(draftTiles.map((tile) => tile.row)).size !== 1) || (direction === 'vertical' && new Set(draftTiles.map((tile) => tile.column)).size !== 1)) return null
      const inside = (row: number, column: number) => row >= 0 && row < game.board.length && column >= 0 && column < game.board.length
      const step = direction === 'horizontal' ? { row: 0, column: 1 } : { row: 1, column: 0 }; let row = Math.min(...draftTiles.map((tile) => tile.row)); let column = Math.min(...draftTiles.map((tile) => tile.column))
      while (inside(row - step.row, column - step.column) && game.board[row - step.row][column - step.column]) { row -= step.row; column -= step.column }
      const startRow = row; const startColumn = column; let lineEndRow = Math.max(...draftTiles.map((tile) => tile.row)); let lineEndColumn = Math.max(...draftTiles.map((tile) => tile.column))
      while (inside(lineEndRow + step.row, lineEndColumn + step.column) && game.board[lineEndRow + step.row][lineEndColumn + step.column]) { lineEndRow += step.row; lineEndColumn += step.column }
      const length = direction === 'horizontal' ? lineEndColumn - startColumn + 1 : lineEndRow - startRow + 1; const letters: string[] = []
      for (let index = 0; index < length; index += 1) { const tileRow = startRow + step.row * index; const tileColumn = startColumn + step.column * index; const tile = draftAt(tileRow, tileColumn); const boardTile = game.board[tileRow]?.[tileColumn]; if (!tile && !boardTile) return null; letters.push(tile?.letter || boardTile?.letter || '') }
      return { word: letters.join(''), row: startRow, column: startColumn, direction }
    }
    if (!draftTiles.length) return { placement: null as DraftPlacement | null, status: 'Drag tiles from the rack onto the board.' }
    if (draftTiles.some((tile) => tile.isBlank && !tile.letter)) return { placement: null as DraftPlacement | null, status: 'Assign any blank tile to infer the play.' }
    const rows = new Set(draftTiles.map((tile) => tile.row)); const columns = new Set(draftTiles.map((tile) => tile.column))
    if (draftTiles.length > 1 && rows.size !== 1 && columns.size !== 1) return { placement: null as DraftPlacement | null, status: 'Place new tiles in one row or one column.' }
    const directions: Direction[] = draftTiles.length === 1 ? ['horizontal', 'vertical'] : rows.size === 1 ? ['horizontal'] : ['vertical']
    const candidates = directions.map(buildPlacement).filter((placement): placement is DraftPlacement => placement !== null && placement.word.length > 1)
    if (draftTiles.length === 1) {
      const legalCandidates = candidates.filter((placement) => validatePlacement(game.board, draftRack, placement, game.dictionarySource).legal)
      if (legalCandidates.length === 1) return { placement: legalCandidates[0], status: '' }
      if (legalCandidates.length > 1 || candidates.length > 1) return { placement: null as DraftPlacement | null, status: 'This tile can play both across and down. Place another tile to show the intended line.' }
      if (!candidates.length) return { placement: null as DraftPlacement | null, status: 'Place another tile in the same row or column to show the play direction.' }
    }
    const placement = candidates[0] ?? null
    return { placement, status: placement ? '' : 'Keep tiles in one line and fill every gap.' }
  }, [draftRack, draftTiles, game.board, game.dictionarySource])
  const draftPlacement = draftInference.placement
  const directionLabel = draftPlacement?.direction === 'horizontal' ? 'across' : draftPlacement?.direction === 'vertical' ? 'down' : ''
  const draftStatus = draftInference.status || `${draftPlacement?.word} · ${directionLabel} · ${draftTiles.length} new tile${draftTiles.length === 1 ? '' : 's'} ready to check.`
  useEffect(() => { if (!running || paused || finished) return; const timer = window.setInterval(() => setRemaining((value) => { if (value <= 1) { window.clearInterval(timer); setRunning(false); setPaused(false); return 0 } return value - 1 }), 1000); return () => window.clearInterval(timer) }, [finished, paused, running])
  const clearDraftCheck = () => { setResult(null); setDecisionMessage('') }
  const resetDraft = () => { setDraftTiles([]); setBlankAssignments({}); setActiveRackIndex(null); setDraggedItem(null); clearDraftCheck() }
  const start = () => { setGame(createTournamentGame(undefined, dictionarySource)); setRemaining(durationMinutes * 60); setHistory([]); resetDraft(); setSelectedRack([]); setPaused(false); setRunning(true); turnStarted.current = Date.now() }
  const togglePause = () => { if (!running || finished) return; setPaused((value) => !value) }
  const appendHistory = (turn: TurnRecord, seconds = Math.max(1, Math.round((Date.now() - turnStarted.current) / 1000)), decision?: TournamentTurn['decision']) => setHistory((items) => [...items, { ...turn, seconds, decision }])
  const resolveOpponent = (nextGame: TournamentGame) => { if (nextGame.finished || nextGame.currentPlayer !== 'opponent') return nextGame; const opponent = playOpponentTurn(nextGame); if (opponent.game.history.length) appendHistory(opponent.game.history[opponent.game.history.length - 1], 1); return opponent.game }
  const resolveOpponentAsync = async (nextGame: TournamentGame) => { if (nextGame.finished || nextGame.currentPlayer !== 'opponent') return nextGame; const opponent = await playOpponentTurnAsync(nextGame); if (opponent.game.history.length) appendHistory(opponent.game.history[opponent.game.history.length - 1], 1); return opponent.game }
  const startDrag = (item: DragItem, event: ReactDragEvent<HTMLElement>) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(item.rackIndex)); setDraggedItem(item) }
  const dropOnBoard = (row: number, column: number) => {
    if (!liveGame || game.currentPlayer !== 'human' || locked || game.board[row][column] || draftAt(row, column)) return
    const item = draggedItem ?? (activeRackIndex === null ? null : { kind: 'rack' as const, rackIndex: activeRackIndex }); if (!item) return
    if (item.kind === 'rack') { if (draftTiles.some((tile) => tile.rackIndex === item.rackIndex)) return; const rackLetter = game.racks.human[item.rackIndex]; setDraftTiles((tiles) => [...tiles, { rackIndex: item.rackIndex, letter: rackLetter === '?' ? blankAssignments[item.rackIndex] ?? '' : rackLetter, row, column, isBlank: rackLetter === '?' }]) }
    else setDraftTiles((tiles) => tiles.map((tile) => tile.rackIndex === item.rackIndex ? { ...tile, row, column } : tile))
    setActiveRackIndex(null); setDraggedItem(null); clearDraftCheck()
  }
  const dropOnRack = () => { if (!liveGame || !draggedItem || draggedItem.kind !== 'draft' || locked) return; setDraftTiles((tiles) => tiles.filter((tile) => tile.rackIndex !== draggedItem.rackIndex)); setDraggedItem(null); clearDraftCheck() }
  const removeDraft = (rackIndex: number) => { if (locked || paused) return; setDraftTiles((tiles) => tiles.filter((tile) => tile.rackIndex !== rackIndex)); clearDraftCheck() }
  const assignBlank = (rackIndex: number, value: string) => { if (paused) return; const letter = value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1); setBlankAssignments((items) => ({ ...items, [rackIndex]: letter })); setDraftTiles((tiles) => tiles.map((tile) => tile.rackIndex === rackIndex ? { ...tile, letter } : tile)); clearDraftCheck() }
  const checkPlacement = () => { if (!liveGame || !draftPlacement || !draftTiles.length) return; if (game.dictionarySource === 'full' && !isFullDictionaryLoaded()) { setDecisionMessage('Loading full CSW24… try again momentarily.'); void ensureFullDictionaryLoaded().then(() => setDecisionMessage('CSW24 ready — check again.')); return } setResult(validatePlacement(game.board, draftRack, draftPlacement, game.dictionarySource)); setDecisionMessage('') }
  const finishTurn = async (decision: NonNullable<TournamentTurn['decision']>) => { if (!liveGame || !result?.legal) return; const outcome = game.dictionarySource === 'full' && !isFullDictionaryLoaded() ? await playGameMoveAsync(game, result.placement, 'human') : playGameMove(game, result.placement, 'human'); if (!outcome.move.legal) { setResult(outcome.move); return } appendHistory(outcome.game.history[outcome.game.history.length - 1], undefined, decision); const nextGame = await resolveOpponentAsync(outcome.game); const latestTurn = nextGame.history[nextGame.history.length - 1]; setGame(nextGame); resetDraft(); setSelectedRack([]); setDecisionMessage(nextGame.finished ? 'Game complete.' : latestTurn?.player === 'opponent' ? `Opponent ${latestTurn.type === 'play' ? `played ${latestTurn.word} for ${latestTurn.score} points.` : 'passed.'}` : 'Play recorded.'); turnStarted.current = Date.now(); setRunning(!nextGame.finished); setPaused(false) }
  const pass = async () => { if (!liveGame || game.finished) return; const next = passTurn(game); appendHistory(next.history[next.history.length - 1]); const resolved = game.dictionarySource === 'full' ? await resolveOpponentAsync(next) : resolveOpponent(next); setGame(resolved); resetDraft(); setSelectedRack([]); setRunning(!resolved.finished); setDecisionMessage(resolved.finished ? 'Six consecutive passes ended the game.' : 'Pass recorded.'); turnStarted.current = Date.now() }
  const exchange = async () => { if (!liveGame || game.finished || !selectedRack.length) return; const letters = selectedRack.map((index) => game.racks.human[index]).join(''); const exchanged = exchangeTiles(game, letters); if (!exchanged.ok) { setDecisionMessage(exchanged.reason ?? 'Exchange unavailable.'); return } appendHistory(exchanged.game.history[exchanged.game.history.length - 1]); const resolved = game.dictionarySource === 'full' ? await resolveOpponentAsync(exchanged.game) : resolveOpponent(exchanged.game); setGame(resolved); resetDraft(); setSelectedRack([]); setRunning(!resolved.finished); setDecisionMessage('Tiles exchanged.'); turnStarted.current = Date.now() }
  const toggleExchangeTile = (index: number) => setSelectedRack((items) => items.includes(index) ? items.filter((item) => item !== index) : [...items, index])
  const totalScore = game.scores.human
  const visibleRack = running || finished ? game.racks.human : ''
  const fullDictionaryAvailable = true
  return (
    <div className="content-page tournament-lab">
      <div className="tournament-heading">
        <button className="back-button" onClick={onBack}>← Back</button>
        <div className="tournament-heading-copy">
          <div className="eyebrow">TOURNAMENT LAB</div>
          <h1>Make the move under pressure.</h1>
          <p>Drag tiles onto the board, use the premiums, and keep the whole turn visible while the clock runs.</p>
        </div>
        <div className="tournament-heading-note"><span className="live-dot" /> Desktop board workspace</div>
      </div>

      <div className="tournament-topline">
        <span className="session-label"><span className="live-dot" /> {paused ? 'paused' : running ? game.currentPlayer === 'human' ? 'your turn' : 'opponent turn' : finished ? 'game complete' : 'ready to start'}</span>
        <span className="game-clock"><Icon name="clock" /> {Math.floor((running || finished ? remaining : durationMinutes * 60) / 60)}:{String((running || finished ? remaining : durationMinutes * 60) % 60).padStart(2, '0')}</span>
        <span className="bag-count">{running || finished ? `${game.bag.length} tiles in bag` : 'Rack drawn on start'}</span>
        <label className="tournament-setting">
          <span>Dictionary</span>
          <select value={dictionarySource} onChange={(event) => { const next = event.target.value as DictionarySourceId; setDictionarySource(next); if (next === 'full') void ensureFullDictionaryLoaded() }} disabled={running} aria-label="Tournament dictionary">
            <option value="focused">Focused PDF source</option>
            <option value="full">Full CSW24 (280,887){isFullDictionaryLoaded() ? ' · ready' : ' · lazy-loads on select'}</option>
          </select>
        </label>
        <label className="tournament-setting">
          <span>Timer</span>
          <select value={durationMinutes} onChange={(event) => { const next = Number(event.target.value) as TournamentDuration; setDurationMinutes(next); if (!running) setRemaining(next * 60) }} disabled={running} aria-label="Tournament timer">
            {TOURNAMENT_TIME_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}
          </select>
        </label>
        <div role="group" aria-label="Draft mode" style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ color:'var(--muted)', fontFamily:'DM Mono, monospace', fontSize:11, textTransform:'uppercase', letterSpacing:'.08em' }}>Mode</span>
          <button type="button" onClick={() => setLearningMode(true)} aria-pressed={learningMode} style={modePillStyle(learningMode)}>Learning</button>
          <button type="button" onClick={() => setLearningMode(false)} aria-pressed={!learningMode} style={modePillStyle(!learningMode)}>Competition</button>
        </div>
        {running && !finished && <button type="button" className="button secondary" onClick={togglePause} aria-pressed={paused}>{paused ? 'Resume' : 'Pause'} <Icon name="clock" /></button>}
        <button className="button primary" onClick={start}>{running ? 'Restart game' : finished ? 'New game' : `Start ${durationMinutes}-minute game`} <Icon name="bolt" /></button>
      </div>

      <div className="tournament-grid">
        <section className="board-card">
          <div className="lab-heading">
            <h2>{boardHasTilesForUi(game) ? 'Live board' : 'Opening move'}</h2>
            <div className="premium-legend"><span><i className="legend-you" /> You</span><span><i className="legend-opponent" /> Opponent</span></div>
          </div>
          <p className="board-instruction">{paused ? 'Game paused. The clock is frozen and inputs are disabled. Press Resume to continue.' : running ? 'Drag rack tiles into a row or column. The play direction is inferred automatically; fill every gap. Drag a draft tile back to the rack to remove it.' : 'The board is ready. Choose your dictionary and clock, then start when you are ready.'}</p>
          <div className="scrabble-board" aria-label="Scrabble board">
            {game.board.flatMap((row, rowIndex) => row.map((tile, columnIndex) => {
              const draft = draftAt(rowIndex, columnIndex)
              const premium = premiumAt(rowIndex, columnIndex)
              const occupied = Boolean(tile)
              const label = draft
                ? `${draft.isBlank ? draft.letter ? `blank ${draft.letter}` : 'blank tile' : draft.letter}, row ${rowIndex + 1}, column ${columnIndex + 1}`
                : tile
                  ? `${tile.letter}, row ${rowIndex + 1}, column ${columnIndex + 1}`
                  : `${premium ? premium.replace('-', ' ') : 'open square'}, row ${rowIndex + 1}, column ${columnIndex + 1}`
              return <button type="button" className={`board-cell ${premium ? `premium ${premium}` : ''} ${occupied ? 'occupied' : ''} ${draft ? 'draft-tile' : ''} ${tile?.player === 'opponent' ? 'opponent-tile' : ''}`} key={`${rowIndex}-${columnIndex}`} title={premium ? premium.replace('-', ' ') : undefined} aria-label={label} draggable={Boolean(draft) && !locked} disabled={(!draft && occupied) || !liveGame || game.currentPlayer !== 'human' || locked} onClick={() => draft ? removeDraft(draft.rackIndex) : dropOnBoard(rowIndex, columnIndex)} onDragStart={(event) => draft && startDrag({ kind: 'draft', rackIndex: draft.rackIndex }, event)} onDragEnd={() => setDraggedItem(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); dropOnBoard(rowIndex, columnIndex) }}>{draft ? draft.isBlank ? draft.letter || '☆' : draft.letter : tile?.letter ?? (premium ? premiumShortLabel(premium) : '')}</button>
            }))}
          </div>
          <div className="rack-drop-zone">
            <div className="rack-tiles tournament-rack" aria-label={visibleRack ? `Your rack ${visibleRack}` : 'Your rack is empty until the game starts'}>
              {visibleRack ? [...visibleRack].map((letter, index) => {
                const inDraft = draftTiles.some((tile) => tile.rackIndex === index)
                const displayLetter = letter === '?' ? '☆' : letter
                return <div className={`rack-tile-wrap ${inDraft ? 'in-draft' : ''}`} key={`${letter}-${index}`}><button className={`rack-tile rack-select ${activeRackIndex === index ? 'active' : ''}`} draggable={!inDraft && liveGame && game.currentPlayer === 'human' && !locked} onClick={() => setActiveRackIndex(index)} onDragStart={(event) => startDrag({ kind: 'rack', rackIndex: index }, event)} onDragEnd={() => setDraggedItem(null)} disabled={inDraft || !liveGame || game.currentPlayer !== 'human' || locked} title={inDraft ? 'Already on the board' : `Place ${displayLetter}`}>{displayLetter}</button><label className="exchange-check"><input type="checkbox" checked={selectedRack.includes(index)} onChange={() => toggleExchangeTile(index)} disabled={inDraft || !liveGame || game.currentPlayer !== 'human' || locked} aria-label={`Select ${displayLetter} for exchange`} /><span>exchange</span></label></div>
              }) : <div className="rack-empty"><Icon name="grid" /><span><strong>Your rack appears when the clock starts.</strong><small>Set your game options above, then start the round.</small></span></div>}
            </div>
            <div className="rack-actions"><button className="button secondary" onClick={exchange} disabled={!liveGame || game.currentPlayer !== 'human' || locked || !selectedRack.length}>Exchange selected</button><small>{activeRackIndex === null ? 'Drag or click a tile to place it.' : `Tile ${game.racks.human[activeRackIndex]} selected for placement.`}</small></div>
          </div>
        </section>

        <section className="turn-card">
          <div className="turn-card-heading"><div><div className="eyebrow">YOUR TURN</div><h2>{running ? game.currentPlayer === 'human' ? 'Build your play.' : 'Opponent is thinking.' : finished ? 'Game complete.' : 'Ready when you are.'}</h2></div><span className="turn-number">TURN {game.turnNumber}</span></div>
          <div className="scoreboard" aria-label="Tournament score">
            <div className="score-row score-you"><span>You</span><strong>{game.scores.human}</strong></div>
            <div className="score-row score-opponent"><span>Opponent</span><strong>{game.scores.opponent}</strong></div>
          </div>
          <p className="lab-copy">{paused ? 'Game paused. Press Resume to keep playing.' : running ? (learningMode ? 'Learning mode: place your tiles, check the word, then keep editing the draft or press Place it when you are happy.' : 'Competition mode: place your tiles and check the word — after a legal check the draft locks until Place it.') : 'Start the clock to receive a rack and begin from the center square.'}</p>
          <div className={`draft-summary ${draftPlacement ? 'ready' : ''}`} aria-live="polite"><span className="draft-summary-label">DRAFT PLAY</span><strong>{draftPlacement?.word || '—'}</strong><small>{draftStatus}</small></div>
          {draftTiles.some((tile) => tile.isBlank) && <div className="blank-assignment"><span>Blank tile letters</span>{draftTiles.filter((tile) => tile.isBlank).map((tile) => <label key={tile.rackIndex}><span>☆ at {tile.row + 1},{tile.column + 1}</span><input value={tile.letter} onChange={(event) => assignBlank(tile.rackIndex, event.target.value)} maxLength={1} placeholder="A" aria-label={`Letter for blank tile at row ${tile.row + 1}, column ${tile.column + 1}`} disabled={locked} /></label>)}</div>}
          <div className="turn-actions"><button className="button primary" onClick={checkPlacement} disabled={!liveGame || game.currentPlayer !== 'human' || locked || !draftPlacement}>Check placement <Icon name="check" /></button><button className="button secondary" onClick={pass} disabled={!liveGame || game.currentPlayer !== 'human' || locked || draftTiles.length > 0}>Pass turn</button></div>
          {result && <div className={`turn-result ${result.legal ? 'legal' : 'illegal'}`}><span className="card-result-icon"><Icon name={result.legal ? 'check' : 'x'} /></span><div><strong>{result.legal ? `${result.placement.word} · ${result.score} points${result.bingo ? ' · bingo' : ''}` : 'Play not legal'}</strong><small>{result.legal ? `${result.formedWords.map((word) => `${word.word} (${word.score})`).join(' ')} · ${categoryForPlay(result.placement.word, game.dictionarySource)?.sourceSection ?? 'Selected dictionary'}${learningMode ? ' · Learning mode: keep editing or press Place it.' : ' · Locked — commit or restart.'}` : result.reason}</small></div></div>}
          {result?.legal && <div className="decision-row"><button className="button secondary" onClick={() => finishTurn('played')}>Place it</button><button className="button secondary" onClick={() => finishTurn('challenged')}>Challenge decision</button></div>}
          {decisionMessage && <div className="decision-message"><Icon name="check" /> {decisionMessage}</div>}
          <div className="turn-log"><div className="turn-log-heading"><div><div className="eyebrow">TURN LOG</div><strong>{totalScore} points · {history.filter((turn) => turn.player === 'human' && turn.type === 'play').length} plays</strong></div><small>{game.finished ? `${game.scores.human > game.scores.opponent ? 'You win' : game.scores.human < game.scores.opponent ? 'Opponent wins' : 'Tie'} · ${game.endReason === 'passes' ? 'six passes' : 'rack-out'}` : `${game.history.length} turns`}</small></div>{history.length ? <div className="turn-log-list">{history.slice(-6).reverse().map((turn, index) => <div className="turn-log-row" key={`${turn.player}-${turn.type}-${turn.word ?? turn.tiles ?? 'pass'}-${index}`}><span className={`attempt-mark ${turn.player === 'human' ? 'yes' : 'no'}`}><Icon name={turn.type === 'play' ? 'check' : 'clock'} /></span><strong>{turn.player === 'human' ? 'You' : 'Opponent'}{turn.word ? ` · ${turn.word}` : ` · ${turn.type}`}</strong><span>{turn.score ? `${turn.score} pts` : turn.type === 'exchange' ? `${turn.tiles} exchanged` : 'Pass'}</span></div>)}</div> : <small className="turn-log-empty">Your turns will appear here.</small>}</div>
        </section>
      </div>
    </div>
  )
}

const boardHasTilesForUi = (game: TournamentGame) => game.board.some((row) => row.some(Boolean))
const premiumShortLabel = (premium: NonNullable<ReturnType<typeof premiumAt>>) => ({ 'double-letter': '2L', 'triple-letter': '3L', 'double-word': '2W', 'triple-word': '3W' }[premium])
const modePillStyle = (active: boolean): CSSProperties => ({ minHeight:36, padding:'0 12px', border:'1px solid var(--line)', color: active ? 'white' : 'var(--muted)', background: active ? 'var(--teal)' : 'transparent', borderColor: active ? 'var(--teal)' : 'var(--line)', fontFamily:'DM Mono, monospace', fontSize:11, letterSpacing:'.08em', textTransform:'uppercase', fontWeight:600 })

function ProgressDashboard({ attempts, onBack }: { attempts: Attempt[]; onBack: () => void }) {
  const recent = attempts.slice(0, 8); const weak = weakWords(attempts, 12); const due = dueWords(attempts); const stats = wordStats(attempts)
  return <div className="content-page"><PageIntro eyebrow="YOUR TRAINING LOG" title="Progress you can feel." copy="Mastery combines correctness, response speed, and review timing. Adaptive Mix uses this same log to choose what you see next." onBack={onBack} /><div className="progress-grid"><div className="progress-card"><span>Overall accuracy</span><strong>{attempts.length ? `${accuracy(attempts)}%` : '—'}</strong><small>{attempts.length ? `${attempts.length} attempts recorded` : 'Start a drill to begin'}</small></div><div className="progress-card"><span>Average response</span><strong>{attempts.length ? `${(averageLatency(attempts) / 1000).toFixed(1)}s` : '—'}</strong><small>{due.length} words due for review</small></div><div className="progress-card"><span>Words with history</span><strong>{stats.length || '—'}</strong><small>Mastery tracked locally</small></div></div><section className="weak-panel"><div className="section-heading compact"><div><div className="eyebrow">ADAPTIVE QUEUE</div><h2>Words to revisit</h2></div><span className="queue-count">{weak.length} in focus</span></div>{weak.length ? <div className="weak-list">{weak.map((stat) => <div className="weak-row" key={stat.spelling}><strong>{stat.spelling}</strong><span className={`mastery mastery-${stat.mastery.toLowerCase()}`}>{stat.mastery}</span><span>{stat.accuracy}% · {(stat.averageLatencyMs / 1000).toFixed(1)}s avg</span><small>{stat.attempts} attempt{stat.attempts === 1 ? '' : 's'}</small></div>)}</div> : <div className="empty-state">Complete a few recall cards and your adaptive queue will appear here.</div>}</section><div className="section-heading compact"><div><div className="eyebrow">RECENT ATTEMPTS</div><h2>Keep showing up.</h2></div></div><div className="attempt-list">{recent.length ? recent.map((attempt) => <div className="attempt-row" key={attempt.id}><span className={`attempt-mark ${attempt.correct ? 'yes' : 'no'}`}><Icon name={attempt.correct ? 'check' : 'x'} /></span><strong>{attempt.prompt}</strong><span>{attempt.correct ? 'Correct' : `Answer: ${attempt.response || '—'}`}</span><small>{drillLabel(attempt.drill)} · {(attempt.latencyMs / 1000).toFixed(1)}s</small></div>) : <div className="empty-state">Your attempt history will appear here.</div>}</div></div>
}

export { App }
