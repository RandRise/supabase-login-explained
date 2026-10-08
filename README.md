# Supabase Login Explained

A login and session demonstration for the Mayerfeld Practicum AI Operations Specialist programme.

## Current project: Behind the login

The [login demo](login-demo/) shows a real Supabase session: password login,
JWT inspection, browser persistence, owner-only private notes, and copied-token
replay. The Google sign-in section is an explanatory diagram.

Supabase handles authentication and data access. The local Node server serves
files only. GitHub stores the source code; Supabase does not require a GitHub
repository or a GitHub deployment integration for this demo.

### Run

Install a supported Node.js LTS version, then:

```sh
cd login-demo
node server.mjs
```

On Windows you can double-click `login-demo/start-demo.cmd` instead.
Open http://127.0.0.1:8772. No npm dependencies are required.

### Connect Supabase

Follow [START-HERE.txt](login-demo/START-HERE.txt). Use a separate test project,
create the two confirmed invented users, then run [setup.sql](login-demo/setup.sql)
once. Configure the app with the project URL and publishable key, then verify
Bob's known note before rehearsing as Alice.

Project configuration lives in browser storage. No real credentials or tokens
are included in the repository. Never commit secret keys, live tokens, database
passwords, or a browser-storage export.

### Present and verify

- [Presentation script](login-demo/PRESENTATION.txt)
- [Sources](login-demo/SOURCES.txt)
- [Validation and outstanding checks](login-demo/VALIDATION.txt)

```sh
cd login-demo
node self-test.mjs
```

The local structural checks do not substitute for a live Supabase rehearsal.
This is a classroom demonstration, not a production authentication template.
