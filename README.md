# Scrabbler

> A focused training system for competitive Scrabble players. Vocabulary recall, anagram retrieval, power-letter knowledge, dump-word recognition, and tournament board play — all in one fast web app.

[![Live deployment](https://img.shields.io/badge/live-scrabbler.pages.dev-orange)](https://scrabbler.pages.dev)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-private-lightgrey)
![Status](https://img.shields.io/badge/status-active--development-brightgreen)

---

## What it is

Scrabbler is a **mobile-first PWA** that turns a curated Scrabble word study source into active-recall practice and full tournament simulation. The training loop is: see the prompt → answer under timed pressure → get correctness + family → next challenge → spaced repetition.

The current release (**v1.0.0**) ships:

- **Word Lookup** over a curated 2,580-word study source *and* the full 280,887-word Collins Scrabble Words 2024 (CSW24) lexicon.
- **Six active-recall drills** (2-letter sprint, power letters, all-letter sprint, adaptive mix, bingo families, dump words).
- **Rack Lab** — rack plays, hook/extension analysis, anagrams, dump options, bingo-family matching.
- **Tournament Lab** — full 15×15 board with center-opening rules, connected placements, cross-word validation, premium squares (2L/3L/2W/3W), blank tiles, bingo bonuses, opponent AI, pass/exchange, end-game rack-out adjustment, and game pause/resume.
- **My Progress** dashboard with mastery ratings, accuracy, average latency, and an adaptive queue.
- **Optional Google sign-in** that syncs training attempts across devices through a Cloudflare D1 database.

The site is deployed at **[scrabbler.pages.dev](https://scrabbler.pages.dev)** and ships as a static bundle on Cloudflare Pages — no server-side rendering, near-zero cold start.

---

## Table of contents

- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Quick start (local dev)](#quick-start-local-dev)
- [Deployment](#deployment)
  - [Cloudflare Pages setup](#cloudflare-pages-setup)
  - [GitHub Actions CI/CD](#github-actions-cicd)
  - [Required secrets](#required-secrets)
- [Features in v1.0.0](#features-in-v100)
  - [Lookup](#lookup)
  - [Quick Drill](#quick-drill)
  - [Rack Lab](#rack-lab-1)
  - [Tournament Lab](#tournament-lab)
  - [My Progress](#my-progress)
  - [Optional Google Sign-in](#optional-google-sign-in)
- [Architecture deep dive](#architecture-deep-dive)
  - [Dictionary sources](#dictionary-sources)
  - [Word model](#word-model)
  - [State management](#state-management)
  - [Performance & code splitting](#performance--code-splitting)
- [Testing](#testing)
- [Data sources & licensing](#data-sources--licensing)
- [Known constraints](#known-constraints)
- [Roadmap](#roadmap)
- [Project history](#project-history)

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| **Build** | Vite 8 | Fast ESM dev server, native code splitting, single-command production build. |
| **UI** | React 19 + TypeScript 5 (strict) | Type-safe components, well-known ecosystem. |
| **Routing** | Single-file view state (`'home' \| 'lookup' \| 'drill' \| 'progress' \| 'rack' \| 'tournament'`) | No router dependency for a 5-view SPA — keeps the bundle small. |
| **Styling** | Hand-written CSS (`src/styles.css`) + component-specific inline styles | Mobile-first, no framework churn. |
| **Tests** | Vitest 4 + jsdom | Same runner as Vite; ~80 unit tests in <200 ms. |
| **Persistence (anonymous)** | `localStorage` under `scrabbler.attempts.v1` | Zero-backend, instant. |
| **Persistence (signed-in)** | Cloudflare D1 (`scrabbler-profile-db`) | Serverless SQL, no separate DB to manage. |
| **Hosting** | Cloudflare Pages | Edge-deployed static assets + Pages Functions for the auth/sync API. |
| **Auth** | Google OAuth 2.0 with PKCE, signed session cookies, server-side sessions | No third-party identity service. See [`docs/AUTH_SETUP.md`](./docs/AUTH_SETUP.md). |
| **CI/CD** | GitHub Actions → Cloudflare Pages | Tests + build + deploy on every push to `main`. PR branches get preview URLs. |

**Dependencies are deliberately light.** No router, no state library, no UI framework, no test framework other than Vitest. The full client bundle is ~93 KB gzipped.

---

## Repository layout

```
.
├── src/
│   ├── App.tsx                  # All five view components + main shell
│   ├── main.tsx                 # React root
│   ├── styles.css               # Hand-written CSS — DO NOT MODIFY
│   ├── data/
│   │   ├── source-words.json    # Curated 2,580-word study source
│   │   ├── bingo-families.json  # Three bingo stems + answer families
│   │   ├── csw24.json           # Full 280,887-word CSW24 (lazy-loaded)
│   │   ├── csw24-with-definitions.json  # Full definitions (lazy-loaded)
│   │   └── words.ts             # Normalized word layer + filter helpers
│   └── lib/
│       ├── scrabble.ts          # Rack plays, hooks, extensions, anagrams
│       ├── tournament.ts        # Full board engine + game state machine
│       ├── training.ts          # Attempts, mastery, adaptive selection
│       ├── auth.ts              # Client-side Google sign-in helpers
│       ├── lookup.test.ts       # 27 tests covering the lookup filter
│       └── training.test.ts     # 15 tests covering training metrics & helpers
├── functions/                   # Pages Functions (Workers under Pages)
│   ├── api/
│   │   ├── me.ts                # GET /api/me
│   │   ├── sync/attempts.ts     # GET + POST /api/sync/attempts
│   │   └── auth/
│   │       ├── google.ts        # OAuth start + callback
│   │       └── logout.ts        # Session destroy
│   ├── lib/auth.ts              # Server-side session helpers
│   └── tsconfig.json
├── migrations/
│   └── 0001_profile_sync.sql    # D1 schema: users + sessions + attempts
├── data/source/
│   ├── Word Study.pdf           # Original study source PDF
│   ├── csw24-manifest.json      # Build metadata for the CSW24 imports
│   └── extract_csw24.py         # Regeneration script (in scripts/ originally)
├── scripts/
│   └── extract_csw24.py         # Pulls CSW24 from a Zyzzyva SQLite DB
├── public/
│   ├── source-words.pdf         # User-facing download of the study source
│   └── _headers                 # Cache-control hints for Cloudflare
├── .github/workflows/
│   └── deploy-pages.yml         # Tests → build → deploy to Cloudflare Pages
├── wrangler.jsonc               # Cloudflare Pages + D1 binding config
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── vite.config.ts
└── package.json
```

Two project-doc files complement this README and are kept in sync with what the deployed app actually does:
- [`PROJECT.md`](./PROJECT.md) — product principles and module plan
- [`PRODUCT_SPEC.md`](./PRODUCT_SPEC.md) — vision, core loop, navigation, accessibility

Plus the deep-dive operational docs in [`docs/`](./docs):
- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — deployment runbook
- [`docs/AUTH_SETUP.md`](./docs/AUTH_SETUP.md) — Google OAuth and D1 setup
- [`docs/DATA_NOTES.md`](./docs/DATA_NOTES.md) — vocabulary provenance
- [`docs/CODEX_START.md`](./docs/CODEX_START.md), [`docs/CODEX_HANDOVER.md`](./docs/CODEX_HANDOVER.md) — agent onboarding

---

## Quick start (local dev)

Requirements: Node.js 22+ and npm.

```bash
git clone https://github.com/meta4m/scrabbler
cd scrabbler
npm install
npm run dev
```

Open the printed URL (defaults to `http://localhost:5173`). The first launch uses the **focused** study source — no network needed. Toggle to the **full CSW24** dictionary in the Lookup page to lazy-load the 770 KB gzipped word list the first time.

### Useful commands

```bash
npm test           # Run all unit tests (~80 tests, <200 ms)
npx tsc -b         # Strict TypeScript type check (must be clean)
npm run build      # Production build into dist/
npm run preview    # Serve the production build locally
npm run deploy:preview    # Push to a Pages preview branch (requires wrangler auth)
npm run deploy:production # Push to production (requires wrangler auth)
```

### What you can change without breaking anything

- Anything in `src/` and `functions/` — normal dev workflow.
- `docs/` — documentation updates.
- `data/source/csw24-manifest.json` — bumped when the CSW24 imports are regenerated.

### What you must not change

- **`src/styles.css`** — the global stylesheet. All new visual elements are inline-styled on JSX to avoid touching this file by project policy. Tests/build will not catch this, so verify `git diff -- src/styles.css` is empty before any commit.
- `wrangler.jsonc` `database_id` — that's the live D1; changing it breaks production.

---

## Deployment

Scrabbler deploys to **Cloudflare Pages** with a Cloudflare **D1** database for signed-in users. Production deployment is fully automated via GitHub Actions.

### Cloudflare Pages setup

The build outputs to `dist/` and is uploaded with `wrangler pages deploy`. A one-time setup creates the Pages project:

```bash
npm install -g wrangler          # Wrangler 4.x
wrangler login                   # Browser OAuth flow
wrangler pages project create scrabbler --production-branch main
# Cloudflare account must already have a D1 database. Create with:
wrangler d1 create scrabbler-profile-db
# Apply the schema migration:
wrangler d1 migrations apply scrabbler-profile-db --remote
```

`wrangler.jsonc` references both bindings (the Pages project and the D1 binding) — keep these in sync with whatever you create in the Cloudflare dashboard.

### GitHub Actions CI/CD

The workflow at [`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml) runs on every push and PR. Stages:

1. Checkout the repository
2. Set up Node.js 22 with npm cache
3. `npm ci` (deterministic install)
4. `npm test` (unit tests must be green)
5. `npm run build` (TypeScript must be clean and Vite must succeed)
6. Type-check the Pages Functions (`functions/tsconfig.json`)
7. **On push to `main` or manual dispatch** → deploy `dist/` to the `scrabbler` Pages project (production URL: `scrabbler.pages.dev`)
8. **On PR from this repo** → deploy `dist/` to a `pr-<number>` preview branch (URL logged in the workflow output). PRs from forks **skip** the deploy step (still run tests + build).

Secrets are deliberately omitted from fork PRs to avoid credential leaks.

### Required secrets

Add these under **GitHub → Settings → Secrets and variables → Actions**. Values are redacted.

| Secret name | What it is | Where to set it |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | A durable custom Cloudflare API token with **Cloudflare Pages: Edit** permission scoped to the account holding the Pages project. Never an OAuth or short-lived credential. | `gh secret set CLOUDFLARE_API_TOKEN --repo meta4m/scrabbler` |
| `CLOUDFLARE_ACCOUNT_ID` | The Cloudflare account ID (hex string) where the Pages project lives. | `gh secret set CLOUDFLARE_ACCOUNT_ID --repo meta4m/scrabbler` |

And these in the **Cloudflare Pages project** (not GitHub) for Google sign-in:

| Secret name | What it is | How to set it |
|---|---|---|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID from Google Cloud Console. Scopes: `openid`, `email`, `profile`. Authorized redirect URI must be `https://<your-pages-domain>/api/auth/google/callback`. | `wrangler pages secret put GOOGLE_CLIENT_ID --project-name scrabbler` |
| `GOOGLE_CLIENT_SECRET` | Paired OAuth 2.0 client secret. | `wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name scrabbler` |
| `SESSION_SECRET` | A high-entropy string used to sign session cookies. Configured at deploy time via `wrangler.jsonc`; rotate by updating the binding. | Set in `wrangler.jsonc` or via `wrangler pages secret put`. |

**Local development** secrets go in `.dev.vars` (already `.gitignore`d). Copy `.dev.vars.example` if you want OAuth locally.

Full step-by-step instructions, including the Google OAuth consent-screen setup, are in [`docs/AUTH_SETUP.md`](./docs/AUTH_SETUP.md) and [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

---

## Features in v1.0.0

### Lookup

- **Two dictionaries** — toggle between the curated 2,580-word *Focused* study source and the full 280,887-word *Full CSW24* (lazy-loaded).
- **Substring + signature search** — typing `QI` finds QI; typing `AEINST` finds any word whose sorted letters include that signature.
- **Category pills** in Focused mode: All · 2-letter · J/Q/X/Z · Dumps · CSW24.
- **Length pill** in Full CSW24 mode: All · 2-letter only.
- **Empty query → empty list** (no implicit "browse everything").
- **Capped results** — up to 200 displayed; header reports total match count and footer suggests refining when truncated.
- **Inline definition lookup** — clicking the magnifier on any row fetches a one-line meaning from the lazy-loaded CSW24 definitions file (spinner while loading).
- **Inline-styled result rows** — length badge, truncating spelling with ellipsis, magnifier — fit any viewport without wrapping.
- **Test coverage** — 27 dedicated tests in `src/lib/lookup.test.ts` covering every dictionary × category × query combination.

### Quick Drill

Six drills, each with timed recall, response-latency scoring, per-word mastery tracking:

1. **2-letter sprint** — flash a 2-letter word, type it back. The training wheels for board positions.
2. **Power letters** — flash a J/Q/X/Z word, type it back. Rapid recall for the four hardest letters.
3. **All-letter sprint** — flash any focused word. Two modes: `random` and `progressive` (consecutive correct answers bump word length from 2 → 8).
4. **Adaptive mix** — let the app choose. Weak, slow, and due-for-review words surface first.
5. **Bingo families** — show a 7-tile rack + 1 board tile, list every 7- or 8-letter word you can build in 2 minutes. Spaced-correct words surface first.
6. **Dump words** — I, U, and vowel-dump racks. Same timed format.

Drill mechanics:
- 1.2 s reveal phase → timed answer phase → instant feedback → next.
- Adaptive mode uses mastery (`UNKNOWN → RECOGNIZED → RECALLABLE → FAST → AUTOMATIC`) computed from accuracy, average latency, and a review-due timestamp.

### Rack Lab

Read a tile rack. Enter up to 15 letters; the lab returns:
- **Rack plays** — every source-valid word 2–8 letters long, sorted by length then score, with the leave shown.
- **Dump options** — I-dump, U-dump, vowel-dump words suited to the rack.
- **Hooks** — letters that can be added at the front or back of an entered word to make a new valid word.
- **Extensions** — all valid words 1 letter longer than the entered word built by adding one tile.
- **Anagrams** — alternative arrangements of the entered word's letters.
- **Bingo family matches** — which 7-tile family stem the entered word's letters extend.
- Dictionary toggle (Focused / Full CSW24) with lazy-load.

### Tournament Lab

A complete 15×15 practice board:

- **Center-opening rule** — first move must cover the center square.
- **Connected placements** — every new tile must touch at least one existing tile.
- **Cross-word validation** — perpendicular cross-words are checked against the active dictionary and scored individually.
- **Premium squares** — Double/Triple Letter and Double/Triple Word (color-coded legend on the board).
- **Blank tiles** — assign any letter; scored as 0 points.
- **Bingo bonus** — +50 points when all 7 rack tiles are played.
- **Standard tile bag** — 100 tiles drawn from the official English-language distribution.
- **Rack-out end-game adjustment** — the player who empties their rack scores the doubled sum of the opponent's remaining tiles.
- **Pass turn** and **Exchange selected** tile actions.
- **Six-pass rule** — six consecutive passes end the game.
- **Automated opponent** — plays legal moves against the same dictionary. Async-friendly for full-CSW24 mode.
- **Configurable timer** — 10 / 25 / 50 minute tournament clocks.
- **Game pause/resume** — clock freezes; all inputs disabled.
- **Learning vs Competition mode** — Learning keeps the draft editable after a legal check; Competition locks the draft once a play checks out, forcing a Place-it decision.
- **Turn log** with human / opponent tag, points, exchange count, and pass counts.
- **Dictionary source toggle** (Focused PDF / Full CSW24) with lazy-load.

### My Progress

- **Overall accuracy** with a `0–100%` ring and total attempt count.
- **Average response time** in seconds.
- **Words with mastery history** count.
- **Adaptive queue** — your 12 weakest words plus the 12 due for review, with per-word mastery tag, accuracy %, average latency, attempt count.
- **Recent attempts log** — the last 8 attempts with correct/incorrect mark.

Anonymous attempts live in `localStorage` and stay on the device. Sign in with Google to merge them across devices.

### Optional Google Sign-in

- One-tap Google OAuth sign-in (PKCE, HttpOnly session cookie, server-side D1 session).
- No Google tokens stored in the browser or database.
- On sign-in: local attempts are merged with remote by attempt ID (kept under the 500-attempt local cap).
- A `Syncing… / Synced / Sync paused` pill in the header shows live sync state.

---

## Architecture deep dive

### Dictionary sources

The app speaks two dictionaries through a uniform `Word` shape. Both are loaded via `wordsForDictionary(source)`:

| Source | Path | Size (gzip) | Load |
|---|---|---|---|
| **Focused PDF source** | `src/data/source-words.json` (288 KB) | always | bundled |
| **Full CSW24 words** | `src/data/csw24.json` (770 KB gz) | first toggle | lazy chunk |
| **Full CSW24 definitions** | `src/data/csw24-with-definitions.json` (3.5 MB gz) | first magnifier click | lazy chunk |

Both are referenced via `import('./csw24.json')` so Vite emits a separate chunk for each. The CSW24 raw inputs (`csw24.txt`, `csw24-with-definitions.json`) are regenerated from a local Zyzzyva SQLite database by [`scripts/extract_csw24.py`](./scripts/extract_csw24.py) and are intentionally `.gitignore`d.

### Word model

```ts
type WordCategory =
  | '2-letter' | '3-letter' | 'power'      // study source
  | 'bingo' | 'high-probability-bingo'
  | 'i-dump' | 'u-dump' | 'vowel-dump'
  | 'csw24'                                // full dictionary

type Word = {
  spelling: string              // e.g. "QAT"
  length: number                // 3
  signature: string             // sorted letters, e.g. "AQT"
  category: WordCategory        // primary category
  sourceSection: string         // original PDF section name
  definition?: string           // populated lazily on magnifier click
}
```

Multiple categories per spelling are tracked separately via `categoriesForWord(spelling)`. This matters because the same spelling (e.g. `AA`, `QAT`) is study-relevant as both a length-bucket word *and* a power/dump word — the source PDFs list it in multiple sections, and the filter logic must reflect that.

### State management

There's no Redux, Zustand, or context provider. The pattern is:

- **App-level** (`App.tsx`): user session, sync state, view, active drill, attempts array, lookup query/category/dictionary/words.
- **Component-local** (`useState`): the rest — rack tiles, draft placements, paused flag, magnifier state, etc.
- **Derived data** (`useMemo`): filter results, adaptive queue, hook sets.
- **Side effects** (`useEffect`): lazy dictionary loads, definition fetches, timer ticks.

This keeps the mental model flat and the bundle minimal.

### Performance & code splitting

Production build sizes (gzipped):

| Asset | Size |
|---|---|
| `dist/assets/index-*.js` (app shell) | ~93 KB |
| `dist/assets/csw24-*.js` (full word list) | ~769 KB |
| `dist/assets/csw24-with-definitions-*.js` (definitions) | ~3.5 MB |

Anonymous first load pays only the 93 KB. The 770 KB dictionary is fetched the first time a user flips to Full CSW24 in Lookup or Tournament. The 3.5 MB definitions file is fetched only when the magnifier is clicked.

The 280k-word dictionary is also filtered with substring matching entirely in the browser — there's no server-side search endpoint. Results are capped at 200 with a suggested-refine hint.

---

## Testing

Two test files, run by `npm test`:

- **`src/lib/training.test.ts`** — 15 tests covering attempt persistence, mastery derivation, adaptive selection, anagram & rack-from-rack helpers, tournament legal-move validation, premium-square layout, end-game scoring, and the standard tile bag.
- **`src/lib/lookup.test.ts`** — 27 tests covering `categoriesForWord` and the `filterLookupWords` filter across every category × query × dictionary-mode combination, including regression coverage for the dedup-of-collisions bug that originally hid QAT from the J/Q/X/Z filter.

Run them with `npm test`. Type-check with `npx tsc -b`. Both are required to pass before any deployment.

---

## Data sources & licensing

- **Focused study source** — extracted from `Word Study.pdf` via OCR and curated by the project owner for personal Scrabble study. Redistribution requires explicit permission.
- **Collins Scrabble Words 2024** — the official tournament lexicon, extracted from a local Zyzzyva installation for offline use. **No CSW24 definitions are stored in the application bundle.** Definitions shown by the magnifier are sourced from a separate definitions extract and used only at runtime. This does **not** distribute the official Collins dictionary — only the wordlist, which is published as a public Scrabble lexicon.
- **Tile distribution, premium-square layout, and end-game rules** — based on the published NASPA / Collins ruleset, no copyrighted material included.
- **No analytics, no third-party tracking, no ads.**

Scrabbler is a personal project. **All rights reserved** by the project owner. No permission is granted to redistribute any part of this codebase or its curated data.

---

## Known constraints

- The Tournament Lab opponent is a rule-following simulator, not a competitive engine. It plays legal moves but does not optimize for score or block the human. A future upgrade can swap in a stronger AI.
- Full CSW24 search is browser-side substring matching across 280k entries — fast enough for instant feedback but not indexed for advanced patterns (prefix trees, regex). Future-proofing will move that into a Worker or add an index.
- Definitions are only available for the focused PDF source as a metadata sidecar. CSW24 word meanings are fetched from a separately bundled definitions file; coverage is non-uniform.
- The full CSW24 dictionary adds roughly 770 KB (gz) to a first-visit lookup session. Mobile users on metered connections should default to Focused.

---

## Roadmap

The complete delivered-phase checklist is in [`ROADMAP.md`](./ROADMAP.md). Below is the *remaining* work, in priority order:

### Phase 4 close-out
- [ ] Tune the compact mobile tournament layout after desktop / iPad sign-off

### Phase 6 — Meaning enrichment
- [ ] Add verified one-line meanings for the curated study source from public / openly licensed sources
- [ ] Expand CSW24 definitions coverage to all 280k words

### Phase 7 — Network play and broadcast
- [ ] Multiplayer rooms for up to four remote / LAN players
- [ ] Authoritative shared game state with reconnection handling
- [ ] Fixed spectator / broadcast view (no pointer or UI-motion noise)
- [ ] Admin-controlled stream start, live status, and shutdown
- [ ] TV casting and browser-based live-view delivery

### Lookup enhancements (proposed next)
- [ ] Pattern matching engine — *starts with*, *includes*, *anagram of*, length constraints
- [ ] Wildcards (`?` for any single letter, `*` for any sequence)
- [ ] Hook-aware search (find words that hook onto an entered word)
- [ ] Letter-frequency filters (only vowels, only consonants, contains J/Q/X/Z)
- [ ] Saved searches and tagged word lists

### Training enhancements
- [ ] Manual mastery override (mark a word "I know this" / "still hard")
- [ ] Per-drill configurability (custom timer durations, custom pool size)
- [ ] Streak tracking and weekly streak goals
- [ ] Sound + haptics (toggleable)
- [ ] Daily challenge with a deterministic prompt

### Tournament Lab enhancements
- [ ] Stronger AI opponent (beam search to depth N)
- [ ] End-game analysis panel showing each player's expected vs actual score
- [ ] Move history timeline scrubber (jump back to any prior board state)
- [ ] Challenge / phony rules toggle (allow or forbid non-dictionary plays)

### Quality / platform
- [ ] Service worker for true offline-first PWA install
- [ ] Indexed full-text dictionary (move dictionary off main thread on mobile)
- [ ] Translation / i18n (UI strings in `en-GB` and `en-US` first)
- [ ] Custom domain (currently parked at `scrabbler.pages.dev` only)
- [ ] Public API for the dictionary + training metrics

---

## Project history

Scrabbler was built in sequential phases, each scoped to deliver a working slice of the product:

- **Phase 0 — Handoff** — product concept, MVP definition, source structure, agent onboarding.
- **Phase 1 — Local MVP** — Vite/React/TypeScript shell, the original word lookup, all six drill types in basic form, local-storage attempt persistence, the first unit tests.
- **Phase 2 — Training engine** — mastery model, spaced repetition, latency-weighted scoring, the weak-words dashboard, mixed adaptive drills, rack generation.
- **Phase 3 — Scrabble intelligence** — the Rack Lab's hook/extension/anagram/bingo-family analysis and tile-distribution-aware random racks.
- **Phase 4 — Tournament simulation** — the full 15×15 board: legality, premiums, blank tiles, bingos, passes, exchanges, opponent turns, end-game rack-out adjustment, two-pane desktop layout, configurable clocks, learning vs competition mode.
- **Phase 5 — Deployment** — Cloudflare Pages, GitHub Actions, Google OAuth sign-in, D1-backed attempt synchronization.
- **v1.0.0 polish** — Full CSW24 lexicon integration (lazy-loaded, ~280k words + definitions), Rack Lab and Tournament Lab on the full lexicon, Lookup filter rework, end-to-end unit-test coverage for the lookup filter, this README.

---

## Contributing

This is currently a personal project, but the codebase is structured for clear contribution if you fork it:

1. **Read** [`PROJECT.md`](./PROJECT.md), then [`PRODUCT_SPEC.md`](./PRODUCT_SPEC.md), then this README.
2. **Open an issue or discussion** with the motivation, approach, and any UX impact.
3. **Branch from `main`** with a descriptive name (`feature/lookup-wildcards`, `fix/tournament-pass-loop`, …).
4. **Run `npm test` + `npx tsc -b` + `npm run build` locally** and confirm all three are clean.
5. **Never modify `src/styles.css`** in a way the maintainer hasn't pre-approved — inline styles only.
6. **Open a PR** with a clear description, screenshots if it's a UX change, and a note in `ROADMAP.md` if it closes a roadmap item.

The Cloudflare deploy workflow runs on your PR and gives you a `pr-<number>.scrabbler.pages.dev` preview URL.

---

## License

All rights reserved. See [`PROJECT.md`](./PROJECT.md) for the project principles and the data-source licensing summary above. No part of the codebase or its curated vocabulary may be redistributed without explicit permission from the project owner.

---

<sub>v1.0.0 · built with Vite, React, TypeScript, Cloudflare Pages, D1, and a studied CSW24 lexicon · deployed automatically on push to <code>main</code>.</sub>
