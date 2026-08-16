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

Phase 4 milestone note: Tournament Lab now provides a timed local practice table with a generated board anchor, tile-bag rack, PDF/rack-valid play checking, tile scoring, challenge-decision logging, and a post-game turn summary. Full board-legality search, premium squares, opponent turns, and complete scoring rules remain a deeper simulation pass.

## Phase 5: Deployment
- [x] Cloudflare Pages configuration and deployment runbook
- [x] GitHub Actions deployment workflow and Pages project
- [x] Public deployment/preview URL
- [x] Production URL
- [ ] Optional custom domain
- [ ] Optional synchronized player profile

Phase 5 note: The static Vite build is configured for Cloudflare Pages through
`wrangler.jsonc`. The `scrabbler` Pages project exists, and GitHub Actions now
builds/tests every deployment and publishes production from `main` plus
repository pull-request previews. `CLOUDFLARE_ACCOUNT_ID` is set in GitHub;
`CLOUDFLARE_API_TOKEN` is stored as an encrypted GitHub secret. The verified
production URL is `https://scrabbler.pages.dev`; the current deployment-specific
public URL is recorded in `docs/DEPLOYMENT.md`. Attempts remain local in the
browser; synchronized profiles require an explicit identity and storage design
before implementation.

## Phase 6: Meaning enrichment
- [ ] Add verified one-line meanings from public/open sources
