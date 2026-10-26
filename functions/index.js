// Server-side audit trail. Every write to a practice collection produces an
// immutable auditEvents row recording what changed, who changed it (taken from
// the rules-enforced updatedBy field), and when. Clients cannot write
// auditEvents; see firestore.rules. Field values are never copied into the
// audit row, so no client details leak into it or into function logs.
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp();

export const AUDITED = new Set([
  'clients', 'households', 'dogs', 'clientDogs', 'assessmentTemplates',
  'assessmentTemplateVersions', 'assessments', 'consultations', 'trainingPlans',
  'goals', 'progressObservations', 'appointments', 'followUps', 'reportDrafts',
  'dogDocuments',
]);

// One trigger for every top-level collection keeps a single warm instance.
export const auditTrail = onDocumentWritten({ document: '{collection}/{docId}', region: 'us-central1' }, async (event) => {
  const { collection, docId } = event.params;
  if (!AUDITED.has(collection)) return; // never audits auditEvents itself
  const before = event.data?.before;
  const after = event.data?.after;
  const action = !before?.exists ? 'create' : !after?.exists ? 'delete' : 'update';
  const actor = (after?.exists ? after.get('updatedBy') : before?.get('updatedBy')) ?? null;
  let changedFields = [];
  if (action === 'update') {
    const a = after.data();
    const b = before.data();
    changedFields = [...new Set([...Object.keys(a), ...Object.keys(b)])]
      .filter((k) => !['updatedAt', 'updatedBy'].includes(k))
      .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  }
  await getFirestore().collection('auditEvents').add({
    collection,
    docId,
    action,
    actor,
    changedFields,
    at: FieldValue.serverTimestamp(),
  });
});
