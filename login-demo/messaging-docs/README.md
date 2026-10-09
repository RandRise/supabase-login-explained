# Private Notes: login explained

A small Alice/Bob messaging app with real Supabase Auth and Postgres row level security. Alice sends Bob a note; Bob signs in to read it and reply. Only the recipient can read a stored message.

## Run

Install Node.js 20 or newer, then:

```sh
git clone https://github.com/RandRise/supabase-login-explained.git
cd supabase-login-explained/login-demo
npm start
```

Open http://127.0.0.1:8772. No npm install is required. The Windows preview currently uses port 8773.

On a fresh clone, import the original laptop's **public connection settings** using Connection settings → Import settings. The shareable ZIP includes those public settings and connects automatically. Each laptop signs in separately.

See [Mac setup](login-demo/MAC-SETUP.txt), [first setup](login-demo/START-HERE.txt), [presentation flow](login-demo/PRESENTATION.txt), and [built-in API playground](login-demo/API-PLAYGROUND.txt).

## What to show

1. Alice signs in and sends a note to Bob.
2. Sign out. Bob signs in, reads it and uses Reply.
3. Sign out. Alice signs in and receives Bob's reply.
4. In API playground: no token → 401; Bob token → Bob inbox; Alice token → Alice inbox.
5. Read Bob's known existing messages directly with Alice's token → 200 and an empty array. Try forging Bob's sender identity → 403.
6. In browser DevTools, find the saved session and decode only the JWT claims. Reload the page to demonstrate session restoration.
7. Explain that a copied bearer token can read/send as its owner without the password. Google sign-in is covered by a teammate. No separate API testing app is required.

[Task coverage](login-demo/TASK-COVERAGE.txt) separates what we observe from what we explain. [Validation](login-demo/VALIDATION.txt) records actual live-provider checks separately from fixture tests.

## Layout

- `app.js`: startup and event wiring.
- `js/constants.js`: storage keys, API paths and limits.
- `js/api.js`: HTTP client shared by the page and live checks.
- `js/auth.js`: login/logout and local session storage.
- `js/messaging.js`: fetch inbox, load contacts and send notes.
- `js/playground.js`: in-page API client with masked token input and real responses.
- `js/playground-request.js`: pure request builder, redacted preview and response descriptions.
- `js/ui.js`: safe text rendering and page controls.
- `js/settings.js`: public connection import/export.
- `js/state.js`: browser state and project-scoped restoration.
- `core.mjs`: pure JWT/config helpers and earlier report verification helpers.
- `server.mjs` / `server-config.mjs`: explicit static files only.
- `add-messaging.sql`: additive contacts/messages schema, grants, RLS and invoker RPCs.
- `postman-collection.json` / `postman-environment.template.json`: requests with empty credential variables.

The earlier report SQL and source files remain for reference; the new page does not import their controls. The complete earlier report demo is preserved in `login-demo/legacy-report/`. Other course exercises remain untouched.

## Scope

This is a test app, not an end-to-end encrypted messenger. Supabase stores the messages; project administrators can access them. A verified token determines whose inbox is queried. There is no caller-selected inbox owner and no outbox. The inbox returns the latest 100 notes.

The page stores its token pair in localStorage and clears the password field after login. This makes storage easy to demonstrate; it is not a recommendation for every production app. It restores sessions on reload and requires signing in again when the access token expires. The historical external Postman collection is optional; the presentation uses the built-in client.

Only public URL/key settings are shareable. Passwords, JWTs, refresh tokens and browser-storage dumps never belong in the repository or ZIP.

## Checks

```sh
cd login-demo
npm test
```

Node checks exercise the static server, JWT decoder and configuration safety. They do not prove live-provider authorization. Live Supabase, local PostgreSQL and fixture DOM results are reported separately in VALIDATION.txt.
