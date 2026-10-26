# Good Dog Companion

A private, mobile-first practice companion for **Good Dog Behavior Consultants** (NYC): clients and households, dog profiles, the Master Behavioral Assessment, training plans, session notes, progress, scheduling, follow-ups and client-ready reports.

> All records in this repository and in the preview are **fictional**. No real client data has ever been used.

```diagram
Client ──▶ Dog ──▶ Assessment ──▶ Training plan ──▶ Session ──▶ Progress ──▶ Follow-up
   │         │          │               │              │           │            │
household  profile,   template      goals, success   structured  dated       reminders,
members    safety     versions,     criteria,        or quick    observations appointments
           notes,     revisions     milestones       notes       (no %)
           timeline
```

## What's here

| Area | Where it lives |
|---|---|
| Five-destination app shell (Home, Dogs, Clients, Sessions, Schedule) with global search (⌘K) and quick add | `src/components/AppShell.tsx` |
| Dog profile: portrait, “Know before you meet” safety band, goals, timeline, assessments, plans, files | `src/pages/DogProfile.tsx` |
| Intake (client + household + dog in one step), inquiries, client profile, relationships with history | `src/pages/ClientForm.tsx`, `ClientProfile.tsx`, `DogForm.tsx` |
| **Master Behavioral Assessment**: 8 sections, 7 conditional modules, 127 questions; conditional logic, autosave (local + Firestore), section progress, required/optional, not assessed / N/A, reported vs observed, private answers, initial and follow-up modes with “last time” answers, completion snapshots and revision history | `src/assessment/*`, `src/pages/Assessment.tsx`, [docs/ASSESSMENT_TEMPLATE.md](docs/ASSESSMENT_TEMPLATE.md) |
| Template editor (no code): sections, modules, questions, types, options, conditions, publish as new version | `src/pages/TemplateEditor.tsx` |
| Sessions: four structured types plus quick free-form notes, goal observations, follow-up reminder | `src/pages/SessionForm.tsx` |
| Training plans: prioritized goals, observable success criteria, exercises, homework, milestones, dated progress notes | `src/pages/Plan.tsx` |
| Schedule: appointments, follow-ups (overdue / this week / later), link to the existing public booking page | `src/pages/Schedule.tsx` |
| Reports: editable consultation, plan and assessment summaries; private/safety sections excluded until chosen; print, PDF, copy | `src/lib/reports.ts`, `src/pages/Report.tsx` |
| Exports: CSV per record type, complete JSON backup | `src/lib/exports.ts`, `src/pages/Settings.tsx` |
| Security rules, audit trail function | `firestore.rules`, `storage.rules`, `functions/index.js` |
| Fictional demo practice (16 clients, 16 dogs, 14 households) | `src/demo/demoData.ts`, seeded by `scripts/seed.mjs` |
| Backend-free demo build for sharing (data stays in the visitor's browser), deployed to Cloudflare | `src/demo/`, `wrangler.jsonc` |

## Run it

```sh
npm install && (cd functions && npm install)
npm run emulators   # Firebase Emulator Suite; seeds demo data when empty
npm run dev         # http://localhost:5173 — haley@gooddog.demo / GoodDog!2026
```

**Shareable demo** (no Firebase needed): `npm run build:demo` produces a static site in `dist/` in which the fictional practice lives in each visitor's browser. See *Public demo on Cloudflare* in [docs/SETUP.md](docs/SETUP.md).

Full setup, tests and production deployment: [docs/SETUP.md](docs/SETUP.md). Data model: [docs/SCHEMA.md](docs/SCHEMA.md). Backups: [docs/DATA_RECOVERY.md](docs/DATA_RECOVERY.md). Build notes: [docs/IMPLEMENTATION_LOG.md](docs/IMPLEMENTATION_LOG.md).

## Stack

React 19, TypeScript, Vite, Tailwind CSS 4, React Router, React Hook Form + Zod, Zustand, Firebase (Auth, Firestore with offline cache, Storage, Cloud Functions v2), installable PWA, Vitest, Playwright. A packed copy of `@mwilliams/ui` (`vendor/`) supplies accessible primitives only (dialog/drawer, tabs, toggle groups, skip link); the visual design is bespoke to Good Dog.

## Security model

- Deny by default. Only accounts listed and `active` in `authorizedUsers/{uid}` can read or write any record; that collection is writable only with the Admin SDK (`scripts/grant-access.mjs`). There is no sign-up screen.
- Every write is validated server-side: field types and sizes, enums, and actor metadata (`createdBy`/`updatedBy` must be the caller, timestamps must be server time).
- History is preserved: core records cannot be deleted, template versions and assessment revisions are immutable, relationships are ended rather than rewired.
- Cloud Function `auditTrail` writes an `auditEvents` row (collection, id, action, actor, changed field names, never values) for every change.
- Files: `dogs/{dogId}/…` only, images or PDF, under 15 MB, authorized users only (rules check Firestore).
- No analytics or third-party scripts. Fonts are self-hosted. Signing out clears the offline cache on that device. Nothing is emailed automatically.
