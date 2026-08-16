# Codex starting instructions

You are continuing the Scrabbler project.

Read first:
- PROJECT.md
- PRODUCT_SPEC.md
- ROADMAP.md

Then inspect the existing repository before changing anything.

Scrabbler is a Scrabble vocabulary/training app based initially on the user's Word Study.pdf. The goal is active recall and tournament preparation, not just dictionary lookup.

Continue the existing Vite + React + TypeScript implementation incrementally.

Before coding:
- inspect existing files
- identify existing implementation
- preserve useful work
- make a short implementation plan

After coding:
- run tests
- run a production build
- report what works and what remains

Cloudflare Pages deployment is already configured. Keep production deploys on
the GitHub Actions workflow and do not upload directly from a local session.
The remaining deployment task is configuring the Google OAuth client secrets;
see `docs/AUTH_SETUP.md` and `docs/CODEX_HANDOVER.md`.
