# Setup and deployment

## Local development (no Firebase account needed)

Requirements: Node 22+, Java 21+ (for the Firestore emulator), and the Firebase CLI (`npm i -g firebase-tools`).

```sh
npm install
(cd functions && npm install)
npm run emulators      # Auth, Firestore, Storage, Functions; seeds the demo practice if empty
npm run dev            # http://localhost:5173
```

Sign in with the fictional demo account: `haley@gooddog.demo` / `GoodDog!2026`.
`intruder@example.demo` / `NotAllowed!2026` is a signed-in account **without** access, for checking that private data stays private.

The dev server proxies emulator traffic on the same origin (see `vite.config.ts`), so the app also works behind an HTTPS preview proxy. `npm run seed -- --reset` wipes the emulator and reseeds.

## Tests

```sh
npm run typecheck
npm test               # unit tests: assessment logic, reports, CSV, search
npm run test:rules     # Firestore + Storage security rules on separate emulator ports
npm run test:e2e       # Playwright, desktop + phone; needs `npm run emulators` running.
                       # Resets and reseeds the emulator first.
```

## Public demo on Cloudflare (no backend)

`npm run build:demo` builds the app with the Firebase SDK replaced by in-browser stand-ins (`src/demo/firebase/`, wired up by the `demo` mode alias in `vite.config.ts`). Each visitor gets their own copy of the fictional practice in localStorage, with uploads in IndexedDB; nothing is sent to a server. The sign-in form is prefilled with the demo account, and Settings → *Start over with fresh demo data* restores the original records, dated from today.

Cloudflare deploys it from GitHub (Workers & Pages → Create → Import a repository):

| Setting | Value |
|---|---|
| Build command | `npm run build:demo` |
| Deploy command | `npx wrangler deploy` (uses `wrangler.jsonc`: static assets from `dist/`, SPA routing) |
| Node version | 22 (from `.node-version`) |

`public/_headers` adds `noindex` and the same security headers as Firebase Hosting. `npm run test:e2e:demo` runs the Playwright suite against the demo build.

The demo is a prototype for feedback only: never enter real client details, and expect each browser to keep its own separate data.

## Production deployment (needs Haley's decision and credentials)

Nothing in this repository is deployed. To go live:

1. **Create a Firebase project** owned by the business (Blaze plan is required for Cloud Functions). Enable Authentication → Email/Password, Cloud Firestore (production mode), and Cloud Storage. Choose a US region.
2. **Disable public sign-up**: Authentication → Settings → User actions → uncheck “Enable create (sign-up)”. Create Haley's account in the console.
3. **Configure the web app**: copy `.env.example` to `.env.production.local` and fill in the web app config from Project settings. Keep `VITE_USE_EMULATORS=false`.
4. **Point the CLI at the project**: `firebase use --add` (replace `demo-good-dog` in `.firebaserc`).
5. **Deploy rules, indexes and functions first**:
   ```sh
   firebase deploy --only firestore:rules,firestore:indexes,storage,functions
   ```
6. **Seed the assessment template only** (never the demo records). Run in the browser console is not possible by design; instead run once with a service account:
   ```sh
   GOOGLE_APPLICATION_CREDENTIALS=sa.json node scripts/install-template.mjs --project <id>
   ```
   (`install-template.mjs` writes `assessmentTemplates/master` and `assessmentTemplateVersions/master_v1` from `src/assessment/masterTemplate.ts`.)
7. **Authorize Haley**:
   ```sh
   GOOGLE_APPLICATION_CREDENTIALS=sa.json node scripts/grant-access.mjs haley@… --name "Haley Wilson" --project <id>
   ```
8. **Build and deploy hosting**: `npm run build && firebase deploy --only hosting`. Hosting headers in `firebase.json` add `noindex`, `nosniff`, `no-referrer`, and `DENY` framing.
9. **Turn on App Check** (reCAPTCHA Enterprise) for Firestore and Storage once the domain is final, and set a budget alert.

Rotate or revoke access with `scripts/grant-access.mjs <email> --revoke`; this also revokes the account's refresh tokens.
