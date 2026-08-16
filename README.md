# Scrabbler

A Scrabble vocabulary and tournament-training application.

Read [PROJECT.md](./PROJECT.md), then [docs/CODEX_START.md](./docs/CODEX_START.md).

## Local development

```bash
npm install
npm run dev
```

The current MVP includes source-backed lookup, 2-letter, power-letter, bingo-family, and dump-word drills, plus local attempt history. Run `npm test` for logic tests and `npm run build` for a production check.

## Cloudflare Pages

Cloudflare Pages deployment is configured in [`wrangler.jsonc`](./wrangler.jsonc)
and automated by [`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml).
See [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) for GitHub secrets, preview,
production, and custom-domain setup.

Optional Google sign-in and synchronized progress are documented in
[`docs/AUTH_SETUP.md`](./docs/AUTH_SETUP.md).
