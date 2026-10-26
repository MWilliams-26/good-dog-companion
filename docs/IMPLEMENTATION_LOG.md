# Implementation log

A concise record of how the first build of Good Dog Companion was produced, the decisions behind it, and what is still needed before real client data goes in.

## Phases

1. **Research and direction.** Reviewed gooddogbehaviorconsultants.com for identity, voice and palette (deep olive `#232C08`, moss `#61764F`, sage `#AFBAA6`, cream `#F5EAD7`, Montserrat). Chose a "field notebook" direction: calm olive and cream surfaces, Montserrat for working UI, Fraunces for dog names and titles, generous touch targets, and no stock or generated photography. Dogs without an uploaded photo get a monogram avatar.
2. **Foundation.** Vite + React 19 + TypeScript, Tailwind 4, Firebase 13 modular SDK, React Hook Form + Zod, Zustand, PWA via `vite-plugin-pwa`. `@mwilliams/ui` is used only for engineering primitives (Dialog/Drawer, Tabs, ToggleGroup, SkipLink, `cn`) under a custom `[data-theme='gooddog']` token set; every layout is bespoke.
3. **Security model first.** `firestore.rules` and `storage.rules` deny by default and require an `authorizedUsers/{uid}` record, validate shapes, enforce `createdBy`/`updatedBy` actor fields and timestamps, and keep published template versions, revisions and the audit trail immutable. A single wildcard Cloud Function (`auditTrail`) writes server-side audit entries.
4. **Shell and core records.** Five-destination navigation (Home, Dogs, Clients, Sessions, Schedule) as a rail on desktop/tablet and bottom tabs on phones; ⌘K search, quick-add sheet, toasts. Intake creates client + household + dog together; relationships are ended rather than rewired so history survives. Archive and restore instead of delete.
5. **Master Behavioral Assessment.** 8 core sections, 7 optional modules, 127 questions (see `docs/ASSESSMENT_TEMPLATE.md`). Conditional questions, initial and follow-up modes, Not assessed / N/A, reported vs observed, private answers, "Last time / Still true" in follow-ups, local autosave plus debounced Firestore writes, revision snapshots, reopen with a version selector. A no-code template editor publishes immutable versions.
6. **Work records.** Structured sessions (4 types) and quick notes, goal observations and milestones, follow-up reminders; training plans generated from assessment recommendations; a schedule with upcoming, follow-up and past views.
7. **Reports and data ownership.** Consultation, plan and assessment reports with sensitive sections excluded unless explicitly confirmed; print, PDF, copy text, mark final. CSV exports (private fields opt-in), full JSON backup, audit trail view.
8. **Demo data, tests and docs.** Fictional NYC practice (16 clients, 16 dogs, 14 households). Unit, rules and Playwright suites. README, SETUP, SCHEMA, DATA_RECOVERY and the generated template reference.

## Decisions

- **Emulators instead of a live Firebase project.** No credentials were provided and the brief rules out an unrestricted public deploy, so everything runs on the Firebase Emulator Suite as project `demo-good-dog`. Production steps are in `docs/SETUP.md` and need the business's own Firebase project.
- **"Haley" Wilson.** The website spells the founder's name Haley; the brief said Hailey. The app follows the website.
- **No photography.** No real client imagery was available, and generated dog or client photos would misrepresent the practice, so none were created. Asset sources: Lucide icons (ISC), Montserrat and Fraunces via Fontsource (SIL OFL).
- **No automated client emails or calendar sync.** Booking stays in Acuity (linked from Schedule); the app records sessions and follow-ups but does not message clients.
- **Private by default.** Private answers and sensitive report sections never leave the app unless Haley opts in at export time.

## Test results at handoff

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm test` (Vitest) | 22 passed |
| `npm run test:rules` | 19 passed |
| `npx playwright test` (desktop + phone) | 11 passed |
| `npm run build` | succeeds; main chunk ≈1.35 MB (≈403 KB gzip) |

## Known limitations and production work

- **Not deployed.** Needs a business-owned Firebase project (Blaze plan for Functions), the web config, and Haley's account; see `docs/SETUP.md`.
- **App Check, MFA and email verification** are not enabled yet; turn them on with the real domain.
- **Backups:** enable Firestore point-in-time recovery and scheduled exports in production (`docs/DATA_RECOVERY.md`). The in-app JSON backup is a manual complement, not a replacement.
- **Preview data resets** to the demo seed whenever the emulator service restarts, and the Playwright run reseeds it. Changes made in the preview are not durable.
- **PDF export** uses jsPDF's built-in Helvetica rather than the brand fonts; printing from the browser keeps the brand typography.
- **Bundle size:** a single ~1.35 MB chunk (Firebase, jsPDF, the template). Route-level code splitting would speed up the first load on slow phones.
- **Functions runtime:** deployed functions target Node 22; the local emulator ran on a newer Node and prints a version warning, which is harmless locally.
- **Single practitioner.** Any account in `authorizedUsers` sees the whole practice; per-role permissions and per-record sharing are not built.
