# Scrabbler — Codex Handover

Updated: 2026-08-17

## Continue from here

Scrabbler is a Cloudflare Pages app at `https://scrabbler.pages.dev`. The repository is `meta4m/scrabbler`. Continue development from the current working tree; do not ask the user to reconstruct the prior conversation.

## Product decisions

- Google OAuth only; GitHub OAuth is not wanted.
- Anonymous/local use must continue working.
- Authentication must remain 100% free.
- Cloudflare resources must remain dedicated to Scrabbler and must not be shared with other apps.
- Deploy through GitHub Actions, not direct Cloudflare uploads.
- Custom domain is deferred.
- Word meanings are deferred to Phase 6; retain a TODO to find public sources.

## Implemented product features

- All source words imported.
- Flash-card drill with card flip, recall input, correct/incorrect feedback, sequence/random modes, and no automatic start on entering the drills page.
- Mobile-friendly recall input with caps behavior.
- Bingo/rack challenges with answer validation and standard Scrabble scoring.
- All-letter sprint challenge, including 2-letter, power-letter, and all-letter options; random and progressive modes.
- Progressive mode moves from shorter to longer words after a two-word correct streak.
- Local development supports LAN access.

## Auth/profile sync implementation

Committed and pushed:

- `712e80b` — Google OAuth/profile sync.
- `5c09207` — removes automatic D1 migration from the deployment workflow; migrations remain explicit.

Relevant files include:

- `functions/api/auth/google.ts`
- `functions/api/auth/google/callback.ts`
- `functions/api/auth/logout.ts`
- `functions/api/me.ts`
- `functions/api/sync/attempts.ts`
- `functions/lib/auth.ts`
- `src/lib/auth.ts`
- `migrations/0001_profile_sync.sql`
- `.github/workflows/deploy-pages.yml`

Security design: PKCE OAuth, signed short-lived OAuth state cookie, Secure/HttpOnly session cookie, hashed server-side sessions, user-scoped D1 attempts, and merge of local attempts into the signed-in account by attempt ID.

## Cloudflare state

- Pages project: `scrabbler`
- Production URL: `https://scrabbler.pages.dev`
- Dedicated D1 database: `scrabbler-profile-db`
- D1 ID: `4738a8f6-b260-45c8-b196-3d584bad749a`
- Remote migration has been applied.
- D1 tables: `users`, `sessions`, `attempts`
- Production Pages secret `SESSION_SECRET` exists.
- GitHub secret `CLOUDFLARE_ACCOUNT_ID` exists.
- GitHub secret `CLOUDFLARE_API_TOKEN` exists; its value is never read back.

## Current blocker

The durable Cloudflare API token has now been created with Pages Write scoped to
the Scrabbler account and stored as the GitHub `CLOUDFLARE_API_TOKEN` secret.
The next deployment should therefore be triggered and inspected. Google OAuth
client credentials are still not configured in the production Pages project,
so end-to-end sign-in cannot be completed until those credentials are supplied.

Wrangler investigation established that:

- `wrangler auth token --json` returns a Wrangler OAuth token, not a durable API token.
- `wrangler auth create` creates OAuth profiles, not API tokens.
- Calling Cloudflare `/user/tokens` with the current OAuth session returned HTTP 403 (`9109 Unauthorized`).
- No Cloudflare MCP tool was available in the prior session.

### Agent/session source of truth: access and token findings (2026-08-17)

Keep this section as the first checkpoint for future sessions. It records what was
verified so agents do not spend time rediscovering the credential layout.

#### Credential map

- GitHub CLI access works directly with `gh`; `gh repo view meta4m/scrabbler`
  reports `viewerPermission: ADMIN`. The repository's stored `meta4m` credential
  is usable for repository operations. `gh auth status` also sees an invalid
  injected `GITHUB_TOKEN`, but normal `gh` commands successfully use the stored
  credential; do not replace or revoke it based only on that status warning.
- The GitHub Actions workflow does not use a GitHub PAT for deployment. It uses
  the repository secrets `CLOUDFLARE_ACCOUNT_ID` and
  `CLOUDFLARE_API_TOKEN` in `.github/workflows/deploy-pages.yml`.
- As of 2026-08-17, GitHub has both `CLOUDFLARE_ACCOUNT_ID` and
  `CLOUDFLARE_API_TOKEN`. The API-token secret's presence was verified by name
  only; its value must never be read back or written to the repository.
