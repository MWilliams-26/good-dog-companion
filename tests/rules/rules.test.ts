import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getBytes } from 'firebase/storage';

let env: RulesTestEnvironment;
const HALEY = 'haley-uid';
const STRANGER = 'stranger-uid';
const FORMER = 'former-staff-uid';

const create = (uid: string) => ({ createdBy: uid, updatedBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
const client = (uid: string, extra: object = {}) => ({ firstName: 'Test', lastName: 'Client', status: 'new', preferredContact: 'text', householdId: 'h1', ...create(uid), ...extra });

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-good-dog-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'authorizedUsers', HALEY), { email: 'h@x.demo', displayName: 'Haley', role: 'owner', active: true });
    await setDoc(doc(db, 'authorizedUsers', FORMER), { email: 'f@x.demo', displayName: 'Former', role: 'staff', active: false });
    const t = Timestamp.now();
    await setDoc(doc(db, 'clients', 'c1'), { ...client(HALEY), createdAt: t, updatedAt: t, privateNotes: 'secret' });
    await setDoc(doc(db, 'assessmentTemplateVersions', 'master_v1'), { name: 'M', sections: [], modules: [], templateId: 'master', version: 1, createdBy: HALEY, updatedBy: HALEY, createdAt: t, updatedAt: t });
    await setDoc(doc(db, 'assessments', 'a1'), { dogId: 'd1', clientIds: [], templateId: 'master', templateVersionId: 'master_v1', templateVersion: 1, mode: 'initial', status: 'draft', date: '2026-10-01', responses: {}, enabledModules: [], revision: 1, createdBy: HALEY, updatedBy: HALEY, createdAt: t, updatedAt: t });
    await setDoc(doc(db, 'assessments', 'a1', 'revisions', 'r1'), { assessmentId: 'a1', revision: 1, reason: 'Completed', responses: {}, createdBy: HALEY, updatedBy: HALEY, createdAt: t, updatedAt: t });
    await setDoc(doc(db, 'clientDogs', 'l1'), { clientId: 'c1', dogId: 'd1', role: 'guardian', isPrimary: true, startDate: '2026-01-01', endDate: null, createdBy: HALEY, updatedBy: HALEY, createdAt: t, updatedAt: t });
    await setDoc(doc(db, 'auditEvents', 'e1'), { collection: 'clients', docId: 'c1', action: 'create', actor: HALEY, at: t });
  });
});

describe('who can see practice records', () => {
  it('denies signed-out visitors', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'clients', 'c1')));
  });
  it('denies a signed-in account that was never authorized', async () => {
    const db = env.authenticatedContext(STRANGER).firestore();
    await assertFails(getDoc(doc(db, 'clients', 'c1')));
    await assertFails(setDoc(doc(db, 'clients', 'c2'), client(STRANGER)));
  });
  it('denies an account whose access was revoked', async () => {
    await assertFails(getDoc(doc(env.authenticatedContext(FORMER).firestore(), 'clients', 'c1')));
  });
  it('allows the authorized owner', async () => {
    await assertSucceeds(getDoc(doc(env.authenticatedContext(HALEY).firestore(), 'clients', 'c1')));
  });
});

describe('authorization records cannot be self-granted', () => {
  it('lets a user read only their own authorization', async () => {
    const db = env.authenticatedContext(STRANGER).firestore();
    await assertSucceeds(getDoc(doc(db, 'authorizedUsers', STRANGER)));
    await assertFails(getDoc(doc(db, 'authorizedUsers', HALEY)));
  });
  it('blocks writing authorizedUsers from the app, even for the owner', async () => {
    await assertFails(setDoc(doc(env.authenticatedContext(STRANGER).firestore(), 'authorizedUsers', STRANGER), { active: true, role: 'owner' }));
    await assertFails(updateDoc(doc(env.authenticatedContext(HALEY).firestore(), 'authorizedUsers', HALEY), { role: 'staff' }));
  });
});

