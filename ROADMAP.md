# Roadmap

## Phase 0: Handoff
- [x] Product concept
- [x] MVP definition
- [x] Source structure
- [x] Codex handoff

## Phase 1: Local MVP
- [x] Vite/React/TypeScript shell
- [x] Word lookup
- [x] 2-letter drill
- [x] Q/J/X/Z drill
- [x] Bingo drill
- [x] Dump drill
- [x] Local performance store
- [x] Basic tests

### Phase 1 implementation note

The local MVP is now runnable with `npm run dev`. The complete printed vocabulary from the supplied PDF is now imported into generated JSON (2,928 source entries plus 394 bingo answers), with category provenance preserved. It still does not claim to be a universal dictionary beyond this source document.

## Phase 2: Training engine
- [x] Adaptive difficulty
- [x] Spaced repetition
- [x] Response-latency scoring
- [x] Weak-word dashboard
- [x] Mixed drills
- [x] Rack/anagram generation

Phase 2 note: attempts now derive mastery (`UNKNOWN` through `AUTOMATIC`), speed, accuracy, and due-review timing locally. Adaptive Mix prioritizes weak, slow, and due words; Progress exposes the adaptive queue.

The current drill implementation includes timed animated recall cards and a 2-minute, PDF-validated 8-tile rack challenge with standard tile scoring.

## Phase 3: Scrabble intelligence
- [x] Hooks
- [x] Extensions
- [x] Bingo families
- [x] Rack signature indexing
- [x] Tile-distribution-aware racks
- [x] Leave/dump analysis

Phase 3 note: Rack Lab now exposes source-valid rack plays, standard scores, leaves, dump options, anagrams, hooks, extensions, and bingo-family matches. Random racks are drawn from a standard English tile distribution.

## Phase 4: Tournament simulation
- [x] Game clock
- [x] Realistic racks
- [x] Board positions
- [x] Scoring
- [x] Play selection
- [x] Challenge decisions
- [x] Post-game analysis
- [x] Full board placement legality and cross-word validation
- [x] Premium squares, bingo bonuses, and blank-tile scoring
- [x] Opponent turns, tile-bag refills, passes, and exchanges
- [x] Rack-out and end-game score adjustments

Phase 4 milestone note: Tournament Lab now provides a timed local practice table with center-opening rules, connected placements, cross-word validation, standard premium squares, blank tiles, bingo bonuses, a real tile bag, automated opponent turns, pass/exchange actions, end-game adjustments, challenge-decision logging, and post-game analysis.

### Phase 4 follow-up: Tournament usability and rules hardening
- [x] Fit the board, rack, timer, and turn controls into iPad/laptop desktop viewports
- [x] Add configurable 10-, 25-, and 50-minute tournament clocks
- [x] Keep the pre-start rack empty until a game is started
- [x] Separate human/opponent tile palettes while preserving standard premium colors
- [x] Correct double/triple-letter scoring and add multi-word scoring coverage
- [x] Add a dictionary-source selector scaffold for the focused PDF source and full CSW24
- [ ] Import and enable the supplied complete CSW24 dictionary
- [ ] Tune the compact mobile tournament layout after desktop/iPad sign-off

Phase 4 follow-up note: A move that creates a main word plus cross-words scores each formed word separately. A newly placed connecting tile therefore contributes once to each word it belongs to; existing tiles and their premiums are not reactivated.

## Phase 5: Deployment
- [x] Cloudflare Pages configuration and deployment runbook
- [x] GitHub Actions deployment workflow and Pages project
- [x] Public deployment/preview URL
- [x] Production URL
- [x] Google-synchronized profile implementation
- [ ] Configure Google OAuth client credentials

Phase 5 note: The static Vite build is configured for Cloudflare Pages through
`wrangler.jsonc`. The `scrabbler` Pages project exists, and GitHub Actions now
builds/tests every deployment and publishes production from `main` plus
repository pull-request previews. `CLOUDFLARE_ACCOUNT_ID` is set in GitHub;
`CLOUDFLARE_API_TOKEN` is stored as an encrypted GitHub secret. The verified
production URL is `https://scrabbler.pages.dev`; the current deployment-specific
public URL is recorded in `docs/DEPLOYMENT.md`. Attempts remain local in the
browser for anonymous users, while optional Google profiles use the isolated
Scrabbler D1 database. Google OAuth client credentials still need to be entered
in the Pages project using the setup in `docs/AUTH_SETUP.md`. A custom domain is
intentionally deferred as a future hosting option.

## Phase 6: Meaning enrichment
- [ ] Add verified one-line meanings from public/open sources

## Phase 7: Network play and broadcast
- [ ] Multiplayer rooms for up to four remote/LAN players
- [ ] Authoritative shared game state and reconnection handling
- [ ] Fixed spectator/broadcast view without pointer or UI-motion noise
- [ ] Admin-controlled stream start, live status, and shutdown
- [ ] TV casting and browser-based live-view delivery
