# Scrabbler

## Project handoff
Scrabbler is a mobile-first Scrabble vocabulary and tournament-training application. The goal is not merely dictionary lookup. The core product is a training engine for rapid lexical recognition, anagram/bingo retrieval, power-letter knowledge, dump-word recognition, and eventually board/game decision-making.

## Repository
GitHub: https://github.com/meta4m/scrabbler

The ChatGPT GitHub connector currently reads the repository but writes return HTTP 403. This handoff is intended to be copied into the local clone so Codex can continue.

## Source
Initial vocabulary source: the user's `Word Study.pdf`. It contains 2-letter words, 3-letter words, J/Q/X/Z words, bingo stems and high-probability bingos, I/U dumps, vowel dumps, and other Scrabble study material. Preserve source organization where useful.

## Product principles
1. Training first, lookup second.
2. Track response time as well as correctness.
3. Train word families and letter structures, not isolated spellings only.
4. Adaptive repetition should focus on weak/slow recall.
5. Mobile-first and keyboard-friendly.
6. Dependency-light initially.
7. Do not build the full tournament simulator before the vocabulary loop is useful.
8. Separate source vocabulary from player-performance data.

## Planned modules
- Lookup
- Rapid Recognition
- Bingo Trainer
- 2-letter Trainer
- J/Q/X/Z Trainer
- Dump Trainer: I, U, vowel dumps
- Adaptive Training
- Tournament Lab (with deeper board simulation still future)

## Suggested mastery
UNKNOWN -> RECOGNIZED -> RECALLABLE -> FAST -> AUTOMATIC

## Proposed word model
spelling, length, letter_signature, alphabetized_signature, tile_score, source_section, hooks, anagrams, extensions, bingo_stems, power_letter flags, dump category, player statistics.

Alphabetized signatures are useful for anagram/rack lookup. Example: TISANE -> AEINST.

## MVP
Build a functional web app with word lookup, bingo-stem drill, Q/J/X/Z drill, dump-word drill, local performance tracking, mobile-first UI, and local persistence.

## Deployment
The app is deployed to Cloudflare Pages at `https://scrabbler.pages.dev`.
Production deploys run through GitHub Actions using the dedicated Scrabbler
Cloudflare account and D1 database. Anonymous practice remains local; optional
Google profile sync is implemented but needs production OAuth client secrets.

## Next task for Codex
1. Read this handoff and the other project docs before changing anything.
2. Preserve the working training, rack, tournament, and auth-sync features.
3. Configure Google OAuth production secrets when credentials are available.
4. Verify sign-in, `/api/me`, and cross-device attempt synchronization.
5. Keep tests, production builds, and the GitHub Actions deployment green.
6. Research verified public sources before starting Phase 6 meanings.

## Do not assume
Do not assume every PDF word is a complete authoritative Scrabble dictionary. Do not silently substitute another word list. Do not invent validity/definitions unsupported by the source unless external verification is explicitly requested.
