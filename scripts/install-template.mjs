#!/usr/bin/env node
// Installs the Master Behavioral Assessment template (v1) into a project.
// Writes only the template, never demo records. Refuses to overwrite an
// existing template so Haley's edits are never lost.
//
//   GOOGLE_APPLICATION_CREDENTIALS=sa.json node scripts/install-template.mjs --project <id>
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { MASTER_TEMPLATE } from '../src/assessment/masterTemplate.ts';

const i = process.argv.indexOf('--project');
const projectId = i > 0 ? process.argv[i + 1] : undefined;
if (!projectId) {
  console.error('Usage: node scripts/install-template.mjs --project <id>');
  process.exit(1);
}
initializeApp({ projectId });
const db = getFirestore();
const ref = db.doc('assessmentTemplates/master');
if ((await ref.get()).exists) {
  console.log('A template already exists; leaving it untouched.');
  process.exit(0);
}
const meta = { createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), createdBy: 'install-template', updatedBy: 'install-template', archived: false };
const batch = db.batch();
batch.set(db.doc('assessmentTemplateVersions/master_v1'), { ...MASTER_TEMPLATE, templateId: 'master', version: 1, changeNote: 'Initial master template', ...meta });
batch.set(ref, { ...MASTER_TEMPLATE, currentVersion: 1, currentVersionId: 'master_v1', ...meta });
await batch.commit();
console.log('Installed Master Behavioral Assessment v1.');
