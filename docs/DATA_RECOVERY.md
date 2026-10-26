# Data export and recovery

## What Haley can export from the app

Settings → Export:

- **Complete backup (JSON)**: every collection, including consultant-only notes, safety notes, assessment revision history and the audit trail. Timestamps are ISO strings. Photos and PDFs are listed by `storagePath`; the files themselves stay in Firebase Storage.
- **CSV** for clients, dogs, sessions, appointments, follow-ups and goals, for spreadsheets. Consultant-only notes and safety notes are left out unless “Include consultant-only notes” is ticked. Cells are escaped so spreadsheet formulas cannot run.

Treat the JSON backup like a paper file cabinet key: store it in an encrypted location, not email.

## Recommended production safeguards

1. **Point-in-time recovery**: enable Firestore PITR (7-day window) in the Google Cloud console.
2. **Scheduled exports**: a weekly managed export to a locked Cloud Storage bucket:
   ```sh
   gcloud firestore export gs://<backup-bucket>/$(date +%F) --project <id>
   ```
   Give the bucket a retention policy and restrict it to the owner account.
3. **Storage**: enable Object Versioning on the default bucket so deleted photos and PDFs can be restored.

## Restoring

- **From a managed export** (whole database or selected collections):
  ```sh
  gcloud firestore import gs://<backup-bucket>/<date> --project <id>
  ```
- **From the in-app JSON backup**: each document in `collections.<name>` has its original `id`; write them back with the Admin SDK (`set(doc(name, id), data)`), converting the ISO `createdAt`/`updatedAt` strings to Timestamps. `assessmentRevisions` go back under `assessments/{assessmentId}/revisions/{id}`. Restore into a fresh project first and spot-check before touching production.
- **One record edited by mistake**: assessments keep revision snapshots (open the assessment → Version); the `auditEvents` collection shows which fields changed, when, and by whom.

## Local emulator data

The preview runs on the Firebase emulators. If the emulator starts empty it reseeds the fictional practice, so preview edits are not permanent. `npm run seed -- --reset` restores the demo data on demand.
