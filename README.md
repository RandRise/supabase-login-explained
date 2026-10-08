# Supabase Login Explained

A small login app for the Mayerfeld Practicum. Sign in, download your own private report, and show what changes when the same request has no token.

## Run on a Mac

Install [Node.js LTS](https://nodejs.org/) first. In Terminal:

```sh
git clone https://github.com/RandRise/supabase-login-explained.git
cd supabase-login-explained/login-demo
npm start
```

Open **http://127.0.0.1:8772** and leave Terminal running. There is no `npm install` step. If macOS asks to install its command-line tools for `git`, accept and rerun the clone command. You can also download the repository ZIP using GitHub's **Code → Download ZIP**, extract it, open Terminal in `login-demo`, and run `node server.mjs`.

Windows: double-click `login-demo/start-demo.cmd`, or run the same Node command.

## Use the same Supabase project on both laptops

On the first laptop, open **Connection settings → Export settings**. Move `reports-connection.public.json` to the Mac. Start the app there, open **Connection settings → Import settings**, and select that file. Then sign in again.

The export contains the project URL and public browser key only. It does not transfer your login, passwords or tokens. You do not need a second Supabase project, database setup, GitHub login, OAuth redirect change or deployment. Both laptops need an internet connection.

If you have not configured Supabase yet, follow [START-HERE.txt](login-demo/START-HERE.txt).

- Fresh project: create two confirmed test accounts and run [setup.sql](login-demo/setup.sql) once.
- Previously configured demo: run [add-report-action.sql](login-demo/add-report-action.sql) once to add the new report action. Leave the existing users, notes and policies in place.

## What to show

1. Sign in as Alice and click **Download my report**. Supabase returns her report; the browser saves a JSON file.
2. Open **Session & access tools** and click **Request report without a token**. It sends the same POST to Supabase, omitting the Authorization header. The function raises an authentication error; PostgREST maps it to HTTP 401 for anonymous access.
3. Inspect the real JWT payload and browser storage. Reload to show session persistence.
4. Capture the token, sign out, then replay it. Show the actual result: a copied access JWT may still work until expiry.
5. Verify Bob's note, then run the tampering and owner-access checks to show the copied token cannot become Bob's identity by editing it.

The normal interface has no speaking notes or step-by-step presentation overlay. Inspection tools stay collapsed until you open them.

## How the protected action works

`POST /rest/v1/rpc/team3_download_private_report` calls a Postgres function with no user-ID argument. Supabase validates the access JWT; `auth.uid()` identifies the caller. The function requires that identity and runs as `SECURITY INVOKER`, so table permissions and row-level security still apply. No secret key or local authentication backend is involved. The local Node server serves static files only.

The anonymous action explicitly fails. By comparison, a direct anonymous SELECT on the notes table returns zero rows under RLS; that is a different behavior and is not labelled as HTTP denial.

## Rehearse and verify

```sh
cd login-demo
npm test
```

See [MAC-SETUP.txt](login-demo/MAC-SETUP.txt), [PRESENTATION.txt](login-demo/PRESENTATION.txt), [SOURCES.txt](login-demo/SOURCES.txt), and [VALIDATION.txt](login-demo/VALIDATION.txt).

Use invented data only. Tokens are visible in localStorage for this lesson, so this is a classroom demo rather than a production session template. Never commit live tokens, secret keys, passwords, or storage dumps. Google sign-in is an explanatory diagram, not a live integration.

Local public configuration can also be loaded from an ignored
`login-demo/connection.local.json` file. It uses the exported settings format
and never includes a password or session. The current presenter's test project
has its schema, confirmed demo users, and sample reports installed.
Do not rerun the fresh SQL setup against an already configured project.

## Code layout

`app.js` is the entry point. It imports named functions, connects them to the
page controls, and initializes the page. Business logic lives in these files:

| File | Responsibility |
| --- | --- |
| `login-demo/js/constants.js` | Storage keys, API paths, filenames, limits and timers |
| `login-demo/js/state.js` | Browser state, storage helpers and session validation |
| `login-demo/js/api.js` | Supabase REST requests and response errors |
| `login-demo/js/auth.js` | Sign in, sign out, refresh and applying a session |
| `login-demo/js/reports.js` | Downloading a report and requesting it without a token |
| `login-demo/js/token-lab.js` | Captured-token replay, Bob's baseline and evidence checks |
| `login-demo/js/settings.js` | Connection settings, import/export and changes from another tab |
| `login-demo/js/ui.js` | DOM rendering, notices, button bindings and request activity |
| `login-demo/core.mjs` | Pure JWT, public-config and evidence helpers |
| `login-demo/server-config.mjs` | Server port, allowed file paths, MIME types and headers |
| `login-demo/server.mjs` | Static-file server startup and request handling |

The browser loads standard JavaScript modules directly. There is no build step
or production dependency installation. `.editorconfig` and `.prettierrc.json`
set the formatting style: two-space indentation and readable line lengths.
Functions are separated by blank lines; HTML and CSS are formatted as well.
Saved sessions and previously exported public settings remain compatible.
