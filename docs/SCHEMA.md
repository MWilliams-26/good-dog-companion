# Data model

Cloud Firestore, top-level collections, one document per record. Records point at each other by ID; nothing is copied between records except the IDs needed for queries (for example `clientIds` on a session so a client's history is one query).

Every practice document carries the same metadata, enforced by `firestore.rules`:

| Field | Rule |
|---|---|
| `createdAt`, `updatedAt` | Server timestamps; must equal `request.time` |
| `createdBy`, `updatedBy` | Must equal the signed-in user's UID; `created*` never change |
| `archived` | Optional soft-delete flag (clients, dogs) |

Dates without a time (`date`, `startDate`, `dueDate`…) are ISO `YYYY-MM-DD` strings so they sort and range-query as text. Appointment `start` is an ISO date-time.

```diagram
┌────────────┐ 1   * ┌─────────┐ *   * ┌──────────────┐ *   1 ┌──────┐
│ households │──────▶│ clients │◀─────▶│  clientDogs  │◀─────▶│ dogs │
└────────────┘       └─────────┘       │ role, start, │       └──┬───┘
       ▲ 1                             │ end (history)│          │ 1
       └───────────────────────────────┴──────────────┘          │
                                                                  ▼ *
 ┌──────────────────────┐ 1  * ┌───────────────────────────┐   ┌───────────────┐
 │ assessmentTemplates  │─────▶│ assessmentTemplateVersions│◀──│  assessments  │──▶ revisions/*
 │ (editable draft)     │      │ (immutable snapshots)     │   │ responses map │   (immutable)
 └──────────────────────┘      └───────────────────────────┘   └───────────────┘
                                                                  │
          ┌──────────────┐ 1  * ┌───────┐ 1  * ┌──────────────────────┐
  dogs ──▶│trainingPlans │─────▶│ goals │─────▶│ progressObservations │◀── consultations
          └──────────────┘      └───────┘      └──────────────────────┘
  dogs ──▶ consultations (dogIds[], clientIds[], planId, goalIds[], appointmentId)
  dogs ──▶ appointments (dogIds[], clientIds[], consultationId)   followUps (dogId, clientId)
  dogs ──▶ reportDrafts (kind, sourceId, sections[])               dogDocuments (storagePath)
```

## Collections

| Collection | Purpose | Key fields |
|---|---|---|
| `authorizedUsers/{uid}` | Who may use the app. **Admin SDK only** (`scripts/grant-access.mjs`). | `email`, `displayName`, `role` (`owner`/`staff`), `active` |
| `households` | A home shared by clients and dogs | `name`, `neighborhood`, `address`, `homeType`, `accessNotes`, `members[]`, `otherAnimals` |
| `clients` | People | `firstName`, `lastName`, contact fields, `preferredContact`, `status` (`inquiry`/`new`/`active`/`returning`/`inactive`), `householdId`, `notes` (shareable), `privateNotes`, `inquiryDate`, `inquirySummary` |
| `dogs` | Dog profiles | `name`, `breed`, `sex`, `birthDate`/`ageNote`, `weightLbs`, `householdId`, `acquisition`, `rescueOrg`, `vetClinic`, `concerns[]` (tags), `safetyNotes[]` (`level`, `text`), `summary`, `status`, `photoPath` |
| `clientDogs` | Client ↔ dog relationship with history | `clientId`, `dogId`, `role` (guardian, co-guardian, caregiver, foster, former guardian), `isPrimary`, `startDate`, `endDate` (null = current). Rules forbid rewiring a relationship; end it and create a new one. |
| `assessmentTemplates` | The editable template Haley customizes | `name`, `sections[]`, `modules[]`, `currentVersion`, `currentVersionId` |
| `assessmentTemplateVersions/{templateId}_v{n}` | Immutable published snapshot. Assessments reference one. | full definition, `templateId`, `version`, `changeNote` |
| `assessments` | One initial or follow-up assessment | `dogId`, `clientIds[]`, `templateVersionId`, `mode`, `status` (`draft`/`complete`), `date`, `enabledModules[]`, `responses{questionId: {status, value, source, note}}`, `privateNotes`, `previousAssessmentId`, `revision` |
| `assessments/{id}/revisions` | Snapshot taken on completion and when reopened. Immutable. | `revision`, `reason`, `responses`, `enabledModules`, `privateNotes` |
| `consultations` | Session notes (structured or free-form) | `dogIds[]`, `clientIds[]`, `type` (`initial`/`followUp`/`virtual`/`checkIn`), `date`, `format`, `observations`, `exercisesPracticed`, `changesSinceLast`, `homework`, `nextSteps`, `privateNotes`, `freeformNotes`, `planId`, `goalIds[]`, `appointmentId` |
| `trainingPlans` | Individualized plan | `dogId`, `title`, `status`, `startDate`, `reviewDate`, `summary`, `management`, `assessmentId` |
| `goals` | Prioritized plan goal | `planId`, `dogId`, `title`, `priority`, `why`, `successCriteria[]`, `exercises[]` (`name`, `instructions`), `homework`, `status`, `milestones[]` (`label`, `reachedOn`) |
| `progressObservations` | Dated, observable progress notes (no percentages) | `goalId`, `planId`, `dogId`, `date`, `observation`, `source` (`observed`/`reported`), `consultationId`, `milestone` |
| `appointments` | Basic schedule | `dogIds[]`, `clientIds[]`, `type` (+ `discoveryCall`), `start`, `durationMinutes`, `location`, `status`, `consultationId` |
| `followUps` | Reminders/tasks for Haley | `title`, `dueDate`, `status` (`open`/`done`), `dogId`, `clientId`, `consultationId`, `notes` |
| `reportDrafts` | Editable client-facing report | `kind`, `sourceId`, `dogId`, `title`, `recipient`, `sections[]` (`heading`, `body`, `included`, `sensitive`), `status` |
| `dogDocuments` | Attachment metadata | `dogId`, `name`, `storagePath` (`dogs/{dogId}/…`), `contentType`, `size`, `kind` |
| `auditEvents` | Server-written audit trail (Cloud Function `auditTrail`). Clients can read, never write. | `collection`, `docId`, `action`, `actor`, `changedFields[]`, `at` |

Field values are never copied into `auditEvents`, so the audit trail contains no client details.

## Assessment responses

Each answer is stored under its question ID, which never changes once created (the template editor keeps IDs fixed), so answers stay matched across template versions.

```json
{
  "sf_bite_history": { "status": "answered", "value": "yes", "source": "reported" },
  "sf_incidents":    { "status": "answered", "value": "March: …", "source": "reported", "note": "Owner unsure of date" },
  "md_conditions":   { "status": "notAssessed", "value": null }
}
```

`status` is `answered`, `notAssessed` or `notApplicable`. `source` separates what the client reported from what Haley observed. Answers to questions hidden by a condition are dropped when an assessment is completed.

## Indexes

Composite indexes are declared in `firestore.indexes.json` for every list query that filters and sorts on different fields (upcoming appointments, open follow-ups, sessions by type, and so on). Small per-dog queries filter by one field and sort in the browser.

## Deletion policy

Clients, dogs, assessments, sessions, plans, goals and observations cannot be deleted from the app (archive or end instead) so history is preserved. Follow-ups, report drafts and file attachments can be deleted.
