import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { CollectionName } from './types';

export const BACKUP_COLLECTIONS: (CollectionName | 'auditEvents')[] = [
  'households',
  'clients',
  'dogs',
  'clientDogs',
  'assessmentTemplates',
  'assessmentTemplateVersions',
  'assessments',
  'consultations',
  'trainingPlans',
  'goals',
  'progressObservations',
  'appointments',
  'followUps',
  'reportDrafts',
  'dogDocuments',
  'auditEvents',
];

/** Firestore Timestamps → ISO strings, recursively, so the backup is plain JSON. */
export function plain(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  return value;
}

export async function buildBackup() {
  const collections: Record<string, unknown[]> = {};
  for (const name of BACKUP_COLLECTIONS) {
    const snap = await getDocs(collection(db, name));
    collections[name] = snap.docs.map((d) => ({ id: d.id, ...(plain(d.data()) as object) }));
  }
  // Assessment revision history lives in subcollections.
  const revisions: unknown[] = [];
  for (const a of collections.assessments as { id: string }[]) {
    const snap = await getDocs(collection(db, 'assessments', a.id, 'revisions'));
    revisions.push(...snap.docs.map((d) => ({ id: d.id, assessmentId: a.id, ...(plain(d.data()) as object) })));
  }
  collections.assessmentRevisions = revisions;
  return {
    app: 'good-dog-companion',
    format: 1,
    exportedAt: new Date().toISOString(),
    note: 'Complete backup including consultant-only notes. Store securely. Files (photos, PDFs) are referenced by storagePath and backed up separately from Firebase Storage.',
    counts: Object.fromEntries(Object.entries(collections).map(([k, v]) => [k, v.length])),
    collections,
  };
}
