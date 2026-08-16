# Google sign-in and synchronized progress

Scrabbler supports anonymous local practice and optional Google sign-in. Once
signed in, attempts are merged with the dedicated `scrabbler-profile-db` D1
database and remain available on another device.

## Google OAuth setup

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project dedicated to Scrabbler.
3. Configure the OAuth consent screen as an external app. Request only the
   `openid`, `email`, and `profile` scopes.
   During testing, add the intended Google accounts as test users; complete
   Google’s publishing/verification steps if the app is opened to the public.
4. Create an **OAuth client ID** for a web application.
5. Add this exact authorized redirect URI:

   ```text
   https://scrabbler.pages.dev/api/auth/google/callback
   ```

6. Store the client ID and client secret in the Scrabbler Pages project. Run
   these commands from an authenticated Wrangler session; they do not put
   credentials in Git or the GitHub workflow:

   ```bash
   wrangler pages secret put GOOGLE_CLIENT_ID --project-name scrabbler
   wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name scrabbler
   ```

   Each command prompts for the value without echoing it.

The session secret and isolated D1 binding are already configured for the
Scrabbler Pages project. The application uses PKCE, signed short-lived OAuth
state, secure HttpOnly session cookies, and server-side D1 sessions. Google
tokens are not stored in the browser or database.

The initial D1 migration is already applied. If a future schema migration is
added, apply it explicitly with a Cloudflare credential that has D1 edit access:

```bash
wrangler d1 migrations apply scrabbler-profile-db --remote
```

The GitHub Pages deployment workflow does not run database migrations
automatically, so an application deployment cannot accidentally change the
production schema.

## Local development

Copy `.dev.vars.example` to `.dev.vars`, replace the placeholders, and run the
Pages development server with the local build. `.dev.vars` is ignored by Git.

## Data model

Google identifies the account; Scrabbler stores only the Google subject, basic
profile fields, sessions, and the user’s training attempts. Anonymous users
continue using browser storage and are never silently uploaded. On sign-in,
local and remote attempts are merged by attempt ID and capped at the existing
500-attempt history size.
