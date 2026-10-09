# Student Portal: login explained

A small student quiz with real Supabase Auth, server-calculated scores, private results, and a local Swagger UI explorer. Alice and Bob sign in separately. A valid Alice token can access Alice's result; it cannot access Bob's.

## Run

Install Node.js 20 or newer, then:

```sh
git clone https://github.com/RandRise/supabase-login-explained.git
cd supabase-login-explained/login-demo
npm start
```

Open http://127.0.0.1:8772. Swagger is at http://127.0.0.1:8772/swagger. No npm install is required. The current Windows preview uses port 8773.

The prepared shareable ZIP includes public connection settings. For a GitHub clone, use **Connection → Import settings** with the public settings exported from the original laptop, or enter the project URL and publishable key. Each laptop signs in separately.

- [Mac setup](login-demo/MAC-SETUP.txt)
- [First setup](login-demo/START-HERE.txt)
- [Presentation sequence](login-demo/PRESENTATION.txt)
- [Swagger walkthrough](login-demo/SWAGGER.txt)
- [Task coverage](login-demo/TASK-COVERAGE.txt)
- [Actual validation results](login-demo/VALIDATION.txt)

## What to show

1. As a guest, read the public questions. Click View my result: the real API returns 401.
2. Sign in as Alice, answer the quiz, submit, and see the server-calculated score.
3. Reload: the saved session is reused without asking for the password.
4. In Swagger, use Alice's session and read her result. Remove the bearer and repeat: 401.
5. Sign in as Bob and submit a different result. Alice asking for Bob's result gets 403.
6. Keep a copied Alice bearer in the Swagger tab, sign out of the portal, then repeat a request. An unexpired bearer can still act as Alice.
7. Inspect the saved session in DevTools and decode claims locally. Decoding is not signature verification.

## Code layout

The current exercise lives in `login-demo/student/`.

- `app.js`: startup and event wiring.
- `js/constants.js`: storage keys, endpoint paths and request timeout.
- `js/state.js`: project-scoped session storage and app state.
- `js/api.js`: HTTP requests to Supabase.
- `js/auth.js`: sign in and sign out.
- `js/quiz.js`: load questions, submit answers, fetch results.
- `js/ui.js`: DOM rendering and response display.
- `js/settings.js`: public configuration import/export.
- `js/openapi.js`: OpenAPI 3 definition for the real endpoints.
- `swagger.js`: Swagger initialization and bearer controls.
- `base.css`: responsive portal styles; `swagger.css`: API explorer styles.
- `vendor/`: pinned Swagger UI 5.33.1 distribution and licenses.

`add-student-quiz.sql` adds two tables with RLS and three SECURITY INVOKER functions. The score is a PostgreSQL generated column. The API accepts answers, not a caller-selected score or owner.

The Node server serves files only. Login, token verification, scoring and authorization happen at Supabase. Existing messaging remains at `/messaging`; the complete earlier report exercise remains in `legacy-report/`. Historical Postman files apply to the messaging exercise, not the student quiz.

## Scope

This is a teaching quiz with invented users, not a secure examination platform. The answer key is visible in the public SQL source. Students can make repeated submissions; their latest score is shown. The exercise demonstrates who may read or write which rows, not anti-cheating controls.

The page stores the token pair in localStorage for inspection, but never saves the password. It restores the session on reload and requires signing in again after access-token expiry; automatic refresh is intentionally not implemented. Swagger keeps a separate token copy in memory, with persistent authorization disabled.

Only public URL/key settings belong in a handoff. Passwords, access/refresh tokens and browser-storage dumps must not be committed or included in the ZIP. Google sign-in is covered by a teammate.

## Checks

```sh
cd login-demo
npm test
```

These dependency-free checks do not log in to Supabase. Live-provider, local PostgreSQL, and fixture DOM checks are recorded separately in VALIDATION.txt.