describe('validated writes', () => {
  it('accepts a valid client with actor metadata', async () => {
    await assertSucceeds(setDoc(doc(env.authenticatedContext(HALEY).firestore(), 'clients', 'c2'), client(HALEY)));
  });
  it('rejects spoofed actors and client-chosen timestamps', async () => {
    const db = env.authenticatedContext(HALEY).firestore();
    await assertFails(setDoc(doc(db, 'clients', 'c3'), client('someone-else')));
    await assertFails(setDoc(doc(db, 'clients', 'c4'), { ...client(HALEY), createdAt: Timestamp.fromDate(new Date('2020-01-01')) }));
  });
  it('rejects invalid fields', async () => {
    const db = env.authenticatedContext(HALEY).firestore();
    await assertFails(setDoc(doc(db, 'clients', 'c5'), client(HALEY, { firstName: '' })));
    await assertFails(setDoc(doc(db, 'clients', 'c6'), client(HALEY, { status: 'vip' })));
    await assertFails(setDoc(doc(db, 'clients', 'c7'), client(HALEY, { privateNotes: 'x'.repeat(20001) })));
  });
  it('requires updatedBy/updatedAt on update and keeps createdBy fixed', async () => {
    const db = env.authenticatedContext(HALEY).firestore();
    await assertSucceeds(updateDoc(doc(db, 'clients', 'c1'), { notes: 'ok', updatedBy: HALEY, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'clients', 'c1'), { notes: 'no actor' }));
    await assertFails(updateDoc(doc(db, 'clients', 'c1'), { createdBy: 'x', updatedBy: HALEY, updatedAt: serverTimestamp() }));
  });
});

describe('history is preserved', () => {
  it('does not allow deleting clients', async () => {
    await assertFails(deleteDoc(doc(env.authenticatedContext(HALEY).firestore(), 'clients', 'c1')));
  });
  it('keeps published template versions immutable', async () => {
    await assertFails(updateDoc(doc(env.authenticatedContext(HALEY).firestore(), 'assessmentTemplateVersions', 'master_v1'), { name: 'Changed', updatedBy: HALEY, updatedAt: serverTimestamp() }));
  });
  it('keeps assessment revisions immutable', async () => {
    const db = env.authenticatedContext(HALEY).firestore();
    await assertFails(updateDoc(doc(db, 'assessments', 'a1', 'revisions', 'r1'), { reason: 'edited', updatedBy: HALEY, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db, 'assessments', 'a1', 'revisions', 'r1')));
  });
  it('does not let an assessment move to another dog or template version', async () => {
    const db = env.authenticatedContext(HALEY).firestore();
    await assertFails(updateDoc(doc(db, 'assessments', 'a1'), { dogId: 'd2', updatedBy: HALEY, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'assessments', 'a1'), { templateVersionId: 'master_v2', updatedBy: HALEY, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db, 'assessments', 'a1'), { responses: { q: { status: 'answered', value: 'x' } }, updatedBy: HALEY, updatedAt: serverTimestamp() }));
  });
  it('ends relationships instead of rewiring them', async () => {
    const db = env.authenticatedContext(HALEY).firestore();
    await assertFails(updateDoc(doc(db, 'clientDogs', 'l1'), { clientId: 'c9', updatedBy: HALEY, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db, 'clientDogs', 'l1'), { endDate: '2026-10-01', updatedBy: HALEY, updatedAt: serverTimestamp() }));
  });
  it('lets authorized users read the audit trail but nobody write it', async () => {
    const db = env.authenticatedContext(HALEY).firestore();
    await assertSucceeds(getDoc(doc(db, 'auditEvents', 'e1')));
    await assertFails(setDoc(doc(db, 'auditEvents', 'e2'), { collection: 'clients', docId: 'c1', action: 'delete', actor: HALEY, at: serverTimestamp() }));
    await assertFails(getDoc(doc(env.authenticatedContext(STRANGER).firestore(), 'auditEvents', 'e1')));
  });
});

describe('protected file uploads', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
  it('allows an authorized photo upload and read', async () => {
    const s = env.authenticatedContext(HALEY).storage();
    await assertSucceeds(uploadBytes(ref(s, 'dogs/d1/photo.png'), png, { contentType: 'image/png' }));
    await assertSucceeds(getBytes(ref(s, 'dogs/d1/photo.png')));
  });
  it('denies uploads and reads by unauthorized or signed-out users', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), 'dogs/d1/vet.pdf'), png, { contentType: 'application/pdf' });
    });
    await assertFails(uploadBytes(ref(env.authenticatedContext(STRANGER).storage(), 'dogs/d1/x.png'), png, { contentType: 'image/png' }));
    await assertFails(getBytes(ref(env.authenticatedContext(STRANGER).storage(), 'dogs/d1/vet.pdf')));
    await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), 'dogs/d1/vet.pdf')));
  });
  it('rejects disallowed file types, oversized files and paths outside dogs/', async () => {
    const s = env.authenticatedContext(HALEY).storage();
    await assertFails(uploadBytes(ref(s, 'dogs/d1/run.html'), png, { contentType: 'text/html' }));
    await assertFails(uploadBytes(ref(s, 'dogs/d1/big.jpg'), new Uint8Array(15 * 1024 * 1024 + 1), { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(s, 'public/x.png'), png, { contentType: 'image/png' }));
  });
});
