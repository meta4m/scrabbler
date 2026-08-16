# Cloudflare Pages deployment

Scrabbler is a static Vite app. The checked-in [wrangler.jsonc](../wrangler.jsonc)
points Wrangler at the production build in `dist/`.

## One-time Cloudflare setup

Wrangler 4 is required. It can be installed globally or invoked with `npx`:

```bash
npm install -g wrangler
wrangler login
wrangler pages project create scrabbler --production-branch main
```

If the Pages project already exists, skip the `project create` command. The
Cloudflare account used by Wrangler must have Pages project access.

## GitHub Actions deployment (recommended)

The repository workflow at
`.github/workflows/deploy-pages.yml` runs tests and a production build before
deploying:

- pushes to `main` (and manual workflow runs) deploy the production site;
- pull requests from this repository deploy to a `pr-<number>` Pages branch;
- pull requests from forks still run the build, but do not receive deployment
  credentials.

Add these repository secrets under **GitHub → Settings → Secrets and variables
→ Actions**:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

The API token needs Pages write access for the account. The account ID is the
Cloudflare account containing the `scrabbler` Pages project. The project has
already been created as `scrabbler`; the first successful workflow deployment
will make `https://scrabbler.pages.dev` live.

## Manual preview fallback

Preview deployments use the `preview` branch and return a public `*.pages.dev`
URL:

```bash
npm run deploy:preview
```

## Manual production fallback

The deployment without `--branch` is the production deployment for this Pages
project:

```bash
npm run deploy:production
```

Cloudflare's Pages dashboard provides deployment history, preview aliases, and
the production branch. GitHub Actions logs also show the deployment URL.

## Custom domain

After the first production deployment, add a domain from the Pages project
dashboard under **Custom domains**. The domain must be in the same Cloudflare
account (or its DNS must be delegated to Cloudflare). No application code
change is needed.

## Player data

Attempts currently stay in the browser under `scrabbler.attempts.v1`; no player
account or synchronized profile is enabled. Adding synchronization requires a
chosen identity provider and server-side data store, so it remains an explicit
follow-up rather than silently changing the privacy model of the local app.