- Wrangler 4.115.0 is installed. `wrangler whoami` reports the Cloudflare
  account `Irfan` (`0649c741a1ecb087ea2d37002e0517d5`) and a Wrangler OAuth
  session for `iullah@gmail.com`.
- Cloudflare MCP servers are globally registered in Codex. The primary
  `cloudflare` server is OAuth-authenticated; bindings, builds, and
  observability authenticate on first use; `cloudflare-docs` is public. After
  an agent restart, the primary MCP exposes documentation search, OpenAPI
  search, and authenticated Cloudflare API execution.

#### Durable Cloudflare token investigation

Cloudflare's current documentation says account-owned API tokens are the
durable service-principal mechanism intended for CI/CD, support Pages, and are
created under **Manage Account → Account API Tokens**. Creation requires
Cloudflare **Super Administrator** permission. A token can be given the
account-scoped **Pages Write** permission and optionally an expiration; for this
project it should be restricted to the Scrabbler account and used only by the
GitHub Actions deployment.

Official references checked:

- https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/
- https://developers.cloudflare.com/fundamentals/api/how-to/create-via-api/
- https://developers.cloudflare.com/fundamentals/api/reference/permissions/
- https://developers.cloudflare.com/fundamentals/api/get-started/create-token/

The current Wrangler OAuth session cannot create or list API tokens:

- Its reported scopes include `pages (write)`, but only `account (read)` and
  `user (read)`; it has no API-token write scope.
- `wrangler auth token --json` yields the short-lived Wrangler OAuth credential,
  not a durable API token.
- Calling `GET https://api.cloudflare.com/client/v4/user/tokens` with that
  credential returned HTTP 403, Cloudflare error `9109 Unauthorized`.
- Do not put the Wrangler OAuth credential in `CLOUDFLARE_API_TOKEN`.

After the agent restart, the authenticated Cloudflare MCP was also tested
against `GET /accounts/0649c741a1ecb087ea2d37002e0517d5/tokens` (the official
Account Owned API Token list endpoint). It returned Cloudflare error `9109
Unauthorized`; therefore this MCP OAuth identity cannot list or create account
owned tokens either. The MCP can search the current Cloudflare OpenAPI and
documentation, but it cannot elevate its own permissions.

The account-owned token was created in Cloudflare with Pages Write scoped to the
Scrabbler account and set as the GitHub secret without echoing the value:

```bash
gh secret set CLOUDFLARE_API_TOKEN --repo meta4m/scrabbler
```

Verify only the secret name, trigger the workflow, and inspect its result.
Never print, commit, or paste the token into chat.

Uncommitted documentation changes from the prior session:

- `docs/AUTH_SETUP.md`
- `docs/DEPLOYMENT.md`
- `docs/CODEX_HANDOVER.md`

## Recommended next actions

1. Inspect `git status`, read the project docs, and review the two pending documentation files.
2. Commit and push the pending documentation changes.
3. Trigger the GitHub Actions deployment and verify its result:

   ```bash
   gh workflow run "Build and deploy Scrabbler" --repo meta4m/scrabbler --ref main
   ```

4. Create Google OAuth web credentials and register:

   `https://scrabbler.pages.dev/api/auth/google/callback`

5. Store Google credentials as production Pages secrets:

   ```bash
   wrangler pages secret put GOOGLE_CLIENT_ID --project-name scrabbler
   wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name scrabbler
   ```

6. Verify deployment, Google sign-in/callback, `/api/me`, and cross-browser/device attempt synchronization.

## Validation already completed

- 8 tests passing.
- `npm run build` passed.
- `npx tsc -p functions/tsconfig.json --noEmit` passed.
- Wrangler Pages dev compiled Functions and recognized the D1 binding.
- A local Wrangler startup also encountered `uv_interface_addresses returned Unknown system error 1`; this appeared to be an environment/network-interface issue.

## Ready-to-paste prompt for the next session

> Read `PROJECT.md`, `PRODUCT_SPEC.md`, `ROADMAP.md`, `docs/CODEX_START.md`, and `docs/CODEX_HANDOVER.md`. Continue Scrabbler development from the documented state without asking me to reconstruct prior context. First inspect the working tree and confirm the current deployment/auth blocker. Keep Google OAuth only, anonymous local use, free/dedicated Cloudflare resources, GitHub Actions deployment, deferred custom domain, and deferred word meanings. Resolve the durable Cloudflare API-token/GitHub-secret deployment issue if possible, then deploy and end-to-end test Google login and profile attempt sync. Preserve unrelated user changes and report exactly what was done.
